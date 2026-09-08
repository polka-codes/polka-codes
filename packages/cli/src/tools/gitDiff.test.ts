import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getProvider } from '@polka-codes/cli-shared'
import { handler, toolInfo } from './gitDiff'

describe('git_diff tool contract', () => {
  test('requires one file and applies diff defaults', () => {
    expect(toolInfo.parameters.parse({ file: 'src/file.ts' })).toEqual({
      file: 'src/file.ts',
      staged: false,
      contextLines: 5,
      includeLineNumbers: true,
    })
  })

  test('accepts boolean strings and rejects invalid bounds', () => {
    expect(toolInfo.parameters.parse({ file: 'src/file.ts', staged: 'true', includeLineNumbers: 'false' })).toMatchObject({
      staged: true,
      includeLineNumbers: false,
    })
    expect(toolInfo.parameters.safeParse({ file: ' ' }).success).toBe(false)
    expect(toolInfo.parameters.safeParse({ file: 'src/file.ts', contextLines: -1 }).success).toBe(false)
    expect(toolInfo.parameters.safeParse({ file: 'src/file.ts', contextLines: 1.5 }).success).toBe(false)
    expect(toolInfo.parameters.safeParse({ file: 'src/file.ts', commitRange: ' ' }).success).toBe(false)
    expect(toolInfo.parameters.safeParse({ file: 'src/file.ts', commitRange: '--output=outside.txt' }).success).toBe(false)
  })

  test('requires direct program execution instead of falling back to a shell', async () => {
    const result = await handler(
      {
        executeCommand: async () => {
          throw new Error('Shell execution must not be used')
        },
      },
      { file: 'file.txt' },
    )
    expect(result.success).toBe(false)
    expect(result.message).toEqual({ type: 'error-text', value: 'This provider does not support direct program execution.' })
  })

  test.each(["a file's name.txt", 'literal[ab].txt', '--flag.txt', ' padded name.txt '])(
    'keeps revisions and the filename literal: %s',
    async (file) => {
      const directory = await mkdtemp(join(tmpdir(), 'git-diff-arguments-'))
      const originalCwd = process.cwd()
      try {
        const git = (...args: string[]) => {
          const result = Bun.spawnSync(['git', '--literal-pathspecs', ...args], { cwd: directory })
          if (result.exitCode !== 0) throw new Error(result.stderr.toString())
        }
        git('init', '-q')
        await writeFile(join(directory, file), 'before\n')
        await writeFile(join(directory, 'literala.txt'), 'sibling before\n')
        git('add', '--', file, 'literala.txt')
        git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial')
        await writeFile(join(directory, file), 'after\n')
        await writeFile(join(directory, 'literala.txt'), 'unrelated sibling change\n')
        process.chdir(directory)
        const provider = getProvider()

        const valid = await handler(provider, { file, commitRange: 'HEAD', includeLineNumbers: false })
        expect(valid.success).toBe(true)
        expect(JSON.stringify(valid.message)).toContain('+after')
        expect(JSON.stringify(valid.message)).not.toContain('unrelated sibling change')

        git('add', '--', file, 'literala.txt')
        const staged = await handler(provider, { file, staged: true, includeLineNumbers: false })
        expect(staged.success).toBe(true)
        expect(JSON.stringify(staged.message)).toContain('+after')
        expect(JSON.stringify(staged.message)).not.toContain('unrelated sibling change')
        git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'change')
        const range = await handler(provider, { file, commitRange: 'HEAD~1..HEAD', includeLineNumbers: false })
        expect(range.success).toBe(true)
        expect(JSON.stringify(range.message)).toContain('+after')

        for (const commitRange of ['HEAD; : > injected.txt #', "HEAD'; : > injected.txt #", 'HEAD$(: > injected.txt)']) {
          const invalid = await handler(provider, { file, commitRange, includeLineNumbers: false })
          expect(invalid.success).toBe(false)
          expect(existsSync(join(directory, 'injected.txt'))).toBe(false)
        }
        await expect(handler(provider, { file, commitRange: '--output=injected.txt' })).rejects.toThrow('must not start with a dash')
        expect(existsSync(join(directory, 'injected.txt'))).toBe(false)
      } finally {
        process.chdir(originalCwd)
        await rm(directory, { recursive: true, force: true })
      }
    },
  )
})
