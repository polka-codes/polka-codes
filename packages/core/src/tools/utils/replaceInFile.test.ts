import { describe, expect, it } from 'bun:test'

import { replaceInFile } from './replaceInFile'

describe('replaceInFile', () => {
  it('should perform basic single replacement', async () => {
    const content = `line1
line2
line3`
    const diff = `<<<<<<< SEARCH
line2
=======
new line2
>>>>>>> REPLACE`

    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content: `line1
new line2
line3`,
      status: 'all_diff_applied',
      appliedCount: 1,
      totalCount: 1,
    })
  })

  it('should handle multiple replacements', async () => {
    const content = `line1
line2
line3
line2`
    const diff = `<<<<<<< SEARCH
line2
=======
new line2
>>>>>>> REPLACE
<<<<<<< SEARCH
line3
=======
new line3
>>>>>>> REPLACE`

    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content: `line1
new line2
new line3
line2`,
      status: 'all_diff_applied',
      appliedCount: 2,
      totalCount: 2,
    })
  })

  it('should handle whitespace variations', async () => {
    const content = `line1
  line2
line3`
    const diff = `<<<<<<< SEARCH
line2
=======
new line2
>>>>>>> REPLACE`

    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content: `line1
  new line2
line3`,
      status: 'all_diff_applied',
      appliedCount: 1,
      totalCount: 1,
    })
  })

  it('should throw error when no blocks found', async () => {
    const content = `line1
line2`
    const diff = 'invalid format'

    expect(() => replaceInFile(content, diff)).toThrow('No valid diff blocks found')
  })

  it('should return no_diff_applied when search text not found', async () => {
    const content = `line1
line2`
    const diff = `<<<<<<< SEARCH
line3
=======
new line3
>>>>>>> REPLACE`

    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content,
      status: 'no_diff_applied',
      appliedCount: 0,
      totalCount: 1,
    })
  })

  it('should handle empty file', async () => {
    const content = ''
    const diff = `<<<<<<< SEARCH
line1
=======
new line1
>>>>>>> REPLACE`

    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content,
      status: 'no_diff_applied',
      appliedCount: 0,
      totalCount: 1,
    })
  })

  it('should handle empty replacement', async () => {
    const content = `line1
line2`
    const diff = `<<<<<<< SEARCH
line2
=======
>>>>>>> REPLACE`

    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content: `line1
`,
      status: 'all_diff_applied',
      appliedCount: 1,
      totalCount: 1,
    })
  })

  it('should return some_diff_applied when some search text not found', () => {
    const content = 'line1\nline2'
    const diff = `<<<<<<< SEARCH
line1
=======
new line1
>>>>>>> REPLACE
<<<<<<< SEARCH
line3
=======
new line3
>>>>>>> REPLACE`
    const result = replaceInFile(content, diff)
    expect(result).toEqual({
      content: 'new line1\nline2',
      status: 'some_diff_applied',
      appliedCount: 1,
      totalCount: 2,
    })
  })
})
