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

const { code } = await import('./api')

describe('code API', () => {
  beforeEach(() => {
    runWorkflowMock.mockClear()
  })

  test('returns structured workflow failures and forwards stateless mode', async () => {
    const result = await code({
      task: 'Generate the requested file.',
      mode: 'direct',
      interactive: false,
      skipFix: true,
      allowedWritePaths: ['tests/generated.rs'],
      stateless: true,
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
      allowedWritePaths: ['tests/generated.rs'],
      stateless: true,
    })
    expect(options).toMatchObject({
      commandName: 'code',
      interactive: false,
      structuredErrors: true,
    })
  })
})
