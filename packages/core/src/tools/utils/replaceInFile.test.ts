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

    const result = await replaceInFile(content, diff)
    expect(result).toBe(`line1
new line2
line3`)
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

    const result = await replaceInFile(content, diff)
    expect(result).toBe(`line1
new line2
new line3
line2`)
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

    const result = await replaceInFile(content, diff)
    expect(result).toBe(`line1
  new line2
line3`)
  })

  it('should throw error when no blocks found', async () => {
    const content = `line1
line2`
    const diff = 'invalid format'

    expect(replaceInFile(content, diff)).rejects.toThrow('No valid diff blocks found')
  })

  it('should throw error when search text not found', async () => {
    const content = `line1
line2`
    const diff = `<<<<<<< SEARCH
line3
=======
new line3
>>>>>>> REPLACE`

    expect(replaceInFile(content, diff)).rejects.toThrow('Could not find the following text in file')
  })

  it('should handle empty file', async () => {
    const content = ''
    const diff = `<<<<<<< SEARCH
line1
=======
new line1
>>>>>>> REPLACE`

    expect(replaceInFile(content, diff)).rejects.toThrow('Could not find the following text in file')
  })

  it('should handle empty replacement', async () => {
    const content = `line1
line2`
    const diff = `<<<<<<< SEARCH
line2
=======
>>>>>>> REPLACE`

    const result = await replaceInFile(content, diff)
    expect(result).toBe(`line1
`)
  })
})
