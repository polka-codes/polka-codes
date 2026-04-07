import type { PortkeyPricingResponse } from './types.js'

const PORTKEY_BASE_URL = 'https://api.portkey.ai/model-configs/pricing'
const TIMEOUT_MS = 5000
const MAX_RETRIES = 2

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetry(response: Response, error: unknown): boolean {
  // Retry on network errors or 5xx server errors
  if (error) return true
  if (response.status >= 500) return true
  // Don't retry on 4xx client errors (including 404 not found)
  return false
}

export async function fetchPricing(provider: string, model: string): Promise<PortkeyPricingResponse | null> {
  const url = `${PORTKEY_BASE_URL}/${provider}/${model}`

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, TIMEOUT_MS)

      if (!response.ok) {
        // Don't retry on 4xx errors (client errors like 404)
        if (!shouldRetry(response, null)) {
          return null
        }
        if (attempt < MAX_RETRIES) {
          await sleep(2 ** attempt * 1000)
          continue
        }
        return null
      }

      const data = await response.json()
      return data as PortkeyPricingResponse
    } catch (error: unknown) {
      // Retry on network errors
      if (attempt < MAX_RETRIES && shouldRetry(new Response(null, { status: 500 }), error)) {
        await sleep(2 ** attempt * 1000)
        continue
      }
      return null
    }
  }

  return null
}
