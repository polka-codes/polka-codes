import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rename, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { parseGitDiffNameStatus, parseGitDiffNumStat, parseGitStatus } from './workflow.utils'

test('real Git rename records preserve both paths and align destination statistics', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'git-paths-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  const names = ['ordinary', 'a space', 'a\ttab', 'a"quote', 'an -> arrow', '你好', 'a\nnewline']
  try {
    git('init', '-q')
    for (const name of names) await writeFile(join(dir, `old-${name}`), `${name.repeat(10)}\n`)
    git('add', '--all')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial')
    for (const name of names) {
      await rename(join(dir, `old-${name}`), join(dir, `new-${name}`))
      await writeFile(join(dir, `new-${name}`), `${name.repeat(10)}\nadded\n`)
    }
    git('add', '--all')
    const status = parseGitStatus(git('status', '--porcelain=v1', '-z'))
    const diff = parseGitDiffNameStatus(git('diff', '--cached', '--name-status', '-z'))
    const stats = parseGitDiffNumStat(git('diff', '--cached', '--numstat', '-z'))
    expect(status).toHaveLength(names.length)
    expect(diff).toHaveLength(names.length)
    for (const name of names) {
      const paths = { path: `new-${name}`, originalPath: `old-${name}` }
      expect(status).toContainEqual({ ...paths, status: 'Renamed (staged)' })
      expect(diff).toContainEqual({ ...paths, status: 'Renamed' })
      expect(stats[`new-${name}`]).toEqual({ insertions: 1, deletions: 0 })
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
