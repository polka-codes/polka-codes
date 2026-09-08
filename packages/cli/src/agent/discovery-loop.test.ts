import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const fixture = fileURLToPath(new URL('./test-fixtures/discovery-loop.ts', import.meta.url))
test.each(['build', 'typecheck', 'tests'])(
  'continuous discovery observes fresh %s failures once with unchanged HEAD',
  async (check) => {
    const dir = await mkdtemp(join(tmpdir(), 'discovery-loop-'))
    try {
      await writeFile(join(dir, 'source.txt'), 'broken')
      await writeFile(join(dir, 'build.ts'), "if ((await Bun.file('source.txt').text()) !== 'fixed') throw new Error('Broken source');")
      await writeFile(
        join(dir, 'check.test.ts'),
        check === 'tests'
          ? "import { expect, test } from 'bun:test'; console.log('Running project tests'); test('source is valid', async () => expect(await Bun.file('source.txt').text()).toBe('fixed'));"
          : "import { test } from 'bun:test'; test('passes', () => {});",
      )
      await writeFile(
        join(dir, 'package.json'),
        JSON.stringify({ scripts: { typecheck: 'true', build: 'true', [check]: 'bun build.ts', lint: 'true' } }),
      )
      execFileSync('git', ['init', '-q'], { cwd: dir })
      execFileSync('git', ['add', '--all'], { cwd: dir })
      execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], { cwd: dir })
      await mkdir(join(dir, '.polka/cache'), { recursive: true })
      const legacyCache = JSON.stringify({
        gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dir, encoding: 'utf8' }).trim(),
        timestamp: Date.now(),
        discoveredTasks: [],
      })
      await writeFile(join(dir, '.polka/cache/discovery-cache.json'), legacyCache)
      const child = Bun.spawn([process.execPath, fixture], { cwd: dir, stdout: 'pipe', stderr: 'pipe' })
      const [code, stdout, stderr] = await Promise.all([child.exited, new Response(child.stdout).text(), new Response(child.stderr).text()])
      expect({ code, stderr }).toEqual({ code: 0, stderr: '' })
      expect(stdout).toContain('FRESH_DISCOVERY_OK')
      expect(stdout.match(/Checking for build errors/g)).toHaveLength(3)
      expect(await readFile(join(dir, '.polka/cache/discovery-cache.json'), 'utf8')).toBe(legacyCache)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  },
  15000,
)
