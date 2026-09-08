import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { searchFiles } from './searchFiles'

describe('searchFiles', () => {
  let directory: string

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'polka-search-'))
    await mkdir(join(directory, 'subdir'))
    for (const file of ['file1.txt', 'file2.txt', 'excluded.txt', 'subdir/file3.txt', 'subdir/excluded-too.txt']) {
      await writeFile(join(directory, file), 'SEARCHABLE content\n')
    }
  })

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  test('searches dash-prefixed patterns and paths as data', async () => {
    await writeFile(join(directory, '--flag.txt'), 'literal --needle value\n')
    expect(await searchFiles('--flag.txt', '--needle', '*', directory)).toEqual(['--flag.txt:1:literal --needle value'])
    expect(await searchFiles('--flag.txt', '--absent', '*', directory)).toEqual([])
  })

  test('keeps long Unicode matches on one result line', async () => {
    const content = `MATCH ${'é'.repeat(200000)}`
    await writeFile(join(directory, 'large.txt'), content)
    expect(await searchFiles('large.txt', 'MATCH', '*', directory)).toEqual([`large.txt:1:${content}`])
  })

  test('preserves carriage returns within matched content', async () => {
    await writeFile(join(directory, 'control.txt'), 'MATCH before\rafter\n')
    expect(await searchFiles('control.txt', 'MATCH', '*', directory)).toEqual(['control.txt:1:MATCH before\rafter'])
  })

  test('searches comma-separated file patterns', async () => {
    const results = await searchFiles('.', 'SEARCHABLE', 'file1.txt, file2.txt', directory)
    expect(results.filter((line) => line !== '--').sort()).toEqual(['./file1.txt:1:SEARCHABLE content', './file2.txt:1:SEARCHABLE content'])
  })

  test('finds matching files recursively without exclusions', async () => {
    const results = await searchFiles('.', 'SEARCHABLE', '*.txt', directory)
    expect(results.filter((line) => line !== '--').sort()).toEqual([
      './excluded.txt:1:SEARCHABLE content',
      './file1.txt:1:SEARCHABLE content',
      './file2.txt:1:SEARCHABLE content',
      './subdir/excluded-too.txt:1:SEARCHABLE content',
      './subdir/file3.txt:1:SEARCHABLE content',
    ])
  })

  test.each([
    { excludes: ['excluded.txt', 'subdir/excluded-too.txt'], files: ['file1.txt', 'file2.txt', 'subdir/file3.txt'] },
    { excludes: ['**/excluded*.txt'], files: ['file1.txt', 'file2.txt', 'subdir/file3.txt'] },
    { excludes: ['subdir'], files: ['excluded.txt', 'file1.txt', 'file2.txt'] },
  ])('honors exclusions: $excludes', async ({ excludes, files }) => {
    const results = await searchFiles('.', 'SEARCHABLE', '*.txt', directory, excludes)
    expect(results.filter((line) => line !== '--').sort()).toEqual(files.map((file) => `./${file}:1:SEARCHABLE content`))
  })

  test('returns no results when the pattern does not match', async () => {
    expect(await searchFiles('.', 'nonexistent', '*.txt', directory)).toEqual([])
  })

  test('preserves ripgrep diagnostics for invalid patterns', async () => {
    await expect(searchFiles('.', 'bad(', '*.txt', directory)).rejects.toThrow('regex parse error')
  })

  test('reports missing search paths', async () => {
    await expect(searchFiles('missing', 'SEARCHABLE', '*', directory)).rejects.toThrow('Ripgrep process exited with code 2')
  })
})
