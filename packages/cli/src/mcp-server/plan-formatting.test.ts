import { describe, expect, test } from 'bun:test'
import { formatPlanResult } from './tools'

describe('MCP Plan Tool Formatting', () => {
  test('formats plan results with file paths only', () => {
    const result = {
      plan: 'Implement feature X\n1. Step 1\n2. Step 2',
      files: [
        { path: 'src/feature.ts', content: 'very long content...' },
        { path: 'src/test.ts', content: 'more content...' },
        { path: 'src/types.ts', content: 'even more content...' },
      ],
    }
    const output = formatPlanResult(result)

    const expected = `Implement feature X
1. Step 1
2. Step 2

Files to modify:
  - src/feature.ts
  - src/test.ts
  - src/types.ts`

    expect(output).toBe(expected)
    expect(output).not.toContain('content')
    expect(output).not.toContain('very long')
  })

  test('formats plan results with no files', () => {
    expect(formatPlanResult({ plan: 'Simple plan with no files' })).toBe('Simple plan with no files')
  })

  test('formats no-op plan results', () => {
    expect(formatPlanResult({ reason: 'This is already implemented' })).toBe('No plan needed: This is already implemented')
  })

  test('preserves structured workflow failures', () => {
    expect(formatPlanResult({ success: false, reason: 'Provider unavailable' })).toBe('Error: Provider unavailable')
    expect(formatPlanResult(undefined)).toBe('Error: Plan workflow returned no result')
  })
})
