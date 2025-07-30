import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
import readFile from './readFile'

describe('readFile', () => {
  it('should read single file', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'readFile').mockResolvedValue('file content')

    const result = await readFile.handler(mockProvider, {
      path: 'file.txt',
      includeIgnored: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.readFile).toHaveBeenCalledWith('file.txt', false)
  })

  it('should read multiple files', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'readFile').mockResolvedValueOnce('file1 content').mockResolvedValueOnce('file2 content')

    const result = await readFile.handler(mockProvider, {
      path: 'file1.txt,file2.txt',
      includeIgnored: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.readFile).toHaveBeenCalledWith('file1.txt', false)
    expect(mockProvider.readFile).toHaveBeenCalledWith('file2.txt', false)
  })

  it('should handle file not found', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'readFile').mockRejectedValue(new Error('File not found'))

    const result = readFile.handler(mockProvider, {
      path: 'missing.txt',
      includeIgnored: 'false',
    })

    await expect(result).rejects.toMatchSnapshot()
    expect(mockProvider.readFile).toHaveBeenCalledWith('missing.txt', false)
  })
})
