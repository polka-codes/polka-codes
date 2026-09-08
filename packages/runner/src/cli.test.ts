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
  return new Response(child.stdout).text()
}

async function addSubmodule(dir: string) {
  await git(dir, 'init', '-q')
  await git(dir, 'init', '-q', 'module')
  const module = join(dir, 'module')
  await writeFile(join(module, 'file.txt'), 'original')
  await git(module, 'add', '--all')
  await git(module, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'module')
  const head = (await git(module, 'rev-parse', 'HEAD')).trim()
  await git(dir, 'update-index', '--add', '--cacheinfo', `160000,${head},module`)
  await git(dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial')
  return module
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

test('synchronizes every submodule file with its exact path', async () => {
  const names = ['file.txt', 'a file.txt', '你好.txt', 'line\nbreak.txt', 'nested/file.txt']
  if (process.platform !== 'win32') names.push('slash\\name.txt')
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    await mkdir(join(module, 'nested'))
    for (const name of names) await writeFile(join(module, name), name)
    for (let i = 0; i < 1001; i++) await writeFile(join(module, `extra-${i}.txt`), 'extra')
  })
  expect(result.exitCode).toBe(0)
  expect(result.messages.at(-1)).toEqual({ type: 'get_files_completed' })
  const files = result.messages.filter((message) => message.type === 'file')
  expect(files).toHaveLength(names.length + 1001)
  for (const name of names) expect(files.find((message) => message.path === `module/${name}`)?.content).toBe(name)
})

test('does not complete synchronization when a submodule file is unreadable', async () => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    await symlink('missing-target', join(module, 'broken-link'))
  })
  expect(result.exitCode).toBe(1)
  expect(result.messages.at(-1)).toMatchObject({ type: 'error', message: 'Failed to synchronize changed files' })
  expect(result.messages.some((message) => message.type === 'get_files_completed')).toBe(false)
})

test('synchronizes tracked submodule files even when file-search rules ignore them', async () => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    await mkdir(join(module, 'dist'))
    await writeFile(join(module, '.gitignore'), 'ignored.txt\n')
    await writeFile(join(module, 'dist', 'tracked.js'), 'tracked build')
    await writeFile(join(module, 'ignored.txt'), 'tracked despite ignore')
    await git(module, 'add', '-f', 'dist/tracked.js', 'ignored.txt', '.gitignore')
    await writeFile(join(module, 'ignored-untracked.txt'), 'not tracked')
    await writeFile(join(module, '.gitignore'), 'ignored*.txt\n')
  })
  expect(result.exitCode).toBe(0)
  const files = result.messages.filter((message) => message.type === 'file')
  expect(files.find((message) => message.path === 'module/dist/tracked.js')?.content).toBe('tracked build')
  expect(files.find((message) => message.path === 'module/ignored.txt')?.content).toBe('tracked despite ignore')
  expect(files.some((message) => message.path === 'module/ignored-untracked.txt')).toBe(false)
})

test.each(['unstaged', 'staged', 'committed'])('synchronizes %s submodule deletions', async (state) => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    await rm(join(module, 'file.txt'))
    if (state !== 'unstaged') await git(module, 'add', '--all')
    if (state === 'committed') await git(module, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'delete')
  })
  expect(result.exitCode).toBe(0)
  expect(result.messages).toContainEqual({ type: 'file_deleted', path: 'module/file.txt' })
  expect(result.messages.at(-1)).toEqual({ type: 'get_files_completed' })
})

test('synchronizes a submodule file recreated after its staged deletion', async () => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    await git(module, 'rm', '--cached', '-q', 'file.txt')
    await writeFile(join(module, 'file.txt'), 'recreated')
  })
  expect(result.exitCode).toBe(0)
  expect(result.messages).toContainEqual({ type: 'file', path: 'module/file.txt', content: 'recreated' })
  expect(result.messages).not.toContainEqual({ type: 'file_deleted', path: 'module/file.txt' })
})

test('synchronizes a submodule file replaced with a directory', async () => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    await git(module, 'rm', '-q', 'file.txt')
    await mkdir(join(module, 'file.txt'))
    await writeFile(join(module, 'file.txt', 'child.txt'), 'child')
  })
  expect(result.exitCode).toBe(0)
  expect(result.messages).toContainEqual({ type: 'file_deleted', path: 'module/file.txt' })
  expect(result.messages).toContainEqual({ type: 'file', path: 'module/file.txt/child.txt', content: 'child' })
})

test('synchronizes nested submodules against the original parent commit', async () => {
  const result = await runRunnerProcess({ type: 'get_files' }, async (dir) => {
    const module = await addSubmodule(dir)
    const nested = await addSubmodule(module)
    await git(dir, 'add', 'module')
    await git(dir, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'record nested module')
    await git(nested, 'mv', 'file.txt', 'new\nname.txt')
    await git(nested, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'rename')
    await git(module, 'add', 'module')
    await git(module, '-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'update nested module')
  })
  expect(result.exitCode).toBe(0)
  expect(result.messages).toContainEqual({ type: 'file_deleted', path: 'module/module/file.txt' })
  expect(result.messages).toContainEqual({ type: 'file', path: 'module/module/new\nname.txt', content: 'original' })
  expect(result.messages.at(-1)).toEqual({ type: 'get_files_completed' })
})
