import { expect, test } from 'bun:test'
import { createDynamicWorkflow } from './dynamic'
import { createContext, makeStepFn, type ToolRegistry } from './workflow'

const yamlDef = `
workflows:
  main:
    task: Main workflow
    inputs:
      - id: a
        description: number input
    steps:
      - id: add_one
        task: Add one to a
        output: b
        code: |
          return ctx.input.a + 1
      - id: run_sub
        tools: [runWorkflow]
        task: Run sub workflow with b
        output: subResult
        code: |
          return await ctx.runWorkflow('sub', { x: ctx.state.b })
  sub:
    task: Sub workflow
    inputs:
      - id: x
        description: number input
    steps:
      - id: multiply_two
        task: Multiply x by two
        output: y
        code: |
          return ctx.input.x * 2
`

test('dynamic runner executes persisted step code and sub-workflows', async () => {
  const runner = createDynamicWorkflow<ToolRegistry>(yamlDef, { allowUnsafeCodeExecution: true })
  const context = createContext({} as any, makeStepFn())

  const result = await runner('main', { a: 3 }, context)

  expect(result.b).toBe(4)
  expect(result.subResult.y).toBe(8)
})

test('dynamic runner throws when code missing and agent execution unavailable', async () => {
  const yamlNoCode = `
workflows:
  main:
    task: Main
    steps:
      - id: step1
        task: Do something
        output: out
`
  const runner = createDynamicWorkflow<ToolRegistry>(yamlNoCode, { allowUnsafeCodeExecution: false })
  const context = createContext({} as any, makeStepFn())

  await expect(runner('main', {}, context)).rejects.toThrow('requires agent execution')
})

test('dynamic runner allows agent to call runWorkflow', async () => {
  const yamlAgentDef = `
workflows:
  main:
    task: Main workflow
    steps:
      - id: step1
        task: Call sub workflow
        tools: [runWorkflow]
        output: result
  sub:
    task: Sub workflow
    steps:
      - id: subStep
        task: Calculate double
        code: |
          return { doubled: ctx.input.val * 2 }
`
  const runner = createDynamicWorkflow<ToolRegistry>(yamlAgentDef, {
    allowUnsafeCodeExecution: true,
    toolInfo: [], // No extra tools needed
    maxToolRoundTrips: 5,
  })

  let generateTextCalled = 0

  const mockTools = {
    generateText: async (_input: any) => {
      generateTextCalled++
      // First call: Call runWorkflow
      if (generateTextCalled === 1) {
        return [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'runWorkflow',
                input: { workflowId: 'sub', input: { val: 10 } },
              },
            ],
          },
        ]
      }
      // Second call: Return result
      // The agent receives the tool output and then decides what to return.
      // We simulate the agent returning the final JSON.
      return [
        {
          role: 'assistant',
          content: JSON.stringify({ doubled: 20 }),
        },
      ]
    },
    taskEvent: async () => {},
    invokeTool: async () => {
      return { success: false, message: { type: 'error-text', value: 'Should not be called directly' } }
    },
  }

  const context = createContext(mockTools as any, makeStepFn())

  const result = await runner('main', {}, context)

  expect(result.result).toEqual({ doubled: 20 })
  expect(generateTextCalled).toBe(2)
})

test('dynamic runner allows agent to call runWorkflow if tools is undefined', async () => {
  const yamlDefNoTools = `
workflows:
  main:
    task: Main workflow
    steps:
      - id: step1
        task: Call sub workflow
        # tools: [runWorkflow]  <-- Missing, so all tools allowed
        output: result
  sub:
    task: Sub workflow
    steps:
      - id: subStep
        task: Calculate double
        code: |
          return { doubled: ctx.input.val * 2 }
`
  const runner = createDynamicWorkflow<ToolRegistry>(yamlDefNoTools, {
    allowUnsafeCodeExecution: true,
    toolInfo: [],
    maxToolRoundTrips: 5,
  })

  let generateTextCalled = 0
  let lastMessages: any[] = []

  const mockTools = {
    generateText: async (input: any) => {
      generateTextCalled++
      lastMessages = [...input.messages]

      if (generateTextCalled === 1) {
        return [
          {
            role: 'assistant',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_1',
                toolName: 'runWorkflow',
                input: { workflowId: 'sub', input: { val: 10 } },
              },
            ],
          },
        ]
      }

      // Second call, we should see the result
      return [
        {
          role: 'assistant',
          content: JSON.stringify({ result: 'done' }),
        },
      ]
    },
    taskEvent: async () => {},
    invokeTool: async () => {
      return { success: false, message: { type: 'error-text', value: 'Should not be called directly' } }
    },
  }

  const context = createContext(mockTools as any, makeStepFn())

  await runner('main', {}, context)

  expect(generateTextCalled).toBe(2)
  const lastMsg = lastMessages[lastMessages.length - 1]
  expect(lastMsg.role).toBe('tool')

  const toolResult = lastMsg.content[0]
  expect(toolResult.type).toBe('tool-result')
  // Expect success result
  expect(toolResult.output.value).toEqual({ subStep: { doubled: 20 } })
})
