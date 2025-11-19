import { describe, expect, it, spyOn } from 'bun:test'
import { MockProvider } from './provider'
import search from './search'

describe('search', () => {
  it('should use provider.search if available', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'search').mockResolvedValue('search result')

    const result = await search.handler(mockProvider, {
      query: 'test query',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.search).toHaveBeenCalledWith('test query')
  })
})
