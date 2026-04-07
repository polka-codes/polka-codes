import type { ModelInfo } from '../UsageMeter.js'

export type { ModelInfo }

export interface PortkeyPricingResponse {
  request_token?: {
    price: number // cents per token
  }
  response_token?: {
    price: number // cents per token
  }
  cache_write_input_token?: {
    price: number // cents per token
  }
  cache_read_input_token?: {
    price: number // cents per token
  }
  additional_units?: Record<
    string,
    {
      price: number
    }
  >
}

export interface PortkeyPricingConfig {
  provider: string
  model: string
  pricing: PortkeyPricingResponse
}
