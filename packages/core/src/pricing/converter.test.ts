import { describe, expect, test } from 'bun:test'
import { convertPortkeyToModelInfo } from './converter'
import type { PortkeyPricingResponse } from './types'

describe('convertPortkeyToModelInfo', () => {
  test('converts full pricing data correctly', () => {
    const portkey: PortkeyPricingResponse = {
      request_token: { price: 0.3 }, // 0.3 cents/token = 3 USD/1M tokens
      response_token: { price: 1.5 }, // 1.5 cents/token = 15 USD/1M tokens
      cache_write_input_token: { price: 0.375 }, // 0.375 cents/token = 3.75 USD/1M tokens
      cache_read_input_token: { price: 0.03 }, // 0.03 cents/token = 0.3 USD/1M tokens
    }

    const result = convertPortkeyToModelInfo(portkey)

    expect(result).toEqual({
      inputPrice: 3,
      outputPrice: 15,
      cacheWritesPrice: 3.75,
      cacheReadsPrice: 0.3,
    })
  })

  test('handles missing fields with zero defaults', () => {
    const portkey: PortkeyPricingResponse = {
      request_token: { price: 0.3 },
      response_token: { price: 1.5 },
    }

    const result = convertPortkeyToModelInfo(portkey)

    expect(result).toEqual({
      inputPrice: 3,
      outputPrice: 15,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0,
    })
  })

  test('handles completely empty pricing', () => {
    const portkey: PortkeyPricingResponse = {}

    const result = convertPortkeyToModelInfo(portkey)

    expect(result).toEqual({
      inputPrice: 0,
      outputPrice: 0,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0,
    })
  })

  test('conversion formula is correct', () => {
    // Verify: cents_per_token * 10 = usd_per_1M_tokens
    // Example: 0.1 cents/token * 10 = 1 USD/1M tokens
    const portkey: PortkeyPricingResponse = {
      request_token: { price: 0.1 },
      response_token: { price: 0.4 },
    }

    const result = convertPortkeyToModelInfo(portkey)

    expect(result.inputPrice).toBe(1)
    expect(result.outputPrice).toBe(4)
  })
})
