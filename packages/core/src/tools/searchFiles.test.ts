import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
import searchFiles from './searchFiles'

describe('searchFiles tool', () => {
  it('should return ripgrep failures as recoverable error-text responses', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'searchFiles').mockRejectedValue(new Error('Ripgrep process exited with code 2: regex parse error: unclosed group'))

    const result = await searchFiles.handler(mockProvider, {
      path: 'src',
      regex: 'bad(',
      filePattern: '*.ts',
    })

    expect(result).toEqual({
      success: false,
      message: {
        type: 'error-text',
        value: 'Error searching files: Ripgrep process exited with code 2: regex parse error: unclosed group',
      },
    })
  })
})
