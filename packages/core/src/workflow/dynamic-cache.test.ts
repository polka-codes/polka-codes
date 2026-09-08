import { describe, expect, test } from 'bun:test'
import type { AgentToolRegistry } from './agent.workflow'
import { createDynamicWorkflow } from './dynamic'
import type { WorkflowFile } from './dynamic-types'
import type { JsonResponseMessage } from './json-ai-types'
import { type TaskEvent, TaskEventKind } from './types'
import { createContext, makeStepFn } from './workflow'

function cachedContext(responses: JsonResponseMessage[]) {
  let calls = 0
  const events: TaskEvent[] = []
  const context = createContext<AgentToolRegistry>(
    {
      generateText: async ({ messages }) => {
        const response = responses[calls++]
        if (!response) throw new Error('Unexpected model request')
        return { requestMessages: messages, responseMessages: [response] }
      },
      taskEvent: async (event) => {
        events.push(event)
      },
      invokeTool: async () => {
        throw new Error('Unexpected external tool')
      },
    },
    makeStepFn(),
  )
  return { context, events, calls: () => calls }
}

describe('dynamic workflow cache identity', () => {
  test('runs sibling steps independently and replays their state and events', async () => {
    const definition: WorkflowFile = {
      workflows: {
        main: {
          task: 'Two tasks',
          steps: [
            { id: 'a', task: 'first', output: 'a' },
            { id: 'b', task: 'second', output: 'b' },
          ],
        },
      },
    }
    const run = createDynamicWorkflow<AgentToolRegistry>(definition, { toolInfo: [] })
    const fixture = cachedContext([
      { role: 'assistant', content: '1' },
      { role: 'assistant', content: '2' },
    ])
    expect(await run('main', {}, fixture.context)).toEqual({ a: 1, b: 2 })
    expect(fixture.calls()).toBe(2)
    const eventCount = fixture.events.length
    expect(fixture.events.filter((event) => event.kind === TaskEventKind.EndTask)).toHaveLength(2)
    expect(await run('main', {}, fixture.context)).toEqual({ a: 1, b: 2 })
    expect(fixture.calls()).toBe(2)
    expect(fixture.events).toHaveLength(eventCount)
  })

  test('reconstructs loop state from independently cached iterations', async () => {
    const run = createDynamicWorkflow<AgentToolRegistry>(
      {
        workflows: {
          main: {
            task: 'Loop',
            output: 'count',
            steps: [
              { id: 'init', task: 'initialize', output: 'count' },
              {
                id: 'loop',
                while: {
                  condition: 'state.count < 2',
                  steps: [{ id: 'branch', if: { condition: 'true', thenBranch: [{ id: 'advance', task: 'advance', output: 'count' }] } }],
                },
              },
            ],
          },
        },
      },
      { toolInfo: [] },
    )
    const fixture = cachedContext([0, 1, 2].map((value) => ({ role: 'assistant', content: String(value) })))
    expect(await run('main', {}, fixture.context)).toBe(2)
    expect(await run('main', {}, fixture.context)).toBe(2)
    expect(fixture.calls()).toBe(3)
  })

  test('isolates repeated subworkflow calls and caches their tool effects', async () => {
    const run = createDynamicWorkflow<AgentToolRegistry>(
      {
        workflows: {
          main: { task: 'Delegate twice', steps: [{ id: 'delegate', task: 'Call child twice' }] },
          child: { task: 'Child', output: 'result', steps: [{ id: 'child', task: 'Result', output: 'result' }] },
        },
      },
      { toolInfo: [] },
    )
    const fixture = cachedContext([
      {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'one', toolName: 'runWorkflow', input: { workflowId: 'child' } },
          { type: 'tool-call', toolCallId: 'two', toolName: 'runWorkflow', input: { workflowId: 'child' } },
        ],
      },
      { role: 'assistant', content: '1' },
      { role: 'assistant', content: '2' },
      { role: 'assistant', content: 'Done' },
    ])
    await run('main', {}, fixture.context)
    const replies = fixture.events.filter((event) => event.kind === TaskEventKind.ToolReply)
    expect(replies.map((event) => event.content)).toEqual([
      { type: 'json', value: 1 },
      { type: 'json', value: 2 },
    ])
    await run('main', {}, fixture.context)
    expect(fixture.calls()).toBe(4)
    expect(fixture.events.filter((event) => event.kind === TaskEventKind.ToolReply)).toHaveLength(2)
  })
})
