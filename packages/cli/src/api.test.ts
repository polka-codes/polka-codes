import { beforeEach, describe, expect, mock, test } from 'bun:test'
import type { WorkflowProgressCallback, WorkflowProgressEvent } from './workflow-events'

const structuredFailure: { success: false; reason: string; summaries: string[]; errorType: 'provider' } = {
  success: false,
  reason: 'provider exploded',
  summaries: [],
  errorType: 'provider',
}

const runWorkflowMock = mock(async (..._args: unknown[]): Promise<unknown> => structuredFailure)

mock.module('./runWorkflow', () => ({
  runWorkflow: runWorkflowMock,
}))

const { code, commit, createPr, fix, plan, reviewCode, task } = await import('./api')

describe('code API', () => {
  beforeEach(() => {
    runWorkflowMock.mockClear()
    runWorkflowMock.mockImplementation(async (..._args: unknown[]) => structuredFailure)
  })

  test('returns structured workflow failures and forwards stateless mode', async () => {
    const onEvent = mock(() => {})
    const result = await code({
      task: 'Generate the requested file.',
      mode: 'direct',
      interactive: false,
      skipFix: true,
      fixCommand: 'cargo check --tests -p pallet-example',
      allowedWritePaths: ['tests/generated.rs'],
      stateless: true,
      onEvent,
    })

    expect(result).toEqual({
      ...structuredFailure,
      details: {
        writeAttempts: [],
        changedFiles: [],
      },
    })
    expect(runWorkflowMock).toHaveBeenCalledTimes(1)

    const call = runWorkflowMock.mock.calls[0]
    if (!call) {
      throw new Error('runWorkflow was not called')
    }
    const [, workflowInput, rawOptions] = call
    const options = rawOptions as { onEvent?: WorkflowProgressCallback }
    expect(workflowInput).toMatchObject({
      task: 'Generate the requested file.',
      mode: 'direct',
      skipFix: true,
      fixCommand: 'cargo check --tests -p pallet-example',
      allowedWritePaths: ['tests/generated.rs'],
      stateless: true,
    })
    expect(options).toMatchObject({
      commandName: 'code',
      interactive: false,
      structuredErrors: true,
    })
    expect(options.onEvent).not.toBe(onEvent)
  })

  test('returns direct non-interactive execution details collected from progress events', async () => {
    const forwardedEvents: WorkflowProgressEvent[] = []
    runWorkflowMock.mockImplementation(async (...args: unknown[]) => {
      const options = args[2] as { onEvent?: WorkflowProgressCallback }
      await options.onEvent?.({ kind: 'write-attempted', path: 'tests/generated.rs' })
      await options.onEvent?.({ kind: 'write-finished', path: 'tests/generated.rs' })
      await options.onEvent?.({ kind: 'write-attempted', path: 'tests/blocked.rs' })
      await options.onEvent?.({
        kind: 'write-rejected',
        path: 'tests/blocked.rs',
        reason: 'outside allowedWritePaths',
      })
      await options.onEvent?.({ kind: 'fix-started', command: 'cargo test --no-run' })
      await options.onEvent?.({
        kind: 'fix-failed',
        command: 'cargo test --no-run',
        exitCode: 101,
        outputExcerpt: 'compile error',
      })
      return { success: false, reason: 'compile failed', summaries: ['Generated test.'] }
    })

    const result = await code({
      task: 'Generate the requested file.',
      mode: 'direct',
      interactive: false,
      allowedWritePaths: ['tests/generated.rs'],
      onEvent: (event) => {
        forwardedEvents.push(event)
      },
    })

    expect(forwardedEvents).toEqual([
      { kind: 'write-attempted', path: 'tests/generated.rs' },
      { kind: 'write-finished', path: 'tests/generated.rs' },
      { kind: 'write-attempted', path: 'tests/blocked.rs' },
      {
        kind: 'write-rejected',
        path: 'tests/blocked.rs',
        reason: 'outside allowedWritePaths',
      },
      { kind: 'fix-started', command: 'cargo test --no-run' },
      {
        kind: 'fix-failed',
        command: 'cargo test --no-run',
        exitCode: 101,
        outputExcerpt: 'compile error',
      },
    ])
    expect(result).toEqual({
      success: false,
      reason: 'compile failed',
      summaries: ['Generated test.'],
      details: {
        writeAttempts: [
          { path: 'tests/generated.rs', outcome: 'completed' },
          {
            path: 'tests/blocked.rs',
            outcome: 'rejected',
            reason: 'outside allowedWritePaths',
          },
        ],
        changedFiles: ['tests/generated.rs'],
        fix: {
          command: 'cargo test --no-run',
          status: 'failed',
          exitCode: 101,
          outputExcerpt: 'compile error',
        },
      },
    })
  })

  test('forwards progress callback for all public workflow APIs', async () => {
    const apiCalls: Array<[string, (onEvent: () => void) => Promise<unknown>]> = [
      ['commit', (onEvent) => commit({ interactive: false, onEvent })],
      ['pr', (onEvent) => createPr({ interactive: false, onEvent })],
      ['review', (onEvent) => reviewCode({ interactive: false, onEvent })],
      ['fix', (onEvent) => fix({ interactive: false, onEvent })],
      ['task', (onEvent) => task({ task: 'Do the task.', interactive: false, onEvent })],
      ['plan', (onEvent) => plan({ task: 'Plan the task.', interactive: false, onEvent })],
    ]

    for (const [commandName, callApi] of apiCalls) {
      runWorkflowMock.mockClear()
      const onEvent = mock(() => {})

      await callApi(onEvent)

      const call = runWorkflowMock.mock.calls[0]
      if (!call) {
        throw new Error(`${commandName} did not call runWorkflow`)
      }
      const [, , options] = call
      expect(options).toMatchObject({
        commandName,
        interactive: false,
        onEvent,
      })
    }
  })
})
