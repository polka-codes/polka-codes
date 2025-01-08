// source: https://github.com/cline/cline/blob/ce2610a6eafd860305ba9b12533db19f2a5385ad/src/api/providers/deepseek.ts

import OpenAI from 'openai'

import { createServiceLogger } from '../logger'
import { AiServiceBase, type AiServiceOptions, type ApiStream, type MessageParam } from './AiServiceBase'
import { type DeepSeekModelId, type ModelInfo, deepSeekDefaultModelId, deepSeekModels } from './ModelInfo'
import { convertToOpenAiMessages } from './utils'

const logger = createServiceLogger('DeepSeekService')

export class DeepSeekService extends AiServiceBase {
  #client: OpenAI

  readonly model: { id: string; info: ModelInfo }

  constructor(options: AiServiceOptions) {
    super()

    this.#client = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: options.apiKey,
    })

    const id = (options.modelId || deepSeekDefaultModelId) as DeepSeekModelId
    this.model = {
      id,
      info: deepSeekModels[id] ?? deepSeekModels[deepSeekDefaultModelId],
    }
  }

  async *send(systemPrompt: string, messages: MessageParam[]): ApiStream {
    logger.debug({ modelId: this.model.id, messagesCount: messages.length }, 'Starting message stream')

    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...convertToOpenAiMessages(messages),
    ]

    logger.trace({ modelId: this.model.id, messagesCount: messages.length }, 'Sending messages to Ollama')

    const stream = await this.#client.chat.completions.create({
      model: this.model.id,
      max_completion_tokens: this.model.info.maxTokens,
      messages: openAiMessages,
      temperature: 0,
      stream: true,
      stream_options: { include_usage: true },
    })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        yield {
          type: 'text',
          text: delta.content,
        }
      }
      if (chunk.usage) {
        yield {
          type: 'usage',
          // deepseek reports total input AND cache reads/writes, see context caching: https://api-docs.deepseek.com/guides/kv_cache
          // where the input tokens is the sum of the cache hits/misses, while anthropic reports them as separate tokens.
          // This is important to know for
          // 1) context management truncation algorithm, and
          // 2) cost calculation (NOTE: we report both input and cache stats but for now set input price to 0 since all the cost calculation will be done using cache hits/misses)
          inputTokens: chunk.usage.prompt_tokens,
          outputTokens: chunk.usage.completion_tokens,
          cacheWriteTokens: (chunk.usage as any).prompt_cache_hit_tokens || 0,
          cacheReadTokens: (chunk.usage as any).prompt_cache_miss_tokens || 0,
        }
      }
    }

    logger.debug('Stream ended')
  }
}
