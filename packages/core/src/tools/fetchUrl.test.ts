import { describe, expect, it } from 'bun:test'
import fetchUrl from './fetchUrl'
import type { WebProvider } from './provider'

describe('fetchUrl', () => {
  it('returns successful and failed batch results independently', async () => {
    const provider: WebProvider = {
      fetchUrl: async (url: string) => {
        if (url.endsWith('/failed')) throw new Error('Request failed')
        return 'Fetched content'
      },
    }

    const result = await fetchUrl.handler(provider, {
      url: ['https://example.com/success', 'https://example.com/failed'],
    })

    expect(result).toEqual({
      success: true,
      message: {
        type: 'text',
        value:
          '<fetch_url_content url="https://example.com/success">Fetched content</fetch_url_content>\n' +
          '<fetch_url_error url="https://example.com/failed">Request failed</fetch_url_error>',
      },
    })
  })
})
