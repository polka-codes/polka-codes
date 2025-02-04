// source: https://github.com/cline/cline/blob/f6c19c29a64ca84e9360df7ab2c07d128dcebe64/src/api/providers/anthropic.ts

import { Anthropic } from '@anthropic-ai/sdk'
import type { Stream as AnthropicStream } from '@anthropic-ai/sdk/streaming'

import { AiServiceBase, type AiServiceOptions, type ApiStream, type MessageParam } from './AiServiceBase'
import { type AnthropicModelId, type ModelInfo, anthropicDefaultModelId, anthropicModels } from './ModelInfo'

export class AnthropicService extends AiServiceBase {
  #options: AiServiceOptions
  #client: Anthropic

  readonly model: { id: AnthropicModelId; info: ModelInfo }

  constructor(options: AiServiceOptions) {
    super(options.usageMeter)

    this.#options = options
    this.#client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl || undefined,
    })

    const id = (this.#options.model ?? anthropicDefaultModelId) as AnthropicModelId
    this.model = {
      id,
      info: anthropicModels[id] ?? anthropicModels[anthropicDefaultModelId],
    }
  }

  override async *sendImpl(systemPrompt: string, messages: MessageParam[]): ApiStream {
    let stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent>
    const modelId = this.model.id

    const cacheControl = this.#options.enableCache ? { type: 'ephemeral' as const } : undefined

    switch (modelId) {
      // 'latest' alias does not support cache_control
      case 'claude-3-5-sonnet-20241022':
      case 'claude-3-5-haiku-20241022':
      case 'claude-3-opus-20240229':
      case 'claude-3-haiku-20240307': {
        /*
				The latest message will be the new user message, one before will be the assistant message from a previous request, and the user message before that will be a previously cached user message. So we need to mark the latest user message as ephemeral to cache it for the next request, and mark the second to last user message as ephemeral to let the server know the last message to retrieve from the cache for the current request..
				*/
        const userMsgIndices = messages.reduce((acc, msg, index) => {
          if (msg.role === 'user') {
            acc.push(index)
          }
          return acc
        }, [] as number[])
        const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
        const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1
        stream = await this.#client.messages.create({
          model: modelId,
          max_tokens: this.model.info.maxTokens || 8192,
          temperature: 0,
          system: [
            {
              text: systemPrompt,
              type: 'text',
              cache_control: cacheControl,
            },
          ], // setting cache breakpoint for system prompt so new tasks can reuse it
          messages: messages.map((message, index) => {
            if (index === lastUserMsgIndex || index === secondLastMsgUserIndex) {
              return {
                ...message,
                content:
                  typeof message.content === 'string'
                    ? [
                        {
                          type: 'text',
                          text: message.content,
                          cache_control: cacheControl,
                        },
                      ]
                    : message.content.map((content, contentIndex) =>
                        contentIndex === message.content.length - 1
                          ? {
                              ...content,
                              cache_control: cacheControl,
                            }
                          : content,
                      ),
              }
            }
            return message
          }),
          stream: true,
        })
        break
      }
      default: {
        stream = await this.#client.messages.create({
          model: modelId,
          max_tokens: this.model.info.maxTokens || 8192,
          temperature: 0,
          system: [{ text: systemPrompt, type: 'text' }],
          messages,
          // tools,
          // tool_choice: { type: "auto" },
          stream: true,
        })
        break
      }
    }

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'message_start': {
          // tells us cache reads/writes/input/output
          const usage = chunk.message.usage
          yield {
            type: 'usage',
            inputTokens: usage.input_tokens,
            outputTokens: usage.output_tokens,
            cacheWriteTokens: usage.cache_creation_input_tokens || 0,
            cacheReadTokens: usage.cache_read_input_tokens || 0,
          }
          break
        }
        case 'message_delta': {
          // tells us stop_reason, stop_sequence, and output tokens along the way and at the end of the message

          yield {
            type: 'usage',
            inputTokens: 0,
            outputTokens: chunk.usage.output_tokens,
          }
          break
        }
        case 'message_stop':
          break
        case 'content_block_start':
          switch (chunk.content_block.type) {
            case 'text':
              // we may receive multiple text blocks, in which case just insert a line break between them
              if (chunk.index > 0) {
                yield {
                  type: 'text',
                  text: '\n',
                }
              }
              yield {
                type: 'text',
                text: chunk.content_block.text,
              }
              break
          }
          break
        case 'content_block_delta':
          switch (chunk.delta.type) {
            case 'text_delta':
              yield {
                type: 'text',
                text: chunk.delta.text,
              }
              break
          }
          break
        case 'content_block_stop':
          break
      }
    }
  }
}
