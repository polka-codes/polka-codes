import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./test-fixtures/run-workflow-memory.ts', import.meta.url))

test('workflow memory initialization rejects escaped paths without creating directories', async () => {
  const root = await mkdtemp(join(tmpdir(), 'workflow-memory-'))
  const home = join(root, 'home')
  const configDir = join(home, '.config/polkacodes')
  await mkdir(configDir, { recursive: true })
  const run = async (path: string) => {
    await writeFile(join(configDir, 'config.yml'), `memory:\n  enabled: true\n  type: sqlite\n  path: ${JSON.stringify(path)}\n`)
    const child = Bun.spawn([process.execPath, fixture], {
      cwd: root,
      env: { ...process.env, HOME: home },
      stdout: 'pipe',
      stderr: 'pipe',
    })
    const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
    expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
    return JSON.parse(stdout)
  }
  try {
    expect(await run('~/../outside/memory.sqlite')).toMatchObject({
      success: false,
      reason: expect.stringContaining('Memory path must not escape the home directory'),
    })
    expect(await readdir(root)).toEqual(['home'])
    expect(await run('~/nested/memory.sqlite')).toEqual({ success: true })
    expect(await Bun.file(join(home, 'nested/memory.sqlite')).exists()).toBe(true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
