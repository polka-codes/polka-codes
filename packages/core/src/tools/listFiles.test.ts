import { describe, expect, it, spyOn } from 'bun:test'
import listFiles from './listFiles'
import { MockProvider } from './provider'

describe('listFiles', () => {
  it('should return file list', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listFiles').mockResolvedValue([['file1.ts', 'file2.ts'], false])

    const result = await listFiles.handler(mockProvider, {
      path: 'src',
      maxCount: '10',
      includeIgnored: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.listFiles).toHaveBeenCalledWith('src', true, 10, false)
  })

  it('should handle non recursive listing', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listFiles').mockResolvedValue([['file1.ts', 'file2.ts'], false])

    const result = await listFiles.handler(mockProvider, {
      path: 'src',
      recursive: 'false',
      includeIgnored: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.listFiles).toHaveBeenCalledWith('src', false, 2000, false)
  })

  it('should handle empty directory', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listFiles').mockResolvedValue([[], true])

    const result = await listFiles.handler(mockProvider, {
      path: 'empty-dir',
      includeIgnored: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.listFiles).toHaveBeenCalledWith('empty-dir', true, 2000, false)
  })

  it('should handle max count with truncation', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listFiles').mockResolvedValue([['file1.ts', 'file2.ts'], true])

    const result = await listFiles.handler(mockProvider, {
      path: 'src',
      maxCount: '1',
      includeIgnored: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.listFiles).toHaveBeenCalledWith('src', true, 1, false)
  })

  it('should handle errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listFiles').mockRejectedValue(new Error('Directory not found'))

    const result = listFiles.handler(mockProvider, {
      path: 'invalid-path',
      includeIgnored: 'false',
    })

    await expect(result).rejects.toMatchSnapshot()
    expect(mockProvider.listFiles).toHaveBeenCalledWith('invalid-path', true, 2000, false)
  })
})
