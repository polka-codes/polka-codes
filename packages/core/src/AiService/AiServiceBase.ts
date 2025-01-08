import type { Anthropic } from '@anthropic-ai/sdk'

import type { ModelInfo } from './ModelInfo'

export type ApiStreamChunk = ApiStreamTextChunk | ApiStreamUsageChunk

export interface ApiStreamTextChunk {
  type: 'text'
  text: string
}

export interface ApiStreamUsageChunk {
  type: 'usage'
  inputTokens: number
  outputTokens: number
  cacheWriteTokens?: number
  cacheReadTokens?: number
  totalCost?: number // openrouter
}

export type ApiStream = AsyncGenerator<ApiStreamChunk>

export interface AiServiceOptions {
  modelId?: string
  apiKey?: string
  baseUrl?: string
}

export type MessageParam = Anthropic.Messages.MessageParam

export abstract class AiServiceBase {
  abstract get model(): { id: string; info: ModelInfo }

  abstract send(systemPrompt: string, messages: MessageParam[]): ApiStream
}
