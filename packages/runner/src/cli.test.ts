import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { type WsIncomingMessage, wsOutgoingMessageSchema } from './types'

async function runRunnerProcess(onConnected: WsIncomingMessage | 'reject', setup?: (directory: string) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'runner-lifecycle-'))
  await setup?.(directory)
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

async function git(directory: string, ...args: string[]) {
  const child = Bun.spawn(['git', ...args], { cwd: directory, stdout: 'pipe', stderr: 'pipe' })
  const stderr = await new Response(child.stderr).text()
  expect({ code: await child.exited, stderr }).toEqual({ code: 0, stderr: '' })
}

test('synchronizes exact Git paths, renames, and staged files deleted from the working tree', async () => {
  const names = ['a file.txt', '你好.txt', 'line\nbreak.txt', 'arrow -> file.txt', ' space ', 'nested/file.txt']
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    await git(dir, 'init', '-q')
    await writeFile(join(dir, 'old -> name.txt'), 'rename')
    await writeFile(join(dir, 'deleted'), 'deleted')
    await git(dir, 'add', '--all')
    await git(dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial')
    await rename(join(dir, 'old -> name.txt'), join(dir, 'new\n你好.txt'))
    await rm(join(dir, 'deleted'))
    await writeFile(join(dir, 'added-then-deleted'), 'temporary')
    await git(dir, 'add', '--all')
    await rm(join(dir, 'added-then-deleted'))
    await mkdir(join(dir, 'nested'))
    for (const name of names) await writeFile(join(dir, name), name)
  })
  expect(result.exitCode).toBe(0)
  expect(result.messages.at(-1)).toEqual({ type: 'get_files_completed' })
  const files = result.messages.filter((message) => message.type === 'file')
  expect(files.map((message) => message.path).sort()).toEqual([...names, 'new\n你好.txt'].sort())
  expect(files.find((message) => message.path === 'new\n你好.txt')?.content).toBe('rename')
  expect(
    result.messages
      .filter((message) => message.type === 'file_deleted')
      .map((message) => message.path)
      .sort(),
  ).toEqual(['added-then-deleted', 'deleted', 'old -> name.txt'])
})

test('reports an unreadable required file without successful synchronization', async () => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    await git(dir, 'init', '-q')
    await symlink('missing-target', join(dir, 'broken-link'))
  })
  expect(result.exitCode).toBe(1)
  expect(result.messages.at(-1)).toMatchObject({ type: 'error', message: 'Failed to synchronize changed files' })
  expect(result.messages.some((message) => message.type === 'get_files_completed')).toBe(false)
})
