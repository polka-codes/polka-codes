import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
import writeToFile from './writeToFile'

describe('writeToFile', () => {
  it('should write file successfully', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'writeFile').mockResolvedValue()

    const result = await writeToFile.handler(mockProvider, {
      path: 'test.txt',
      content: 'Test content',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.writeFile).toHaveBeenCalledWith('test.txt', 'Test content')
  })

  it('should handle directory creation', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'writeFile').mockResolvedValue()

    const result = await writeToFile.handler(mockProvider, {
      path: 'new-dir/test.txt',
      content: 'Test content',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.writeFile).toHaveBeenCalledWith('new-dir/test.txt', 'Test content')
  })

  it('should handle write errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'writeFile').mockRejectedValue(new Error('Write error'))

    const result = writeToFile.handler(mockProvider, {
      path: 'error.txt',
      content: 'Test content',
    })

    expect(result).rejects.toMatchSnapshot()
    expect(mockProvider.writeFile).toHaveBeenCalledWith('error.txt', 'Test content')
  })

  it('should remove CDATA tags when present', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'writeFile').mockResolvedValue()

    const result = await writeToFile.handler(mockProvider, {
      path: 'cdata.txt',
      content: '<![CDATA[Test content]]>',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.writeFile).toHaveBeenCalledWith('cdata.txt', 'Test content')
  })

  it('should not modify content without CDATA tags', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'writeFile').mockResolvedValue()

    const result = await writeToFile.handler(mockProvider, {
      path: 'nocdata.txt',
      content: 'Test content',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.writeFile).toHaveBeenCalledWith('nocdata.txt', 'Test content')
  })

  it('should not modify partial CDATA tags', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'writeFile').mockResolvedValue()

    const result = await writeToFile.handler(mockProvider, {
      path: 'partial.txt',
      content: '<![CDATA[Test content',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.writeFile).toHaveBeenCalledWith('partial.txt', '<![CDATA[Test content')
  })
})
