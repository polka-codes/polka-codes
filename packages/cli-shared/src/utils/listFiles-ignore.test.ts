import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { listFiles } from './listFiles'

test('nested ignores agree with Git for root and direct subdirectory listings', async () => {
  const root = await mkdtemp(join(tmpdir(), 'list-ignore-'))
  const files: Record<string, string> = {
    '.gitignore': '*.log\nblocked/\n',
    'sub/.gitignore': '/build/\ncache/data.txt\n!keep.log\n',
    'sub/build/ignored.txt': '',
    'sub/deep/build/kept.txt': '',
    'sub/cache/data.txt': '',
    'sub/deep/cache/data.txt': '',
    'sub/keep.log': '',
    'sub/drop.log': '',
    'sub/deep/.gitignore': '!keep.log\n',
    'sub/deep/keep.log': '',
    'sub/blocked/.gitignore': '!keep.log\n',
    'sub/blocked/keep.log': '',
    'sub/explicit.txt': '',
  }
  try {
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(root, path)), { recursive: true })
      await writeFile(join(root, path), content)
    }
    const init = Bun.spawn(['git', 'init', '-q'], { cwd: root })
    expect(await init.exited).toBe(0)
    const git = Bun.spawn(['git', 'ls-files', '--others', '--exclude-standard', '-z'], { cwd: root, stdout: 'pipe' })
    const expected = (await new Response(git.stdout).text()).split('\0').filter(Boolean).sort()
    expect(await git.exited).toBe(0)
    expect((await listFiles(root, true, 100, root))[0]).toEqual(expected)
    expect((await listFiles(join(root, 'sub'), true, 100, root))[0]).toEqual(expected.filter((path) => path.startsWith('sub/')))
    expect((await listFiles(join(root, 'sub/deep'), true, 100, root))[0]).toEqual(expected.filter((path) => path.startsWith('sub/deep/')))
    expect((await listFiles(join(root, 'sub/blocked'), true, 100, root))[0]).toEqual([])
    const [included] = await listFiles(join(root, 'sub'), true, 100, root, ['**/explicit.txt'], true)
    expect(included).toEqual(
      Object.keys(files)
        .filter((path) => path.startsWith('sub/') && path !== 'sub/explicit.txt')
        .sort(),
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
