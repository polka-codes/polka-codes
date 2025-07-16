// source: https://github.com/cline/cline/blob/f6c19c29a64ca84e9360df7ab2c07d128dcebe64/src/api/providers/anthropic.ts

import { Anthropic } from '@anthropic-ai/sdk'
import type { Stream as AnthropicStream } from '@anthropic-ai/sdk/streaming'

import type { FullToolInfo as Tool, ToolParameter } from '../tool'
import {
  AiServiceBase,
  type AiServiceOptions,
  type ApiStream,
  type ApiStreamChunk,
  type ApiStreamWithTool,
  type ApiStreamWithToolChunk,
  type MessageParam,
} from './AiServiceBase'
import { type AnthropicModelId, type ModelInfo, anthropicDefaultModelId, anthropicModels } from './ModelInfo'

function paramToJsonSchema(param: ToolParameter): any {
  let schema: any

  if (param.children?.length) {
    const properties = param.children.reduce(
      (acc, child) => {
        acc[child.name] = paramToJsonSchema(child)
        return acc
      },
      {} as Record<string, any>,
    )

    const required = param.children.filter((p) => p.required).map((p) => p.name)

    schema = {
      type: 'object',
      properties,
    }
    if (required.length > 0) {
      schema.required = required
    }
  } else {
    schema = {
      type: 'string', // Assuming string for primitive types
      description: param.description,
    }
  }

  if (param.allowMultiple) {
    return {
      type: 'array',
      items: schema,
      description: param.description,
    }
  }

  schema.description = param.description
  return schema
}

function toolToAnthropicTool(tool: Tool): Anthropic.Tool {
  const properties = tool.parameters.reduce(
    (acc, p) => {
      acc[p.name] = paramToJsonSchema(p)
      return acc
    },
    {} as Record<string, any>,
  )

  const required = tool.parameters.filter((p) => p.required).map((p) => p.name)

  return {
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object',
      properties,
      ...(required.length > 0 && { required }),
    },
  }
}

export class AnthropicService extends AiServiceBase {
  #options: AiServiceOptions
  #client: Anthropic

  readonly model: { provider: 'anthropic'; id: AnthropicModelId; info: ModelInfo }

  constructor(options: AiServiceOptions) {
    super(options)

    this.#options = options
    this.#client = new Anthropic({
      apiKey: options.apiKey,
      baseURL: options.baseUrl || undefined,
    })

    const id = (this.#options.model ?? anthropicDefaultModelId) as AnthropicModelId
    this.model = {
      provider: 'anthropic',
      id,
      info: anthropicModels[id] ?? anthropicModels[anthropicDefaultModelId],
    }
  }

  override async *sendImpl(systemPrompt: string, messages: MessageParam[], signal: AbortSignal): ApiStream {
    yield* this._streamImpl(systemPrompt, messages, undefined, signal)
  }

  override async *sendImplWithTool(systemPrompt: string, messages: MessageParam[], tools: Tool[], signal: AbortSignal): ApiStreamWithTool {
    yield* this._streamImpl(systemPrompt, messages, tools, signal)
  }

  private _streamImpl(
    systemPrompt: string,
    messages: MessageParam[],
    tools: undefined,
    signal: AbortSignal,
  ): AsyncGenerator<ApiStreamChunk, void, unknown>
  private _streamImpl(
    systemPrompt: string,
    messages: MessageParam[],
    tools: Tool[],
    signal: AbortSignal,
  ): AsyncGenerator<ApiStreamWithToolChunk, void, unknown>
  private async *_streamImpl(
    systemPrompt: string,
    messages: MessageParam[],
    tools: Tool[] | undefined,
    signal: AbortSignal,
  ): AsyncGenerator<ApiStreamWithToolChunk, void, unknown> {
    const modelId = this.model.id
    const anthropicTools = tools?.map(toolToAnthropicTool)

    const cacheControl = this.#options.enableCache ? ({ type: 'ephemeral' as const } as const) : undefined
    let temperature: number | undefined = 0
    let thinkingBudgetTokens = 0
    if (this.model.info.reasoning) {
      thinkingBudgetTokens = this.#options.parameters.thinkingBudgetTokens ?? 0
    }
    if (thinkingBudgetTokens > 0) {
      temperature = undefined
    }

    const body: Anthropic.Messages.MessageCreateParams = {
      model: modelId,
      max_tokens: this.model.info.maxTokens || 8192,
      temperature,
      system: [{ type: 'text', text: systemPrompt }],
      messages,
      stream: true,
      ...(tools && {
        tools: anthropicTools,
        tool_choice: { type: 'auto' },
      }),
      ...(thinkingBudgetTokens > 0 && {
        thinking: { type: 'enabled', budget_tokens: thinkingBudgetTokens },
      }),
    }

    switch (modelId) {
      // 'latest' alias does not support cache_control
      case 'claude-sonnet-4-20250514':
      case 'claude-3-7-sonnet-20250219':
      case 'claude-3-5-sonnet-20241022':
      case 'claude-3-5-haiku-20241022':
      case 'claude-3-opus-20240229':
      case 'claude-3-haiku-20240307': {
        const userMsgIndices = messages.reduce((acc, msg, index) => {
          if (msg.role === 'user') {
            acc.push(index)
          }
          return acc
        }, [] as number[])
        const lastUserMsgIndex = userMsgIndices[userMsgIndices.length - 1] ?? -1
        const secondLastMsgUserIndex = userMsgIndices[userMsgIndices.length - 2] ?? -1

        body.system = [
          {
            text: systemPrompt,
            type: 'text',
            cache_control: cacheControl,
          },
        ]
        body.messages = messages.map((message, index) => {
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
        })
        break
      }
      default: {
        break
      }
    }

    const stream: AnthropicStream<Anthropic.Messages.RawMessageStreamEvent> = await this.#client.messages.create(
      body as Anthropic.Messages.MessageCreateParamsStreaming,
      { signal },
    )

    const toolCallsByIndex: Record<number, { id: string; name: string; input: string }> = {}

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'message_start': {
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
            case 'tool_use':
              if (tools) {
                toolCallsByIndex[chunk.index] = {
                  id: chunk.content_block.id,
                  name: chunk.content_block.name,
                  input: '',
                }
              }
              break
            case 'thinking':
              yield {
                type: 'reasoning',
                text: chunk.content_block.thinking,
              }
              break
            case 'redacted_thinking':
              yield {
                type: 'reasoning',
                text: '[Redacted by provider]',
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
            case 'input_json_delta': {
              if (tools) {
                const toolCall = toolCallsByIndex[chunk.index]
                if (toolCall) {
                  toolCall.input += chunk.delta.partial_json
                }
              }
              break
            }
            case 'thinking_delta':
              yield {
                type: 'reasoning',
                text: chunk.delta.thinking,
              }
              break
          }
          break
        case 'content_block_stop': {
          if (tools) {
            const toolCall = toolCallsByIndex[chunk.index]
            if (toolCall) {
              try {
                yield {
                  type: 'tool_call',
                  id: toolCall.id,
                  name: toolCall.name,
                  input: JSON.parse(toolCall.input),
                }
              } catch (error) {
                console.error(`[AnthropicService] Error parsing tool call input: ${toolCall.input}`, error)
              }
              delete toolCallsByIndex[chunk.index]
            }
          }
          break
        }
      }
    }
  }
}
