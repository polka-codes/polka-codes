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
})

describe('parseGitDiffNumStat', () => {
  test('parses standard changes', () => {
    const output = '1\t2\tpath/to/file.ts\0'
    const result = parseGitDiffNumStat(output)

    // Verify the file was parsed with correct stats
    expect(result).toEqual({
      'path/to/file.ts': { insertions: 1, deletions: 2 },
    })
  })

  test('parses binary files', () => {
    const output = '-\t-\tpath/to/image.png\0'
    const result = parseGitDiffNumStat(output)

    // Binary files are represented with 0 insertions/deletions
    expect(result).toEqual({
      'path/to/image.png': { insertions: 0, deletions: 0 },
    })
  })

  test('preserves literal quote characters', () => {
    const output = '1\t1\t"path/to/file with spaces.ts"\0'
    const result = parseGitDiffNumStat(output)

    // NUL-delimited output uses literal paths.
    expect(result).toEqual({
      '"path/to/file with spaces.ts"': { insertions: 1, deletions: 1 },
    })
  })

  test('parses rename destination statistics', () => {
    const output = '0\t0\t\0old\0new\0'
    const result = parseGitDiffNumStat(output)

    // Statistics belong to the destination path.
    expect(result).toEqual({
      new: { insertions: 0, deletions: 0 },
    })
  })

  test('parses paths containing tabs', () => {
    const output = '1\t1\tpath/part1\tpath/part2.ts\0'
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
