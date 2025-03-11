/**
 * UsageMeter class for tracking API usage metrics
 * Generated by polka.codes
 */

import { merge } from 'lodash'
import type { ApiUsage } from './AiServiceBase'
import { type ModelInfo, modelInfos } from './ModelInfo'

export class UsageMeter {
  #usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    totalCost: 0,
  }

  #messageCount = 0
  readonly #prices: Record<string, Record<string, ModelInfo>> = {}

  readonly maxCost: number
  readonly maxMessageCount: number

  constructor(options: { maxCost?: number; maxMessageCount?: number; prices?: Record<string, Record<string, ModelInfo>> } = {}) {
    // default to some something is definitely wrong if ever exceeded value
    this.maxCost = options.maxCost || 1000
    this.maxMessageCount = options.maxMessageCount || 1000

    this.#prices = merge({}, modelInfos, options.prices ?? {})
  }

  /**
   * Add usage metrics to the current totals
   */
  addUsage(usage: Partial<ApiUsage>, model?: { provider: string; id: string }): void {
    // Use atomic operations for thread safety
    this.#usage.inputTokens += usage.inputTokens ?? 0
    this.#usage.outputTokens += usage.outputTokens ?? 0
    this.#usage.cacheWriteTokens += usage.cacheWriteTokens ?? 0
    this.#usage.cacheReadTokens += usage.cacheReadTokens ?? 0

    if (!usage.totalCost && model) {
      const modelInfo = this.#prices[model.provider]?.[model.id] ?? {}
      usage.totalCost =
        ((modelInfo.inputPrice ?? 0) * (usage.inputTokens ?? 0) +
          (modelInfo.outputPrice ?? 0) * (usage.outputTokens ?? 0) +
          (modelInfo.cacheWritesPrice ?? 0) * (usage.cacheWriteTokens ?? 0) +
          (modelInfo.cacheReadsPrice ?? 0) * (usage.cacheReadTokens ?? 0)) /
        1_000_000
    }

    this.#usage.totalCost += usage.totalCost ?? 0
  }

  incrementMessageCount(count = 1) {
    this.#messageCount += count
  }

  isLimitExceeded() {
    const messageCount = this.#messageCount >= this.maxMessageCount
    const cost = this.#usage.totalCost >= this.maxCost
    return {
      messageCount,
      maxMessageCount: this.maxMessageCount,
      cost,
      maxCost: this.maxCost,
      result: messageCount || cost,
    }
  }

  checkLimit() {
    const result = this.isLimitExceeded()
    if (result.result) {
      throw new Error(
        `Usage limit exceeded. Message count: ${result.messageCount}/${result.maxMessageCount}, cost: ${result.cost}/${result.maxCost}`,
      )
    }
  }

  /**
   * Get current usage totals
   */
  get usage(): ApiUsage {
    return { ...this.#usage }
  }

  printUsage() {
    const { inputTokens, outputTokens, cacheReadTokens, cacheWriteTokens } = this.#usage
    const allTokensZero = inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && cacheWriteTokens === 0

    console.log('Usages:')
    if (!allTokensZero) {
      console.log(`Input tokens: ${this.#usage.inputTokens}`)
      console.log(`Output tokens: ${this.#usage.outputTokens}`)
      console.log(`Cache read tokens: ${this.#usage.cacheReadTokens}`)
      console.log(`Cache write tokens: ${this.#usage.cacheWriteTokens}`)
    }
    console.log(`Total cost: ${this.#usage.totalCost}`)
  }
}
