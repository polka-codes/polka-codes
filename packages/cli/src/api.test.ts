import { beforeEach, describe, expect, test } from 'bun:test'
import { createScriptingApi, type ScriptingApi, type ScriptingApiDependencies } from './api'
import type { WorkflowProgressCallback, WorkflowProgressEvent } from './workflow-events'

const structuredFailure: { success: false; reason: string; summaries: string[]; errorType: 'provider' } = {
  success: false,
  reason: 'provider exploded',
  summaries: [],
  errorType: 'provider',
}

type WorkflowRunner = NonNullable<ScriptingApiDependencies['runWorkflow']>

type ObservedWorkflowOptions = {
  commandName?: string
  interactive?: boolean
  structuredErrors?: boolean
  onEvent?: WorkflowProgressCallback
}

type WorkflowRunnerCall = {
  workflowInput: unknown
  options: ObservedWorkflowOptions
}

type WorkflowRunnerImplementation = (...args: Parameters<WorkflowRunner>) => Promise<unknown>

function createRecordingWorkflowRunner() {
  let implementation: WorkflowRunnerImplementation = async () => structuredFailure
  const calls: WorkflowRunnerCall[] = []

  const runWorkflow = (async (...args: Parameters<WorkflowRunner>) => {
    const [, workflowInput, options] = args
    calls.push({ workflowInput, options: options as ObservedWorkflowOptions })

    return implementation(...args)
  }) as WorkflowRunner

  return {
    calls,
    runWorkflow,
    reset() {
      calls.length = 0
      implementation = async () => structuredFailure
    },
    respondWith(nextImplementation: WorkflowRunnerImplementation) {
      implementation = nextImplementation
    },
  }
}

let api: ScriptingApi
let workflowRunner: ReturnType<typeof createRecordingWorkflowRunner>

describe('code API', () => {
  beforeEach(() => {
    workflowRunner = createRecordingWorkflowRunner()
    api = createScriptingApi({ runWorkflow: workflowRunner.runWorkflow })
  })

  test('returns structured workflow failures and forwards stateless mode', async () => {
    const onEvent = () => {}
    const result = await api.code({
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
    expect(workflowRunner.calls).toHaveLength(1)

    const call = workflowRunner.calls[0]
    if (!call) {
      throw new Error('runWorkflow was not called')
    }
    expect(call.workflowInput).toMatchObject({
      task: 'Generate the requested file.',
      mode: 'direct',
      skipFix: true,
      fixCommand: 'cargo check --tests -p pallet-example',
      allowedWritePaths: ['tests/generated.rs'],
      stateless: true,
    })
    expect(call.options).toMatchObject({
      commandName: 'code',
      interactive: false,
      structuredErrors: true,
    })
    expect(call.options.onEvent).not.toBe(onEvent)
  })

  test('returns direct non-interactive execution details collected from progress events', async () => {
    const forwardedEvents: WorkflowProgressEvent[] = []
    workflowRunner.respondWith(async (...args) => {
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

    const result = await api.code({
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
      ['commit', (onEvent) => api.commit({ interactive: false, onEvent })],
      ['pr', (onEvent) => api.createPr({ interactive: false, onEvent })],
      ['review', (onEvent) => api.reviewCode({ interactive: false, onEvent })],
      ['fix', (onEvent) => api.fix({ interactive: false, onEvent })],
      ['task', (onEvent) => api.task({ task: 'Do the task.', interactive: false, onEvent })],
      ['plan', (onEvent) => api.plan({ task: 'Plan the task.', interactive: false, onEvent })],
    ]

    for (const [commandName, callApi] of apiCalls) {
      workflowRunner.reset()
      const onEvent = () => {}

      await callApi(onEvent)

      const call = workflowRunner.calls[0]
      if (!call) {
        throw new Error(`${commandName} did not call runWorkflow`)
      }
      expect(call.options).toMatchObject({
        commandName,
        interactive: false,
        onEvent,
      })
    }
  })
})
