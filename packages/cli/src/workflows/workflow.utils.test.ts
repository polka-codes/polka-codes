import { describe, expect, test } from 'bun:test'
import { parseGitDiffNumStat } from './workflow.utils'

describe('parseGitDiffNumStat', () => {
  test('parses standard changes', () => {
    const output = '1\t2\tpath/to/file.ts\n'
    const result = parseGitDiffNumStat(output)
    expect(result).toMatchSnapshot()
  })

  test('parses binary files', () => {
    const output = '-\t-\tpath/to/image.png\n'
    const result = parseGitDiffNumStat(output)
    expect(result).toMatchSnapshot()
  })

  test('parses quoted paths', () => {
    const output = '1\t1\t"path/to/file with spaces.ts"\n'
    const result = parseGitDiffNumStat(output)
    expect(result).toMatchSnapshot()
  })

  test('handles rename entries gracefully (invalid json-like string)', () => {
    const output = '0\t0\t"old" -> "new"\n'
    const result = parseGitDiffNumStat(output)
    expect(result).toMatchSnapshot()
  })

  test('parses paths containing tabs', () => {
    const output = '1\t1\tpath/part1\tpath/part2.ts\n'
    const result = parseGitDiffNumStat(output)
    expect(result).toMatchSnapshot()
  })
})
