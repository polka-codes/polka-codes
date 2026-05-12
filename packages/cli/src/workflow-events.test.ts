import { describe, expect, mock, test } from 'bun:test'
import { type TaskEvent, TaskEventKind } from '@polka-codes/core'
import { createWorkflowProgressEmitter, type WorkflowProgressState, workflowProgressEventsFromTaskEvent } from './workflow-events'

describe('workflowProgressEventsFromTaskEvent', () => {
  test('logs and suppresses progress callback failures', async () => {
    const warn = mock(() => {})
    const emit = createWorkflowProgressEmitter(
      () => {
        throw new Error('callback failed')
      },
      { warn },
    )

    await emit({ kind: 'workflow-started' })

    expect(warn).toHaveBeenCalledWith('Workflow progress callback failed: callback failed')
  })

  test('emits model progress only for the first model request', () => {
    const state: WorkflowProgressState = { modelOutputStarted: false }
    const event: TaskEvent = {
      kind: TaskEventKind.StartRequest,
      userMessage: [{ role: 'user' as const, content: 'hello' }],
    }

    expect(workflowProgressEventsFromTaskEvent(event, state)).toEqual([{ kind: 'model-output-started' }])
    expect(workflowProgressEventsFromTaskEvent(event, state)).toEqual([])
  })

  test('maps tool lifecycle events to payload-light progress events', () => {
    const state: WorkflowProgressState = { modelOutputStarted: false }

    expect(
      workflowProgressEventsFromTaskEvent(
        {
          kind: TaskEventKind.ToolUse,
          tool: 'writeToFile',
          params: { path: 'generated.rs', content: 'large payload omitted' },
        },
        state,
      ),
    ).toEqual([{ kind: 'tool-call-started', tool: 'writeToFile' }])
    expect(
      workflowProgressEventsFromTaskEvent(
        {
          kind: TaskEventKind.ToolReply,
          tool: 'writeToFile',
          content: { type: 'text', value: 'ok' },
        },
        state,
      ),
    ).toEqual([{ kind: 'tool-call-finished', tool: 'writeToFile' }])
  })
})
