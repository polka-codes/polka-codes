import { describe, expect, test } from 'bun:test'
import { toolInfo } from './gitDiff'

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
  })
})
