import { expect, test } from 'bun:test'
import type { AgentToolRegistry } from './agent.workflow'
import {
  generateWorkflowCodeWorkflow,
  generateWorkflowDefinitionWorkflow,
  validateWorkflowCodeSyntax,
  validateWorkflowDefinition,
} from './dynamic-generator.workflow'
import type { WorkflowFile } from './dynamic-types'
import { createContext } from './workflow'

test('generateWorkflowDefinitionWorkflow returns valid workflow definition', async () => {
  const mockWorkflowDefinition: WorkflowFile = {
    workflows: {
      main: {
        task: 'Test Task',
        steps: [
          {
            id: 'step1',
            task: 'Step 1',
            code: null,
            tools: [],
            output: null,
            expected_outcome: null,
            outputSchema: null,
          },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const tools = {
    generateText: async () => {
      return [
        {
          role: 'assistant',
          content: JSON.stringify(mockWorkflowDefinition),
        },
      ]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)

  const result = await generateWorkflowDefinitionWorkflow({ prompt: 'Create a test workflow' }, ctx)

  expect(result).toEqual(mockWorkflowDefinition)
})

test('generateWorkflowCodeWorkflow returns workflow with code', async () => {
  const inputWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [
          {
            id: 'step1',
            task: 'Step 1',
            code: null,
            tools: [],
            output: null,
            expected_outcome: null,
            outputSchema: null,
          },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const outputWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [
          {
            id: 'step1',
            task: 'Step 1',
            code: 'return "done";',
            tools: [],
            output: null,
            expected_outcome: null,
            outputSchema: null,
          },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const tools = {
    generateText: async () => {
      return [
        {
          role: 'assistant',
          content: JSON.stringify(outputWorkflow),
        },
      ]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)

  const result = await generateWorkflowCodeWorkflow({ workflow: inputWorkflow }, ctx)

  expect(result).toEqual(outputWorkflow)
})

test('generateWorkflowCodeWorkflow prompt includes ctx types and tool usage examples', async () => {
  const inputWorkflow: WorkflowFile = { workflows: {} }
  const outputWorkflow: WorkflowFile = { workflows: {} }
  const capturedSystemPrompts: string[] = []

  const tools = {
    generateText: async (input: any) => {
      const systemMessage = input.messages.find((m: any) => m.role === 'system')
      if (systemMessage) capturedSystemPrompts.push(systemMessage.content)
      return [{ role: 'assistant', content: JSON.stringify(outputWorkflow) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  await generateWorkflowCodeWorkflow({ workflow: inputWorkflow }, ctx)

  expect(capturedSystemPrompts.length).toBeGreaterThanOrEqual(1)
  expect(capturedSystemPrompts[0]).toMatchSnapshot()
})

test('generateWorkflowDefinitionWorkflow includes available tools in prompt', async () => {
  const mockWorkflowDefinition: WorkflowFile = { workflows: { main: { task: 'test', steps: [], inputs: null, output: null } } }
  let capturedSystemPrompt = ''

  const tools = {
    generateText: async (input: any) => {
      const systemMessage = input.messages.find((m: any) => m.role === 'system')
      if (systemMessage) capturedSystemPrompt = systemMessage.content
      return [{ role: 'assistant', content: JSON.stringify(mockWorkflowDefinition) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  await generateWorkflowDefinitionWorkflow(
    {
      prompt: 'test',
      availableTools: [{ name: 'myTool', description: 'my description' }],
    },
    ctx,
  )

  expect(capturedSystemPrompt).toContain('Available Tools:')
  expect(capturedSystemPrompt).toContain('- myTool: my description')
})

test('generateWorkflowCodeWorkflow with skipReview skips review step', async () => {
  const inputWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [{ id: 'step1', task: 'Step 1', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null }],
        inputs: null,
        output: null,
      },
    },
  }

  const outputWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [
          { id: 'step1', task: 'Step 1', code: 'return "done";', tools: [], output: null, expected_outcome: null, outputSchema: null },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  let generateCallCount = 0
  const tools = {
    generateText: async () => {
      generateCallCount++
      return [{ role: 'assistant', content: JSON.stringify(outputWorkflow) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  await generateWorkflowCodeWorkflow({ workflow: inputWorkflow, skipReview: true }, ctx)

  expect(generateCallCount).toBe(1)
})

test('generateWorkflowCodeWorkflow retries on syntax error', async () => {
  const inputWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [{ id: 'step1', task: 'Step 1', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null }],
        inputs: null,
        output: null,
      },
    },
  }

  const invalidCodeWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [
          {
            id: 'step1',
            task: 'Step 1',
            code: 'const x = {',
            tools: [],
            output: null,
            expected_outcome: null,
            outputSchema: null,
          },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const validCodeWorkflow: WorkflowFile = {
    workflows: {
      testWorkflow: {
        task: 'Test Task',
        steps: [
          { id: 'step1', task: 'Step 1', code: 'return "done";', tools: [], output: null, expected_outcome: null, outputSchema: null },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  let callCount = 0
  const tools = {
    generateText: async () => {
      callCount++
      if (callCount === 1) {
        return [{ role: 'assistant', content: JSON.stringify(invalidCodeWorkflow) }]
      }
      return [{ role: 'assistant', content: JSON.stringify(validCodeWorkflow) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  const result = await generateWorkflowCodeWorkflow({ workflow: inputWorkflow, skipReview: true }, ctx)

  expect(callCount).toBe(2)
  expect(result.workflows.testWorkflow.steps[0].code).toBe('return "done";')
})

test('validateWorkflowDefinition detects missing main workflow', () => {
  const workflow: WorkflowFile = {
    workflows: {
      other: { task: 'test', steps: [], inputs: null, output: null },
    },
  }

  const result = validateWorkflowDefinition(workflow)

  expect(result).toMatchSnapshot()
})

test('validateWorkflowDefinition detects duplicate step IDs', () => {
  const workflow: WorkflowFile = {
    workflows: {
      main: {
        task: 'test',
        steps: [
          { id: 'step1', task: 'Step 1', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null },
          { id: 'step1', task: 'Step 1 duplicate', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const result = validateWorkflowDefinition(workflow)

  expect(result).toMatchSnapshot()
})

test('validateWorkflowDefinition passes for valid workflow', () => {
  const workflow: WorkflowFile = {
    workflows: {
      main: {
        task: 'test',
        steps: [
          { id: 'step1', task: 'Step 1', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null },
          { id: 'step2', task: 'Step 2', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const result = validateWorkflowDefinition(workflow)

  expect(result).toEqual({ valid: true, errors: [] })
})

test('validateWorkflowCodeSyntax detects invalid syntax', () => {
  const workflow: WorkflowFile = {
    workflows: {
      main: {
        task: 'test',
        steps: [{ id: 'step1', task: 'Step 1', code: 'const x = {', tools: [], output: null, expected_outcome: null, outputSchema: null }],
        inputs: null,
        output: null,
      },
    },
  }

  const result = validateWorkflowCodeSyntax(workflow)

  expect(result.valid).toBe(false)
  expect(result.errors.length).toBe(1)
  expect(result.errors[0]).toContain('main.step1')
})

test('validateWorkflowCodeSyntax passes for valid code', () => {
  const workflow: WorkflowFile = {
    workflows: {
      main: {
        task: 'test',
        steps: [
          { id: 'step1', task: 'Step 1', code: 'return "hello"', tools: [], output: null, expected_outcome: null, outputSchema: null },
          {
            id: 'step2',
            task: 'Step 2',
            code: 'const x = 1;\nreturn x + 1;',
            tools: [],
            output: null,
            expected_outcome: null,
            outputSchema: null,
          },
        ],
        inputs: null,
        output: null,
      },
    },
  }

  const result = validateWorkflowCodeSyntax(workflow)

  expect(result).toEqual({ valid: true, errors: [] })
})

test('validateWorkflowCodeSyntax skips steps without code', () => {
  const workflow: WorkflowFile = {
    workflows: {
      main: {
        task: 'test',
        steps: [{ id: 'step1', task: 'Step 1', code: null, tools: [], output: null, expected_outcome: null, outputSchema: null }],
        inputs: null,
        output: null,
      },
    },
  }

  const result = validateWorkflowCodeSyntax(workflow)

  expect(result).toEqual({ valid: true, errors: [] })
})

test('generateWorkflowDefinitionWorkflow definition prompt includes expected_outcome documentation', async () => {
  const mockWorkflowDefinition: WorkflowFile = { workflows: { main: { task: 'test', steps: [], inputs: null, output: null } } }
  let capturedSystemPrompt = ''

  const tools = {
    generateText: async (input: any) => {
      const systemMessage = input.messages.find((m: any) => m.role === 'system')
      if (systemMessage) capturedSystemPrompt = systemMessage.content
      return [{ role: 'assistant', content: JSON.stringify(mockWorkflowDefinition) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  await generateWorkflowDefinitionWorkflow({ prompt: 'test' }, ctx)

  expect(capturedSystemPrompt).toContain('Using expected_outcome Effectively')
  expect(capturedSystemPrompt).toContain('Describe the data structure')
})

test('generateWorkflowCodeWorkflow review prompt includes quality guidelines', async () => {
  const inputWorkflow: WorkflowFile = { workflows: {} }
  const outputWorkflow: WorkflowFile = { workflows: {} }
  const capturedSystemPrompts: string[] = []

  const tools = {
    generateText: async (input: any) => {
      const systemMessage = input.messages.find((m: any) => m.role === 'system')
      if (systemMessage) capturedSystemPrompts.push(systemMessage.content)
      return [{ role: 'assistant', content: JSON.stringify(outputWorkflow) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  await generateWorkflowCodeWorkflow({ workflow: inputWorkflow }, ctx)

  expect(capturedSystemPrompts.length).toBe(2)
  expect(capturedSystemPrompts[1]).toMatchSnapshot()
})
