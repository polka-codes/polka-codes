import { describe, expect, test } from 'bun:test'
import { getProvider } from '@polka-codes/cli-shared'
import { executeRunnerCommands } from './commands'
import { RUNNER_OUTPUT_MAX_JSON_BYTES } from './output'
import { type WsOutgoingMessage, wsOutgoingMessageSchema } from './types'

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
        { index: 0, response: { stdout: 'ok', stderr: '', exitCode: 0, outputTruncated: false } },
        { index: 1, response: { stdout: '', stderr: 'failed', exitCode: 7, outputTruncated: false } },
        {
          index: 2,
          response: { stdout: '', stderr: 'Skipped because an earlier command failed.', exitCode: null, outputTruncated: false },
        },
      ],
    })
  })

  test.each(['stdout', 'stderr'] as const)('marks the result when only %s is truncated', async (stream) => {
    const [result] = await executeRunnerCommands(
      [{ index: 0, tool: 'executeCommand', params: { command: 'noisy command' } }],
      async () => ({ stdout: 'out', stderr: 'err', exitCode: 0, [stream]: 'x'.repeat(40_000) }),
    )
    expect(result.response.outputTruncated).toBe(true)
    expect(result.response[stream]).toStartWith('[runner output truncated:')
    expect(result.response[stream === 'stdout' ? 'stderr' : 'stdout']).toBe(stream === 'stdout' ? 'err' : 'out')
  })

  test('keeps a full ten-command batch below the app field and frame limits, including JSON escaping', async () => {
    const output = '\u0000\n\t"\\🙂'.repeat(20_000)
    const responses = await executeRunnerCommands(
      Array.from({ length: 10 }, (_, index) => ({ index, tool: 'executeCommand', params: { command: 'noisy command' } })),
      async () => ({ stdout: output, stderr: output, exitCode: 0 }),
    )
    const message = { type: 'pending_tools_response', step: 1, responses } satisfies WsOutgoingMessage
    expect(wsOutgoingMessageSchema.parse(message)).toEqual(message)
    expect(Buffer.byteLength(JSON.stringify(message))).toBeLessThanOrEqual(256 * 1024)
    expect(responses).toHaveLength(10)
    for (const { response } of responses) {
      expect(response.outputTruncated).toBe(true)
      expect(response.exitCode).toBe(0)
      for (const stream of [response.stdout, response.stderr]) {
        expect(Buffer.byteLength(JSON.stringify(stream))).toBeLessThanOrEqual(RUNNER_OUTPUT_MAX_JSON_BYTES)
        expect(Buffer.byteLength(stream)).toBeLessThanOrEqual(32 * 1024)
      }
    }
  })
})
