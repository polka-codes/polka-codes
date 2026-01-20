import { describe, expect, test } from 'bun:test'
import { parseGitDiffNumStat } from './workflow.utils'

describe('parseGitDiffNumStat', () => {
  test('parses standard changes', () => {
    const output = '1\t2\tpath/to/file.ts\n'
    const result = parseGitDiffNumStat(output)

    // Verify the file was parsed with correct stats
    expect(result).toEqual({
      'path/to/file.ts': { insertions: 1, deletions: 2 },
    })
  })

  test('parses binary files', () => {
    const output = '-\t-\tpath/to/image.png\n'
    const result = parseGitDiffNumStat(output)

    // Binary files are represented with 0 insertions/deletions
    expect(result).toEqual({
      'path/to/image.png': { insertions: 0, deletions: 0 },
    })
  })

  test('parses quoted paths', () => {
    const output = '1\t1\t"path/to/file with spaces.ts"\n'
    const result = parseGitDiffNumStat(output)

    // Quoted paths should be unquoted
    expect(result).toEqual({
      'path/to/file with spaces.ts': { insertions: 1, deletions: 1 },
    })
  })

  test('handles rename entries gracefully (invalid json-like string)', () => {
    const output = '0\t0\t"old" -> "new"\n'
    const result = parseGitDiffNumStat(output)

    // Invalid JSON-like strings should be preserved as-is
    expect(result).toEqual({
      '"old" -> "new"': { insertions: 0, deletions: 0 },
    })
  })

  test('parses paths containing tabs', () => {
    const output = '1\t1\tpath/part1\tpath/part2.ts\n'
    const result = parseGitDiffNumStat(output)

    // Paths with tabs should be reconstructed correctly
    expect(result).toEqual({
      'path/part1\tpath/part2.ts': { insertions: 1, deletions: 1 },
    })
  })
})
