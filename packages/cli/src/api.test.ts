import { beforeEach, describe, expect, mock, test } from 'bun:test'

const structuredFailure: { success: false; reason: string; summaries: string[]; errorType: 'provider' } = {
  success: false,
  reason: 'provider exploded',
  summaries: [],
  errorType: 'provider',
}

const runWorkflowMock = mock(async (..._args: unknown[]) => structuredFailure)

mock.module('./runWorkflow', () => ({
  runWorkflow: runWorkflowMock,
}))

const { code, commit, createPr, fix, plan, reviewCode, task } = await import('./api')

describe('code API', () => {
  beforeEach(() => {
    runWorkflowMock.mockClear()
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

    expect(result).toEqual(structuredFailure)
    expect(runWorkflowMock).toHaveBeenCalledTimes(1)

    const call = runWorkflowMock.mock.calls[0]
    if (!call) {
      throw new Error('runWorkflow was not called')
    }
    const [, workflowInput, options] = call
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
      onEvent,
      structuredErrors: true,
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
