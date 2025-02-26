import type { Anthropic } from '@anthropic-ai/sdk'
import type { ModelInfo } from './ModelInfo'
import type { UsageMeter } from './UsageMeter'

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
  usageMeter: UsageMeter
  enableCache?: boolean
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
  readonly usageMeter: UsageMeter

  constructor(usageMeter: UsageMeter) {
    this.usageMeter = usageMeter
  }

  abstract get model(): { provider: string; id: string; info: ModelInfo }

  abstract sendImpl(systemPrompt: string, messages: MessageParam[]): ApiStream

  async *send(systemPrompt: string, messages: MessageParam[]): ApiStream {
    this.usageMeter.incrementMessageCount()

    const stream = this.sendImpl(systemPrompt, messages)

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'usage':
          this.usageMeter.addUsage(chunk, this.model)
          break
      }
      yield chunk
    }
  }

  async request(systemPrompt: string, messages: MessageParam[]) {
    this.usageMeter.incrementMessageCount()

    const stream = this.sendImpl(systemPrompt, messages)
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
    this.usageMeter.addUsage(usage, this.model)

    return {
      response: resp,
      reasoning,
      usage,
    }
  }
}
