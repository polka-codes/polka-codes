import type { ModelInfo, PortkeyPricingResponse } from './types'

/**
 * Convert Portkey pricing (cents per token) to ModelInfo (USD per 1M tokens)
 * Formula: cents_per_token * 10 = usd_per_1M_tokens
 */
export function convertPortkeyToModelInfo(portkey: PortkeyPricingResponse): ModelInfo {
  return {
    inputPrice: (portkey.request_token?.price ?? 0) * 10,
    outputPrice: (portkey.response_token?.price ?? 0) * 10,
    cacheWritesPrice: (portkey.cache_write_input_token?.price ?? 0) * 10,
    cacheReadsPrice: (portkey.cache_read_input_token?.price ?? 0) * 10,
  }
}
