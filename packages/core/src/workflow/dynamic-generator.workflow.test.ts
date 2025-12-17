import { expect, test } from 'bun:test'
import type { AgentToolRegistry } from './agent.workflow'
import { generateWorkflowCodeWorkflow, generateWorkflowDefinitionWorkflow } from './dynamic-generator.workflow'
import type { WorkflowFile } from './dynamic-types'
import { createContext } from './workflow'

test('generateWorkflowDefinitionWorkflow returns valid workflow definition', async () => {
  const mockWorkflowDefinition: WorkflowFile = {
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
  let capturedSystemPrompt = ''

  const tools = {
    generateText: async (input: any) => {
      const systemMessage = input.messages.find((m: any) => m.role === 'system')
      if (systemMessage) capturedSystemPrompt = systemMessage.content
      return [{ role: 'assistant', content: JSON.stringify(outputWorkflow) }]
    },
    taskEvent: async () => {},
    invokeTool: async () => ({ type: 'Reply', message: 'ok' }),
  } as unknown as any

  const ctx = createContext<AgentToolRegistry>(tools)
  await generateWorkflowCodeWorkflow({ workflow: inputWorkflow }, ctx)

  expect(capturedSystemPrompt).toMatchSnapshot()
})

test('generateWorkflowDefinitionWorkflow includes available tools in prompt', async () => {
  const mockWorkflowDefinition: WorkflowFile = { workflows: {} }
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
