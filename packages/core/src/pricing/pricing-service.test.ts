import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { unlink } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { PricingService } from './pricing-service'

const TEST_CACHE_FILE = join(homedir(), '.config', 'polkacodes', 'pricing-cache.json')

describe('PricingService', () => {
  beforeEach(async () => {
    // Clear cache before each test
    try {
      await unlink(TEST_CACHE_FILE)
    } catch {
      // File doesn't exist, ignore
    }
  })

  afterEach(async () => {
    // Clean up test cache file
    try {
      await unlink(TEST_CACHE_FILE)
    } catch {
      // File doesn't exist, ignore
    }
  })

  test('returns fallback pricing when available', async () => {
    const fallbackPrices = {
      anthropic: {
        claude3opus: {
          inputPrice: 15,
          outputPrice: 75,
          cacheWritesPrice: 18.75,
          cacheReadsPrice: 1.5,
        },
      },
    }

    const service = new PricingService(fallbackPrices)
    const result = await service.getPricing('anthropic', 'claude-3-opus')

    expect(result).toEqual({
      inputPrice: 15,
      outputPrice: 75,
      cacheWritesPrice: 18.75,
      cacheReadsPrice: 1.5,
    })
  })

  test('normalizes provider names', async () => {
    const fallbackPrices = {
      google: {
        gemini15pro: {
          inputPrice: 1.25,
          outputPrice: 5,
          cacheWritesPrice: 0,
          cacheReadsPrice: 0.31,
        },
      },
    }

    const service = new PricingService(fallbackPrices)
    const result = await service.getPricing('google-vertex', 'gemini-1.5-pro')

    expect(result).toEqual({
      inputPrice: 1.25,
      outputPrice: 5,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0.31,
    })
  })

  test('normalizes model names', async () => {
    const fallbackPrices = {
      anthropic: {
        claude3opus: {
          inputPrice: 15,
          outputPrice: 75,
          cacheWritesPrice: 18.75,
          cacheReadsPrice: 1.5,
        },
      },
    }

    const service = new PricingService(fallbackPrices)
    const result = await service.getPricing('anthropic', 'claude-3-opus')

    expect(result).toEqual({
      inputPrice: 15,
      outputPrice: 75,
      cacheWritesPrice: 18.75,
      cacheReadsPrice: 1.5,
    })
  })

  test('returns zero pricing when no pricing found', async () => {
    const service = new PricingService({})
    // Use a model that won't be found in Portkey API to avoid long timeout
    // The API will return 404 quickly for invalid models
    const result = await service.getPricing('unknown', 'unknown-model')

    expect(result).toEqual({
      inputPrice: 0,
      outputPrice: 0,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0,
    })
  }, 10000) // Increase timeout to 10s to account for API retries

  test('handles partial pricing data', async () => {
    const fallbackPrices = {
      anthropic: {
        claude3opus: {
          inputPrice: 15,
          outputPrice: 75,
          // Missing cache prices
        },
      },
    }

    const service = new PricingService(fallbackPrices)
    const result = await service.getPricing('anthropic', 'claude-3-opus')

    expect(result).toEqual({
      inputPrice: 15,
      outputPrice: 75,
      cacheWritesPrice: 0,
      cacheReadsPrice: 0,
    })
  })

  test('caches pricing after first fetch', async () => {
    const fallbackPrices = {
      anthropic: {
        claude3opus: {
          inputPrice: 15,
          outputPrice: 75,
          cacheWritesPrice: 18.75,
          cacheReadsPrice: 1.5,
        },
      },
    }

    const service = new PricingService(fallbackPrices)

    // First call
    await service.getPricing('anthropic', 'claude-3-opus')

    // Second call should use cache
    const result = await service.getPricing('anthropic', 'claude-3-opus')

    expect(result).toEqual({
      inputPrice: 15,
      outputPrice: 75,
      cacheWritesPrice: 18.75,
      cacheReadsPrice: 1.5,
    })
  })
})
