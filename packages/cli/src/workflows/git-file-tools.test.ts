import { describe, expect, test } from 'bun:test'
import { createGitAwareDiff, createGitListFiles, createGitReadBinaryFile, createGitReadFile } from './git-file-tools'

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
