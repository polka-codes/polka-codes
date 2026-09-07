import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { type WsIncomingMessage, wsOutgoingMessageSchema } from './types'

async function runRunnerProcess(onConnected: WsIncomingMessage | 'reject') {
  const directory = await mkdtemp(join(tmpdir(), 'runner-lifecycle-'))
  // Run ws under Node, the production runtime; Bun's ws close-handshake cleanup can hang.
  const fixture = Bun.spawn(
    [
      'node',
      fileURLToPath(new URL('./test-fixtures/run-runner-session.cjs', import.meta.url)),
      process.execPath,
      directory,
      JSON.stringify(onConnected),
    ],
    { stdout: 'pipe', stderr: 'pipe' },
  )
  try {
    const [exitCode, stdout, stderr] = await Promise.all([
      fixture.exited,
      new Response(fixture.stdout).text(),
      new Response(fixture.stderr).text(),
    ])
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    return z
      .object({
        exitCode: z.number().int().nullable(),
        messages: z.array(wsOutgoingMessageSchema),
        stdout: z.string(),
        stderr: z.string(),
      })
      .parse(JSON.parse(stdout))
  } finally {
    fixture.kill()
    await rm(directory, { recursive: true, force: true })
  }
}

function commands(...commands: string[]): WsIncomingMessage {
  return {
    type: 'pending_tools',
    step: 1,
    requests: commands.map((command, index) => ({ index, tool: 'executeCommand', params: { command } })),
  }
}

describe('runner process completion', () => {
  test('reports successful command results and exits zero after done', async () => {
    const result = await runRunnerProcess(commands('printf ok'))
    expect(result.messages.at(-1)).toMatchObject({
      type: 'pending_tools_response',
      responses: [{ response: { stdout: 'ok', exitCode: 0 } }],
    })
    expect(result.exitCode).toBe(0)
  })

  test('reports failures and skipped commands before exiting nonzero', async () => {
    const result = await runRunnerProcess(commands('exit 7', 'echo must-not-run'))
    expect(result.messages.at(-1)).toMatchObject({
      type: 'pending_tools_response',
      responses: [{ response: { exitCode: 7 } }, { response: { exitCode: null } }],
    })
    expect(result.exitCode).toBe(1)
  })

  test('delivers a processing error and exits without requiring a done response', async () => {
    const result = await runRunnerProcess({
      type: 'pending_tools',
      step: 1,
      requests: [{ index: 0, tool: 'executeCommand', params: { command: 42 } }],
    })
    expect(result.messages.at(-1)).toMatchObject({ type: 'error', message: 'Failed to process message' })
    expect(result.exitCode).toBe(1)
  })

  test('does not reconnect after a protocol rejection', async () => {
    const result = await runRunnerProcess('reject')
    expect(result.messages).toEqual([{ type: 'connected' }])
    expect(result.exitCode).toBe(1)
    expect(result.stdout).not.toContain('Attempting to reconnect')
  })
})
