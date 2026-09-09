import { describe, expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createGitAwareDiff, createGitListFiles, createGitReadBinaryFile, createGitReadFile } from './git-file-tools'

test('lists exact committed paths and can read them back', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'git-file-tools-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  const provider = {
    executeCommand: async (command: string) => ({
      stdout: execFileSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8' }),
      stderr: '',
      exitCode: 0,
    }),
  }
  try {
    git('init', '-q')
    const names = ['你好.txt', 'line\nbreak.txt', 'tab\tname.txt', 'comma,name.txt', ' padded.txt ']
    for (const name of names) await writeFile(join(dir, name), `content of ${name}`)
    git('add', '--all')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial')
    const listing = await createGitListFiles('HEAD').handler(provider, {})
    if (listing.message.type !== 'text') throw new Error('Expected a text file listing')
    for (const name of names) {
      expect(listing.message.value).toContain(`\n${name}\n`)
      const content = await createGitReadFile('HEAD').handler(provider, { path: [name] })
      expect(content.message).toMatchObject({ type: 'text', value: expect.stringContaining(`content of ${name}`) })
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('historical diffs select literal repository-relative paths from a subdirectory', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'git-file-tools-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  let cwd = dir
  const provider = {
    executeCommand: async (command: string) => ({
      stdout: execFileSync('sh', ['-c', command], { cwd, encoding: 'utf8' }),
      stderr: '',
      exitCode: 0,
    }),
  }
  try {
    git('init', '-q')
    await mkdir(join(dir, 'nested'))
    await writeFile(join(dir, '[x].txt'), 'literal content\n')
    await writeFile(join(dir, 'x.txt'), 'other content\n')
    await writeFile(join(dir, ' padded.txt '), 'padded content\n')
    await writeFile(join(dir, 'nested/child.txt'), 'child content\n')
    git('add', '--all')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial')
    for (cwd of [dir, join(dir, 'nested')]) {
      const diff = await createGitAwareDiff('HEAD').handler(provider, { file: '[x].txt', includeLineNumbers: false })
      if (diff.message.type !== 'text') throw new Error('Expected a text diff')
      expect(diff.message.value).toContain('+literal content')
      expect(diff.message.value).not.toContain('+other content')
      const padded = await createGitAwareDiff('HEAD').handler(provider, { file: ' padded.txt ', includeLineNumbers: false })
      expect(padded.message).toMatchObject({ type: 'text', value: expect.stringContaining('+padded content') })
      const listing = await createGitListFiles('HEAD').handler(provider, {})
      if (listing.message.type !== 'text') throw new Error('Expected a text file listing')
      expect(listing.message.value).toContain('\n[x].txt\n')
      expect(listing.message.value).toContain('\nnested/child.txt\n')
      const binary = await createGitReadBinaryFile('HEAD').handler(provider, { url: ' padded.txt ' })
      expect(binary.message).toMatchObject({ type: 'content', value: [{ data: Buffer.from('padded content\n').toString('base64') }] })
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

describe('historical git file tool contracts', () => {
  test('normalizes and requires text-file paths', () => {
    const tool = createGitReadFile('HEAD')

    expect(tool.parameters.parse({ path: 'src/one.ts, src/two.ts' })).toEqual({
      path: ['src/one.ts', 'src/two.ts'],
    })
    expect(tool.parameters.safeParse({ path: ' , ' }).success).toBe(false)
  })

  test('defaults and bounds the historical file listing limit', () => {
    const tool = createGitListFiles('HEAD')

    expect(tool.parameters.parse({})).toEqual({ maxCount: 2000 })
    expect(tool.parameters.safeParse({ maxCount: 0 }).success).toBe(false)
    expect(tool.parameters.safeParse({ maxCount: 1.5 }).success).toBe(false)
  })

  test('requires a non-empty binary file path', () => {
    const tool = createGitReadBinaryFile('HEAD')

    expect(tool.parameters.safeParse({ url: ' ' }).success).toBe(false)
  })

  test('requires one file and defaults historical diff options', () => {
    const tool = createGitAwareDiff('HEAD')

    expect(tool.parameters.parse({ file: 'src/file.ts' })).toEqual({
      file: 'src/file.ts',
      contextLines: 5,
      includeLineNumbers: true,
    })
    expect(tool.parameters.safeParse({ file: '' }).success).toBe(false)
    expect(tool.parameters.safeParse({ file: 'src/file.ts', contextLines: -1 }).success).toBe(false)
    expect(tool.parameters.safeParse({ file: 'src/file.ts', contextLines: 1.5 }).success).toBe(false)
  })
})
