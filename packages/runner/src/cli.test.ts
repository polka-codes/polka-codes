import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { access, mkdir, mkdtemp, rename, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { z } from 'zod'
import { type WsIncomingMessage, wsOutgoingMessageSchema } from './types'

let runnerCli: string
let buildDirectory: string

beforeAll(async () => {
  buildDirectory = await mkdtemp(join(tmpdir(), 'runner-cli-build-'))
  // Exercise Node's ws implementation, including HTTP upgrade rejection events.
  const build = await Bun.build({
    entrypoints: [fileURLToPath(new URL('./cli.ts', import.meta.url))],
    target: 'node',
    outdir: buildDirectory,
  })
  expect(build.success).toBe(true)
  runnerCli = join(buildDirectory, 'cli.js')
})

afterAll(async () => {
  await rm(buildDirectory, { recursive: true, force: true })
})

interface AuthScenario {
  tokenFailure?: 'missing-url' | 'missing-token' | 'http' | 'json' | 'empty'
  tokenFailureAt?: number
  upgradeStatus?: number
  upgradeFailureAt?: number
  policyRejectAt?: number
}

async function runRunnerProcess(
  onConnected: WsIncomingMessage | 'reject' | 'reconnect',
  setup?: (directory: string) => Promise<void>,
  githubToken?: string,
  scenario: AuthScenario = {},
) {
  const directory = await mkdtemp(join(tmpdir(), 'runner-lifecycle-'))
  let fixture: Bun.Subprocess<'ignore', 'pipe', 'pipe'> | undefined
  try {
    await setup?.(directory)
    // Run ws under Node, the production runtime; Bun's ws close-handshake cleanup can hang.
    fixture = Bun.spawn(
      [
        'node',
        fileURLToPath(new URL('./test-fixtures/run-runner-session.cjs', import.meta.url)),
        'node',
        runnerCli,
        directory,
        JSON.stringify({ onConnected, githubToken, ...scenario }),
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    const [exitCode, stdout, stderr] = await Promise.all([
      fixture.exited,
      new Response(fixture.stdout).text(),
      new Response(fixture.stderr).text(),
    ])
    expect({ exitCode, stderr }).toEqual({ exitCode: 0, stderr: '' })
    const credentialsSchema = z.object({ sessionToken: z.string(), oidcToken: z.string(), githubToken: z.string().optional() })
    const result = z
      .object({
        exitCode: z.number().int().nullable(),
        api: z.string(),
        tokenRequests: z.array(z.object({ audience: z.string(), authorization: z.string() })),
        upgrades: z.array(credentialsSchema),
        connections: z.array(credentialsSchema),
        messages: z.array(wsOutgoingMessageSchema),
        stdout: z.string(),
        stderr: z.string(),
      })
      .parse(JSON.parse(stdout))
    for (const request of result.tokenRequests) {
      expect(request).toEqual({ audience: `${result.api}/api/ws/runner/lifecycle-test`, authorization: 'Bearer request-secret' })
    }
    for (const [index, upgrade] of result.upgrades.entries()) {
      expect(upgrade).toEqual({ sessionToken: 'test-token', oidcToken: `oidc-token-${index + 1}` })
    }
    for (const secret of ['test-token', 'request-secret', 'url-secret', 'response-secret', 'oidc-token-']) {
      expect(result.stdout + result.stderr).not.toContain(secret)
    }
    return result
  } finally {
    fixture?.kill()
    await rm(directory, { recursive: true, force: true })
  }
}

describe('runner CLI options', () => {
  test('shows the session credential and API options without a GitHub token option', () => {
    const result = Bun.spawnSync(['node', runnerCli, '--help'])
    expect(result.exitCode).toBe(0)
    const help = result.stdout.toString()
    expect(help).toContain('--task-id <id>')
    expect(help).toContain('--session-token <token>')
    expect(help).toContain('--api <url>')
    expect(help).not.toContain('--github-token')
  })

  test.each([
    { args: ['--task-id', 'test'], error: "required option '--session-token <token>' not specified" },
    {
      args: ['--task-id', 'test', '--session-token', 'test-token', '--api', 'http://127.0.0.1:1', '--github-token', 'unused'],
      error: "unknown option '--github-token'",
    },
  ])('rejects $error', ({ args, error }) => {
    const result = Bun.spawnSync(['node', runnerCli, ...args])
    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain(error)
    expect(result.stdout.toString()).not.toContain('Attempting to connect')
  })
})

test('cleans up the runner workspace when setup fails', async () => {
  let directory = ''
  try {
    await expect(
      runRunnerProcess({ type: 'done' }, async (path) => {
        directory = path
        throw new Error('Workspace setup failed')
      }),
    ).rejects.toThrow('Workspace setup failed')
    await expect(access(directory)).rejects.toThrow('ENOENT')
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

function commands(...commands: string[]): WsIncomingMessage {
  return {
    type: 'pending_tools',
    step: 1,
    requests: commands.map((command, index) => ({ index, tool: 'executeCommand', params: { command } })),
  }
}

describe('runner process completion', () => {
  test('runs without GITHUB_TOKEN and reports successful command results before exiting zero', async () => {
    const result = await runRunnerProcess(commands('test -z "$GITHUB_TOKEN" && printf ok && printf diagnostic >&2'))
    expect(result.messages.at(-1)).toMatchObject({
      type: 'pending_tools_response',
      responses: [{ response: { stdout: 'ok', stderr: 'diagnostic', exitCode: 0 } }],
    })
    expect(result.exitCode).toBe(0)
  })

  test('keeps GITHUB_TOKEN available to commands without forwarding it in the handshake', async () => {
    const result = await runRunnerProcess(commands('printf "%s" "$GITHUB_TOKEN"'), undefined, 'command-github-token')
    expect(result.messages.at(-1)).toMatchObject({
      type: 'pending_tools_response',
      responses: [{ response: { stdout: 'command-github-token', exitCode: 0 } }],
    })
    expect(result.exitCode).toBe(0)
  })

  test('authenticates reconnects with a fresh OIDC token and the session token', async () => {
    const result = await runRunnerProcess('reconnect')
    expect(result.connections).toHaveLength(2)
    expect(result.tokenRequests).toHaveLength(2)
    expect(result.messages).toEqual([{ type: 'connected' }, { type: 'connected' }])
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

describe('runner authentication failures', () => {
  test.each(['missing-url', 'missing-token', 'http', 'json', 'empty'] as const)(
    'fails closed on %s acquisition failure',
    async (tokenFailure) => {
      const result = await runRunnerProcess({ type: 'done' }, undefined, 'independent-github-token', { tokenFailure })
      expect(result.exitCode).toBe(1)
      expect(result.tokenRequests).toHaveLength(tokenFailure.startsWith('missing') ? 0 : 1)
      expect(result.upgrades).toHaveLength(0)
      expect(result.connections).toHaveLength(0)
      expect(result.messages).toEqual([])
      expect(result.stderr).toContain('Runner startup failed:')
      expect(result.stdout).not.toContain('Attempting to reconnect')
      if (tokenFailure.startsWith('missing')) expect(result.stderr).toContain('id-token: write')
    },
  )

  test.each([401, 403])('treats HTTP %i during initial upgrade as terminal', async (upgradeStatus) => {
    const result = await runRunnerProcess({ type: 'done' }, undefined, undefined, { upgradeStatus })
    expect(result.exitCode).toBe(1)
    expect(result.tokenRequests).toHaveLength(1)
    expect(result.upgrades).toHaveLength(1)
    expect(result.connections).toHaveLength(0)
    expect(result.stderr).toContain(`Runner authentication rejected (HTTP ${upgradeStatus})`)
    expect(result.stdout).not.toContain('Attempting to reconnect')
  })

  test.each([401, 403])('does not retry after HTTP %i rejects a reconnect', async (upgradeStatus) => {
    const result = await runRunnerProcess('reconnect', undefined, undefined, { upgradeStatus, upgradeFailureAt: 2 })
    expect(result.exitCode).toBe(1)
    expect(result.tokenRequests).toHaveLength(2)
    expect(result.upgrades).toHaveLength(2)
    expect(result.connections).toHaveLength(1)
    expect(result.stderr).toContain(`Runner authentication rejected (HTTP ${upgradeStatus})`)
  })

  test('does not retry failed token acquisition during reconnect', async () => {
    const result = await runRunnerProcess('reconnect', undefined, undefined, { tokenFailure: 'http', tokenFailureAt: 2 })
    expect(result.exitCode).toBe(1)
    expect(result.tokenRequests).toHaveLength(2)
    expect(result.upgrades).toHaveLength(1)
    expect(result.stderr).toContain('Runner reconnect failed: GitHub OIDC token request failed (HTTP 403).')
  })

  test('does not reconnect after a policy rejection on the second connection', async () => {
    const result = await runRunnerProcess('reconnect', undefined, undefined, { policyRejectAt: 2 })
    expect(result.exitCode).toBe(1)
    expect(result.tokenRequests).toHaveLength(2)
    expect(result.connections).toHaveLength(2)
    expect(result.stderr).toContain('Runner protocol rejected')
  })

  test('cleans up an HTTP 503 upgrade and retains transport retries', async () => {
    const result = await runRunnerProcess('reconnect', undefined, undefined, { upgradeStatus: 503, upgradeFailureAt: 2 })
    expect(result.exitCode).toBe(0)
    expect(result.tokenRequests).toHaveLength(3)
    expect(result.upgrades).toHaveLength(3)
    expect(result.connections).toHaveLength(2)
    expect(result.messages).toEqual([{ type: 'connected' }, { type: 'connected' }])
    expect(result.stderr).toContain('WebSocket upgrade failed (HTTP 503)')
    expect(result.stderr).not.toContain('WebSocket was closed before the connection was established')
  }, 10000)
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
