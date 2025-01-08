import { describe, expect, it, spyOn } from 'bun:test'
import listCodeDefinitionNames from './listCodeDefinitionNames'
import { MockProvider } from './provider'

describe('listCodeDefinitionNames', () => {
  it('should return code definitions', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listCodeDefinitionNames').mockResolvedValue(['TestClass', 'testFunction'])

    const result = await listCodeDefinitionNames.handler(mockProvider, {
      path: 'src/main.js',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.listCodeDefinitionNames).toHaveBeenCalledWith('src/main.js')
  })

  it('should handle empty directory', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listCodeDefinitionNames').mockResolvedValue([])

    const result = await listCodeDefinitionNames.handler(mockProvider, {
      path: 'empty-dir',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.listCodeDefinitionNames).toHaveBeenCalledWith('empty-dir')
  })

  it('should handle errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'listCodeDefinitionNames').mockRejectedValue(new Error('Directory not found'))

    const result = listCodeDefinitionNames.handler(mockProvider, {
      path: 'invalid-path',
    })

    await expect(result).rejects.toMatchSnapshot()
    expect(mockProvider.listCodeDefinitionNames).toHaveBeenCalledWith('invalid-path')
  })
})
