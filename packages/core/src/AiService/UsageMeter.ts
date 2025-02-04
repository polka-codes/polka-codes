/**
 * UsageMeter class for tracking API usage metrics
 * Generated by polka.codes
 */

import type { ApiUsage } from './AiServiceBase'
import type { ModelInfo } from './ModelInfo'

export class UsageMeter {
  #usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    totalCost: 0,
  }

  #messageCount = 0

  readonly maxCost: number
  readonly maxMessageCount: number

  constructor(options: { maxCost?: number; maxMessageCount?: number } = {}) {
    // default to some something is definitely wrong if ever exceeded value
    this.maxCost = options.maxCost || 1000
    this.maxMessageCount = options.maxMessageCount || 1000
  }

  /**
   * Add usage metrics to the current totals
   */
  addUsage(usage: Partial<ApiUsage>, model?: ModelInfo): void {
    // Use atomic operations for thread safety
    this.#usage.inputTokens += usage.inputTokens ?? 0
    this.#usage.outputTokens += usage.outputTokens ?? 0
    this.#usage.cacheWriteTokens += usage.cacheWriteTokens ?? 0
    this.#usage.cacheReadTokens += usage.cacheReadTokens ?? 0

    if (!usage.totalCost && model) {
      usage.totalCost =
        ((model.inputPrice ?? 0) * (usage.inputTokens ?? 0) +
          (model.outputPrice ?? 0) * (usage.outputTokens ?? 0) +
          (model.cacheWritesPrice ?? 0) * (usage.cacheWriteTokens ?? 0) +
          (model.cacheReadsPrice ?? 0) * (usage.cacheReadTokens ?? 0)) /
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
      cost,
      result: messageCount || cost,
    }
  }

  /**
   * Get current usage totals
   */
  get usage(): ApiUsage {
    return { ...this.#usage }
  }

  printUsage() {
    console.log('Usages:')
    console.log(`Input tokens: ${this.#usage.inputTokens}`)
    console.log(`Output tokens: ${this.#usage.outputTokens}`)
    console.log(`Cache read tokens: ${this.#usage.cacheReadTokens}`)
    console.log(`Cache write tokens: ${this.#usage.cacheWriteTokens}`)
    console.log(`Total cost: ${this.#usage.totalCost}`)
  }
}
