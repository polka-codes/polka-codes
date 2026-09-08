import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./test-fixtures/memory-path.ts', import.meta.url))

async function withHome(run: (root: string, home: string) => Promise<void>) {
  const root = await mkdtemp(join(tmpdir(), 'memory-path-'))
  const home = join(root, 'home')
  await mkdir(home)
  try {
    await run(root, home)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function writeMemory(root: string, path: string, environment: { HOME: string; USERPROFILE: string }) {
  const child = Bun.spawn([process.execPath, fixture, path], {
    cwd: root,
    env: { ...process.env, BUN_RUNTIME_TRANSPILER_CACHE_PATH: '0', ...environment },
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [code, stderr] = await Promise.all([child.exited, new Response(child.stderr).text()])
  return { code, stderr }
}

for (const variable of ['HOME', 'USERPROFILE'] as const) {
  test(`home-relative memory paths cannot escape ${variable} or create outside artifacts`, async () => {
    await withHome(async (root, home) => {
      const environment = { HOME: '', USERPROFILE: '', [variable]: home }
      for (const path of [
        '~/.config/polka-codes/../../../outside/memory.sqlite',
        '~/../home-sibling/memory.sqlite',
        '~sibling/memory.sqlite',
        '~/..',
      ]) {
        const result = await writeMemory(root, path, environment)
        expect(result.stderr).toContain('Memory path must not escape the home directory')
        expect(result.code).not.toBe(0)
        expect(await readdir(root)).toEqual(['home'])
        expect(await readdir(home)).toEqual([])
      }
    })
  })
}

test('valid home paths normalize inside HOME, which takes precedence over USERPROFILE', async () => {
  await withHome(async (root, home) => {
    const environment = { HOME: home, USERPROFILE: join(root, 'unused-profile') }
    for (const path of ['~/.config/memory.sqlite', '~/nested/../memory.sqlite', '~/..cache/memory.sqlite']) {
      expect(await writeMemory(root, path, environment)).toEqual({ code: 0, stderr: '' })
    }
    expect(await Bun.file(join(home, '.config/memory.sqlite')).exists()).toBe(true)
    expect(await Bun.file(join(home, 'memory.sqlite')).exists()).toBe(true)
    expect(await Bun.file(join(home, '..cache/memory.sqlite')).exists()).toBe(true)
    expect(await readdir(root)).toEqual(['home'])
  })
})

test('explicit absolute and relative database paths remain supported outside home', async () => {
  await withHome(async (root, home) => {
    const environment = { HOME: home, USERPROFILE: '' }
    for (const path of [join(root, 'absolute/memory.sqlite'), './relative/memory.sqlite']) {
      expect(await writeMemory(root, path, environment)).toEqual({ code: 0, stderr: '' })
    }
    expect(await Bun.file(join(root, 'absolute/memory.sqlite')).exists()).toBe(true)
    expect(await Bun.file(join(root, 'relative/memory.sqlite')).exists()).toBe(true)
  })
})

test('home-relative database paths fail without a configured home before creating artifacts', async () => {
  await withHome(async (root) => {
    const result = await writeMemory(root, '~/memory.sqlite', { HOME: '', USERPROFILE: '' })
    expect(result.stderr).toContain('Cannot resolve home directory')
    expect(result.code).not.toBe(0)
    expect(await readdir(root)).toEqual(['home'])
  })
})
