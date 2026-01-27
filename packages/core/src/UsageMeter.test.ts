/**
 * Tests for UsageMeter cache metadata storage
 */

import { beforeEach, describe, expect, test } from 'bun:test'
import { UsageMeter } from './UsageMeter'

// Mock LanguageModelV2 for testing
const createMockModel = (provider: string, modelId: string) => ({
  provider,
  modelId,
  specificationVersion: 'v2' as const,
})

// Helper to create mock usage objects
const createMockUsage = (inputTokens: number, outputTokens: number, cachedInputTokens: number = 0) => ({
  inputTokens,
  outputTokens,
  cachedInputTokens,
  totalTokens: inputTokens + outputTokens,
})

describe('UsageMeter', () => {
  let meter: UsageMeter

  beforeEach(() => {
    meter = new UsageMeter()
  })

  describe('constructor', () => {
    test('initializes with default limits', () => {
      const meter = new UsageMeter()
      expect(meter.usage).toEqual({
        input: 0,
        output: 0,
        cachedRead: 0,
        cost: 0,
        messageCount: 0,
      })
    })

    test('normalizes provider and model names', () => {
      const meter = new UsageMeter({
        'google-vertex': {
          'claude-3.5-sonnet': { inputPrice: 1, outputPrice: 2, cacheWritesPrice: 0, cacheReadsPrice: 0 },
        },
        'anthropic.messages': {
          'claude-3-5-sonnet-20241022': { inputPrice: 3, outputPrice: 4, cacheWritesPrice: 0, cacheReadsPrice: 0 },
        },
      })

      // Should normalize 'google-vertex' to 'google' and remove dots/dashes from model
      const model1 = createMockModel('google', 'claude35sonnet')
      meter.addUsage(model1 as any, {
        usage: createMockUsage(1000, 500),
        providerMetadata: { google: {} },
      })

      // google-vertex -> google, claude-3.5-sonnet -> claude35sonnet
      // Price should be 1 (input) per million tokens
      expect(meter.usage.cost).toBeCloseTo(0.002, 4) // (1000*1 + 500*2) / 1_000_000
    })

    test('accepts custom maxMessages and maxCost', () => {
      const meter = new UsageMeter({}, { maxMessages: 100, maxCost: 50 })
      const limits = meter.isLimitExceeded()

      expect(limits.maxMessages).toBe(100)
      expect(limits.maxCost).toBe(50)
    })
  })

  describe('addUsage', () => {
    test('accumulates usage across multiple calls', () => {
      const model = createMockModel('openai', 'gpt-4')

      meter.addUsage(model as any, { usage: createMockUsage(100, 50) })
      meter.addUsage(model as any, { usage: createMockUsage(200, 100) })

      expect(meter.usage.input).toBe(300)
      expect(meter.usage.output).toBe(150)
      expect(meter.usage.messageCount).toBe(2)
    })

    test('handles zero token usage', () => {
      const model = createMockModel('openai', 'gpt-4')

      meter.addUsage(model as any, { usage: createMockUsage(0, 0) })

      expect(meter.usage.input).toBe(0)
      expect(meter.usage.output).toBe(0)
      expect(meter.usage.messageCount).toBe(1)
    })
  })

  describe('cost calculation', () => {
    test('calculates cost for default provider', () => {
      const model = createMockModel('openai', 'gpt-4')

      meter.addUsage(model as any, {
        usage: createMockUsage(1000, 500),
        providerMetadata: { openai: {} },
      })

      // Default provider has 0 pricing, so cost should be 0
      expect(meter.usage.cost).toBe(0)
    })

    test('calculates cost for Anthropic with cache', () => {
      const meter = new UsageMeter({
        anthropic: {
          claude: {
            inputPrice: 3,
            outputPrice: 15,
            cacheWritesPrice: 3.75,
            cacheReadsPrice: 0.375,
          },
        },
      })

      const model = createMockModel('anthropic', 'claude')
      meter.addUsage(model as any, {
        usage: createMockUsage(700, 500, 200),
        providerMetadata: {
          anthropic: {
            cacheReadTokens: 200,
            promptCacheMissTokens: 100,
          },
        },
      })

      // Input returned: 700 + 100 (cache write) + 200 (cache read) = 1000
      // Cost calculated as: (700*3 + 100*3.75 + 200*0.375 + 500*15) / 1_000_000
      // = (2100 + 375 + 75 + 7500) / 1_000_000 = 0.01005
      expect(meter.usage.cost).toBeCloseTo(0.01005, 5)
      expect(meter.usage.input).toBe(1000)
    })

    test('calculates cost for OpenRouter with provided cost', () => {
      const meter = new UsageMeter({
        openrouter: {
          model: { inputPrice: 0, outputPrice: 0, cacheWritesPrice: 0, cacheReadsPrice: 0 },
        },
      })

      const model = createMockModel('openrouter', 'model')
      meter.addUsage(model as any, {
        usage: createMockUsage(1000, 500),
        providerMetadata: {
          openrouter: {
            usage: { cost: 0.005 },
          },
        },
      })

      expect(meter.usage.cost).toBe(0.005)
    })
  })

  describe('isLimitExceeded', () => {
    test('returns false when limits not exceeded', () => {
      const meter = new UsageMeter({}, { maxMessages: 10, maxCost: 1 })

      const result = meter.isLimitExceeded()
      expect(result.result).toBe(false)
      expect(result.messageCount).toBe(false)
      expect(result.cost).toBe(false)
    })

    test('detects message count limit exceeded', () => {
      const meter = new UsageMeter({}, { maxMessages: 2, maxCost: 100 })
      const model = createMockModel('openai', 'gpt-4')

      meter.addUsage(model as any, { usage: createMockUsage(100, 50) })
      meter.addUsage(model as any, { usage: createMockUsage(100, 50) })

      const result = meter.isLimitExceeded()
      expect(result.result).toBe(true)
      expect(result.messageCount).toBe(true)
      expect(result.cost).toBe(false)
    })

    test('detects cost limit exceeded', () => {
      const meter = new UsageMeter(
        {
          openai: {
            gpt4: {
              inputPrice: 10_000_000, // $10 per million
              outputPrice: 10_000_000,
              cacheWritesPrice: 0,
              cacheReadsPrice: 0,
            },
          },
        },
        { maxMessages: 1000, maxCost: 0.05 },
      )

      const model = createMockModel('openai', 'gpt-4')
      meter.addUsage(model as any, {
        usage: createMockUsage(3000, 2000),
        providerMetadata: { openai: {} },
      })

      const result = meter.isLimitExceeded()
      expect(result.result).toBe(true)
      expect(result.cost).toBe(true)
    })

    test('handles zero limits as no limit', () => {
      const meter = new UsageMeter({}, { maxMessages: 0, maxCost: 0 })
      const model = createMockModel('openai', 'gpt-4')

      meter.addUsage(model as any, { usage: createMockUsage(100, 50) })

      const result = meter.isLimitExceeded()
      expect(result.result).toBe(false)
    })
  })

  describe('checkLimit', () => {
    test('throws when limit exceeded', () => {
      const meter = new UsageMeter({}, { maxMessages: 1, maxCost: 100 })
      const model = createMockModel('openai', 'gpt-4')

      meter.addUsage(model as any, { usage: createMockUsage(100, 50) })

      expect(() => meter.checkLimit()).toThrow('Usage limit exceeded')
    })

    test('does not throw when limits not exceeded', () => {
      const meter = new UsageMeter({}, { maxMessages: 10, maxCost: 100 })

      expect(() => meter.checkLimit()).not.toThrow()
    })
  })

  describe('incrementMessageCount', () => {
    test('increments message count without token info', () => {
      meter.incrementMessageCount(5)
      expect(meter.usage.messageCount).toBe(5)
      expect(meter.usage.input).toBe(0)
      expect(meter.usage.output).toBe(0)
    })

    test('defaults to incrementing by 1', () => {
      meter.incrementMessageCount()
      expect(meter.usage.messageCount).toBe(1)
    })

    test('accumulates with regular usage tracking', () => {
      const model = createMockModel('openai', 'gpt-4')
      meter.addUsage(model as any, { usage: createMockUsage(100, 50) })
      meter.incrementMessageCount(3)

      expect(meter.usage.messageCount).toBe(4)
    })
  })

  describe('getUsageText', () => {
    test('formats usage text correctly', () => {
      const model = createMockModel('openai', 'gpt-4')
      meter.addUsage(model as any, { usage: createMockUsage(1000, 500, 200) })

      const text = meter.getUsageText()
      expect(text).toBe('Usage - messages: 1, input: 1000, cached: 200, output: 500, cost: $0.0000')
    })

    test('rounds cost to 4 decimal places', () => {
      const meter = new UsageMeter({
        openai: {
          gpt4: {
            inputPrice: 1.23,
            outputPrice: 1.0,
            cacheWritesPrice: 0,
            cacheReadsPrice: 0,
          },
        },
      })

      const model = createMockModel('openai', 'gpt4')
      meter.addUsage(model as any, {
        usage: createMockUsage(1000, 500),
        providerMetadata: { openai: {} },
      })

      const text = meter.getUsageText()
      expect(text).toContain('cost: $0.0017') // (1000*1.23 + 500*1) / 1_000_000 = 0.00173
    })
  })

  describe('onFinishHandler', () => {
    test('creates handler that records usage', () => {
      const model = createMockModel('openai', 'gpt-4')
      const handler = meter.onFinishHandler(model as any)

      handler({
        totalUsage: createMockUsage(100, 50, 25),
        providerMetadata: { openai: {} },
      })

      expect(meter.usage.input).toBe(100)
      expect(meter.usage.output).toBe(50)
      expect(meter.usage.cachedRead).toBe(25)
      expect(meter.usage.messageCount).toBe(1)
    })

    test('handler stores metadata from events', () => {
      const model = createMockModel('openai', 'gpt-4')
      const handler = meter.onFinishHandler(model as any)

      handler({
        totalUsage: createMockUsage(100, 50),
        providerMetadata: { openai: { cachedPromptTokens: 30 } },
      })

      expect(meter.providerMetadata).toHaveLength(1)
      expect(meter.providerMetadata[0].provider).toBe('openai')
    })
  })

  describe('provider metadata storage', () => {
    test('stores OpenAI provider metadata', () => {
      const mockModel = createMockModel('openai', 'gpt-4')
      const mockResponse = {
        usage: createMockUsage(100, 50),
        providerMetadata: {
          openai: {
            cachedPromptTokens: 25,
          },
        },
      }

      meter.addUsage(mockModel as any, mockResponse)

      const metadata = meter.providerMetadata
      expect(metadata).toHaveLength(1)
      expect(metadata[0].provider).toBe('openai')
      expect(metadata[0].model).toBe('gpt-4')
      expect(metadata[0].metadata.cachedPromptTokens).toBe(25)
      expect(metadata[0].timestamp).toBeGreaterThan(0)
    })

    test('stores Anthropic provider metadata', () => {
      const mockModel = createMockModel('anthropic', 'claude-3-5-sonnet-20241022')
      const mockResponse = {
        usage: createMockUsage(200, 100, 50),
        providerMetadata: {
          anthropic: {
            cacheReadTokens: 50,
            promptCacheMissTokens: 30,
          },
        },
      }

      meter.addUsage(mockModel as any, mockResponse)

      const metadata = meter.providerMetadata
      expect(metadata).toHaveLength(1)
      expect(metadata[0].provider).toBe('anthropic')
      expect(metadata[0].metadata.cacheReadTokens).toBe(50)
      expect(metadata[0].metadata.promptCacheMissTokens).toBe(30)
    })

    test('stores DeepSeek provider metadata', () => {
      const mockModel = createMockModel('deepseek', 'deepseek-chat')
      const mockResponse = {
        usage: createMockUsage(150, 75, 40),
        providerMetadata: {
          deepseek: {
            promptCacheMissTokens: 20,
          },
        },
      }

      meter.addUsage(mockModel as any, mockResponse)

      const metadata = meter.providerMetadata
      expect(metadata).toHaveLength(1)
      expect(metadata[0].provider).toBe('deepseek')
      expect(metadata[0].metadata.promptCacheMissTokens).toBe(20)
    })

    test('stores multiple metadata entries', () => {
      const mockModel1 = createMockModel('openai', 'gpt-4')
      const mockModel2 = createMockModel('anthropic', 'claude-3-5-sonnet-20241022')

      meter.addUsage(mockModel1 as any, {
        usage: createMockUsage(100, 50, 25),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      meter.addUsage(mockModel2 as any, {
        usage: createMockUsage(200, 100, 50),
        providerMetadata: { anthropic: { cacheReadTokens: 50 } },
      })

      const metadata = meter.providerMetadata
      expect(metadata).toHaveLength(2)
      expect(metadata[0].provider).toBe('openai')
      expect(metadata[1].provider).toBe('anthropic')
    })

    test('does not store entries without provider metadata', () => {
      const mockModel = createMockModel('openai', 'gpt-4')
      const mockResponse = {
        usage: createMockUsage(100, 50, 0),
      }

      meter.addUsage(mockModel as any, mockResponse)

      expect(meter.providerMetadata).toHaveLength(0)
    })

    test('does not store entries with empty provider metadata', () => {
      const mockModel = createMockModel('openai', 'gpt-4')
      const mockResponse = {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: {},
      }

      meter.addUsage(mockModel as any, mockResponse)

      expect(meter.providerMetadata).toHaveLength(0)
    })
  })

  describe('cacheStats', () => {
    test('calculates statistics for OpenAI cached tokens', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      const stats = meter.cacheStats
      expect(stats.totalRequests).toBe(1)
      expect(stats.requestsWithCache).toBe(1)
      expect(stats.totalCachedTokens).toBe(25)
      expect(stats.cacheHitRate).toBe(1)
    })

    test('calculates statistics for Anthropic cache tokens', () => {
      const mockModel = createMockModel('anthropic', 'claude-3-5-sonnet-20241022')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(200, 100, 50),
        providerMetadata: {
          anthropic: { cacheReadTokens: 50, promptCacheMissTokens: 30 },
        },
      })

      const stats = meter.cacheStats
      expect(stats.totalRequests).toBe(1)
      expect(stats.requestsWithCache).toBe(1)
      // Should pick up cacheReadTokens first
      expect(stats.totalCachedTokens).toBe(50)
    })

    test('calculates statistics for DeepSeek cache tokens', () => {
      const mockModel = createMockModel('deepseek', 'deepseek-chat')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(150, 75, 40),
        providerMetadata: { deepseek: { prompt_cache_hit_tokens: 20 } },
      })

      const stats = meter.cacheStats
      expect(stats.totalRequests).toBe(1)
      expect(stats.requestsWithCache).toBe(1)
      expect(stats.totalCachedTokens).toBe(20)
    })

    test('does not count cache misses as cached tokens', () => {
      const mockModel = createMockModel('deepseek', 'deepseek-chat')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(150, 75, 40),
        providerMetadata: { deepseek: { promptCacheMissTokens: 20 } },
      })

      const stats = meter.cacheStats
      expect(stats.totalRequests).toBe(1)
      expect(stats.requestsWithCache).toBe(0)
      expect(stats.totalCachedTokens).toBe(0)
      expect(stats.cacheHitRate).toBe(0)
    })

    test('aggregates statistics across multiple requests', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(200, 100, 0),
        providerMetadata: { openai: { cachedPromptTokens: 50 } },
      })

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        // No cache in this request
        providerMetadata: { openai: {} },
      })

      const stats = meter.cacheStats
      expect(stats.totalRequests).toBe(3)
      expect(stats.requestsWithCache).toBe(2)
      expect(stats.totalCachedTokens).toBe(75)
      expect(stats.cacheHitRate).toBeCloseTo(0.667, 2)
    })

    test('returns zero stats when no metadata', () => {
      const stats = meter.cacheStats
      expect(stats.totalRequests).toBe(0)
      expect(stats.requestsWithCache).toBe(0)
      expect(stats.totalCachedTokens).toBe(0)
      expect(stats.cacheHitRate).toBe(0)
      expect(stats.entries).toHaveLength(0)
    })
  })

  describe('clearProviderMetadata', () => {
    test('clears all stored metadata entries', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      expect(meter.providerMetadata).toHaveLength(1)

      meter.clearProviderMetadata()

      expect(meter.providerMetadata).toHaveLength(0)
      expect(meter.cacheStats.totalRequests).toBe(0)
    })

    test('does not affect usage totals', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      const usageBefore = meter.usage
      meter.clearProviderMetadata()
      const usageAfter = meter.usage

      expect(usageBefore).toEqual(usageAfter)
    })
  })

  describe('resetUsage', () => {
    test('clears metadata entries', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      expect(meter.providerMetadata).toHaveLength(1)

      meter.resetUsage()

      expect(meter.providerMetadata).toHaveLength(0)
      expect(meter.usage.messageCount).toBe(0)
    })
  })

  describe('merge', () => {
    test('merges metadata entries from another meter', () => {
      const mockModel1 = createMockModel('openai', 'gpt-4')
      const mockModel2 = createMockModel('anthropic', 'claude-3-5-sonnet-20241022')

      meter.addUsage(mockModel1 as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      const otherMeter = new UsageMeter()
      otherMeter.addUsage(mockModel2 as any, {
        usage: createMockUsage(200, 100, 0),
        providerMetadata: { anthropic: { cacheReadTokens: 50 } },
      })

      meter.merge(otherMeter)

      const metadata = meter.providerMetadata
      expect(metadata).toHaveLength(2)
      expect(metadata[0].provider).toBe('openai')
      expect(metadata[1].provider).toBe('anthropic')
    })

    test('merges usage totals along with metadata', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      const otherMeter = new UsageMeter()
      otherMeter.addUsage(mockModel as any, {
        usage: createMockUsage(200, 100, 0),
        providerMetadata: { openai: { cachedPromptTokens: 50 } },
      })

      meter.merge(otherMeter)

      const usage = meter.usage
      expect(usage.input).toBe(300)
      expect(usage.output).toBe(150)
      expect(meter.providerMetadata).toHaveLength(2)
    })
  })

  describe('setUsage', () => {
    test('clears metadata when clearMetadata option is true', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      expect(meter.providerMetadata).toHaveLength(1)

      meter.setUsage({ messageCount: 0 }, { clearMetadata: true })

      expect(meter.providerMetadata).toHaveLength(0)
    })

    test('does not clear metadata by default', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      meter.setUsage({ messageCount: 999 })

      expect(meter.providerMetadata).toHaveLength(1)
      expect(meter.usage.messageCount).toBe(999)
    })
  })

  describe('immutability of returned data', () => {
    test('providerMetadata returns a copy', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      const metadata1 = meter.providerMetadata
      const metadata2 = meter.providerMetadata

      expect(metadata1).not.toBe(metadata2)
      expect(metadata1).toEqual(metadata2)
    })

    test('cacheStats.entries returns a copy', () => {
      const mockModel = createMockModel('openai', 'gpt-4')

      meter.addUsage(mockModel as any, {
        usage: createMockUsage(100, 50, 0),
        providerMetadata: { openai: { cachedPromptTokens: 25 } },
      })

      const stats1 = meter.cacheStats
      const stats2 = meter.cacheStats

      // Should return a new array each time (encapsulation)
      expect(stats1.entries).not.toBe(stats2.entries)
      expect(stats1.entries).toEqual(stats2.entries)
    })
  })
})
