import type { Anthropic } from '@anthropic-ai/sdk'
import type { ModelInfo } from './ModelInfo'
import { UsageMeter } from './UsageMeter'

export type ApiStreamChunk = ApiStreamTextChunk | ApiStreamUsageChunk | ApiStreamReasoningTextChunk

export interface ApiStreamTextChunk {
  type: 'text'
  text: string
}

export interface ApiStreamReasoningTextChunk {
  type: 'reasoning'
  text: string
}

export interface ApiStreamUsageChunk extends Partial<ApiUsage> {
  type: 'usage'
}

export type ApiStream = AsyncGenerator<ApiStreamChunk>

export interface AiServiceOptions {
  model?: string
  apiKey?: string
  baseUrl?: string
}

export type MessageParam = Anthropic.Messages.MessageParam

export type ApiUsage = {
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  totalCost?: number // openrouter
}

export abstract class AiServiceBase {
  protected readonly usageMeter = new UsageMeter()

  abstract get model(): { id: string; info: ModelInfo }

  abstract sendImpl(systemPrompt: string, messages: MessageParam[]): ApiStream

  async *send(systemPrompt: string, messages: MessageParam[]): ApiStream {
    const stream = this.sendImpl(systemPrompt, messages)

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'usage':
          this.usageMeter.addUsage(chunk)
          break
      }
      yield chunk
    }
  }

  async request(systemPrompt: string, messages: MessageParam[]) {
    const stream = this.send(systemPrompt, messages)
    const usage: ApiUsage = {
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0,
    }

    let resp = ''
    let reasoning = ''

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'usage':
          usage.inputTokens = chunk.inputTokens ?? 0
          usage.outputTokens = chunk.outputTokens ?? 0
          usage.cacheWriteTokens = chunk.cacheWriteTokens ?? 0
          usage.cacheReadTokens = chunk.cacheReadTokens ?? 0
          usage.totalCost = chunk.totalCost
          break
        case 'text':
          resp += chunk.text
          break
        case 'reasoning':
          reasoning += chunk.text
      }
    }

    // Track usage metrics
    this.usageMeter.addUsage(usage)

    return {
      response: resp,
      reasoning,
      usage,
    }
  }

  /**
   * Get current usage statistics
   */
  getUsageStats(): ApiUsage {
    return this.usageMeter.getUsage()
  }

  /**
   * Get total tokens used across all categories
   */
  getTotalTokens(): number {
    return this.usageMeter.getTotalTokens()
  }

  /**
   * Reset usage statistics
   */
  resetUsage(): void {
    this.usageMeter.reset()
  }
}
