import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
import removeFile from './removeFile'

describe('removeFile', () => {
  it('should remove file successfully', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'removeFile').mockResolvedValue()

    const result = await removeFile.handler(mockProvider, {
      path: 'test.txt',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.removeFile).toHaveBeenCalledWith('test.txt')
  })

  it('should handle remove errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'removeFile').mockRejectedValue(new Error('Remove error'))

    const result = removeFile.handler(mockProvider, {
      path: 'error.txt',
    })

    expect(result).rejects.toMatchSnapshot()
    expect(mockProvider.removeFile).toHaveBeenCalledWith('error.txt')
  })
})
