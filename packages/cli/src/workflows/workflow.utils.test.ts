import { describe, expect, test } from 'bun:test'
import { formatReviewForConsole, getAgentWorkflowFailureMessage, parseGitDiffNumStat, specificReviewSchema } from './workflow.utils'

describe('getAgentWorkflowFailureMessage', () => {
  test('preserves agent error messages', () => {
    expect(
      getAgentWorkflowFailureMessage({
        type: 'Error',
        error: { message: 'provider unavailable' },
        messages: [],
      }),
    ).toBe('provider unavailable')
  })

  test('describes usage exhaustion', () => {
    expect(getAgentWorkflowFailureMessage({ type: 'UsageExceeded', messages: [] })).toBe('Usage limits were exceeded.')
  })
})

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

describe('review output formatting', () => {
  test('requires GitHub line anchors', () => {
    const review = {
      file: 'packages/shared/src/fellowship.ts',
      review: 'The changed branch can return stale data.',
    }

    expect(specificReviewSchema.safeParse({ ...review, lines: 'L333' }).success).toBe(true)
    expect(specificReviewSchema.safeParse({ ...review, lines: 'L333-L356' }).success).toBe(true)
    expect(specificReviewSchema.safeParse({ ...review, lines: '[Lines 333-356]' }).success).toBe(false)
    expect(specificReviewSchema.safeParse({ ...review, lines: '333-356' }).success).toBe(false)
  })

  test('formats file locations as GitHub anchors', () => {
    const formatted = formatReviewForConsole({
      overview: 'One issue found.',
      specificReviews: [
        {
          file: 'packages/shared/src/fellowship.ts',
          lines: 'L333-L356',
          review: 'The changed branch can return stale data.',
        },
      ],
    })

    expect(formatted).toContain('- packages/shared/src/fellowship.ts#L333-L356')
    expect(formatted).not.toContain('packages/shared/src/fellowship.ts:[Lines 333-356]')
  })
})
