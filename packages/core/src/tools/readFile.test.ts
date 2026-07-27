import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
import readFile from './readFile'

describe('readFile', () => {
  it('should read single file', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'readFile').mockResolvedValue('file content')

    const result = await readFile.handler(mockProvider, {
      path: ['file.txt'],
      includeIgnored: false,
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.readFile).toHaveBeenCalledWith('file.txt', false)
  })

  it('should read multiple files', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'readFile').mockResolvedValueOnce('file1 content').mockResolvedValueOnce('file2 content')

    const result = await readFile.handler(mockProvider, {
      path: ['file1.txt', 'file2.txt'],
      includeIgnored: false,
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.readFile).toHaveBeenCalledWith('file1.txt', false)
    expect(mockProvider.readFile).toHaveBeenCalledWith('file2.txt', false)
  })

  it('should handle file not found', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'readFile').mockRejectedValue(new Error('File not found'))

    const result = readFile.handler(mockProvider, {
      path: ['missing.txt'],
      includeIgnored: false,
    })

    await expect(result).rejects.toMatchSnapshot()
    expect(mockProvider.readFile).toHaveBeenCalledWith('missing.txt', false)
  })

  it('should distinguish an empty file from a missing file', async () => {
    const provider = { readFile: async () => '' }

    const result = await readFile.handler(provider, { path: ['empty.txt'] })

    expect(result.success).toBe(true)
    expect(result.message).toEqual({
      type: 'text',
      value: '<read_file_file_content path="empty.txt">     1→</read_file_file_content>',
    })
  })

  it('should reject negative offsets before reading', async () => {
    let callCount = 0
    const provider = {
      readFile: async () => {
        callCount++
        return ''
      },
    }

    const result = await readFile.handler(provider, { path: ['file.txt'], offset: -1 })

    expect(result.success).toBe(false)
    expect(callCount).toBe(0)
  })
})
