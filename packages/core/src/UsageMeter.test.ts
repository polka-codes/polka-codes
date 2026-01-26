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
