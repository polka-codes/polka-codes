import { describe, expect, test } from 'bun:test'
import { getProvider } from '@polka-codes/cli-shared'
import { executeRunnerCommands } from './commands'
import { wsOutgoingMessageSchema } from './types'

describe('runner command protocol', () => {
  test('sends structured process results and does not execute commands after failure', async () => {
    const execute = getProvider({}).executeCommand
    if (!execute) throw new Error('Expected command provider')
    const responses = await executeRunnerCommands(
      [
        { index: 0, tool: 'executeCommand', params: { command: "printf 'ok'" } },
        { index: 1, tool: 'executeCommand', params: { command: "printf 'failed' >&2; exit 7" } },
        { index: 2, tool: 'executeCommand', params: { command: 'echo must-not-run' } },
      ],
      execute,
    )
    expect(wsOutgoingMessageSchema.parse({ type: 'pending_tools_response', step: 1, responses })).toMatchObject({
      responses: [
        { index: 0, response: { stdout: 'ok', stderr: '', exitCode: 0 } },
        { index: 1, response: { stdout: '', stderr: 'failed', exitCode: 7 } },
        { index: 2, response: { stdout: '', stderr: 'Skipped because an earlier command failed.', exitCode: null } },
      ],
    })
  })
})
