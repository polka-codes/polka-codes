// source: https://github.com/cline/cline/blob/ac53dbb12209e0eb66c0036865273bf4694bc50a/src/api/providers/openrouter.ts

import OpenAI from 'openai'

import { AiServiceBase, type AiServiceOptions, type ApiStream, type MessageParam } from './AiServiceBase'
import type { ModelInfo } from './ModelInfo'
import { convertToOpenAiMessages } from './utils'

export class OpenRouterService extends AiServiceBase {
  readonly #client: OpenAI
  readonly #apiKey: string
  readonly #options: AiServiceOptions

  readonly model: { id: string; info: ModelInfo }

  constructor(options: AiServiceOptions) {
    super(options.usageMeter)

    if (!options.model) {
      throw new Error('OpenRouter requires a model')
    }

    if (!options.apiKey) {
      throw new Error('OpenRouter requires an API key')
    }

    this.#apiKey = options.apiKey

    this.#client = new OpenAI({
      baseURL: 'https://openrouter.ai/api/v1',
      apiKey: options.apiKey,
      defaultHeaders: {
        'HTTP-Referer': 'https://polka.codes', // Optional, for including your app on openrouter.ai rankings.
        'X-Title': 'Polka Codes', // Optional. Shows in rankings on openrouter.ai.
      },
    })

    this.#options = options

    this.model = {
      id: options.model,
      info: {},
    }
  }

  override async *sendImpl(systemPrompt: string, messages: MessageParam[]): ApiStream {
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...convertToOpenAiMessages(messages),
    ]

    const cacheControl = this.#options.enableCache ? { type: 'ephemeral' as const } : undefined

    // prompt caching: https://openrouter.ai/docs/prompt-caching
    // this is specifically for claude models (some models may 'support prompt caching' automatically without this)
    switch (this.model.id) {
      case 'anthropic/claude-3.7-sonnet:thinking':
      case 'anthropic/claude-3.7-sonnet':
      case 'anthropic/claude-3.7-sonnet:beta':
      case 'anthropic/claude-3-7-sonnet':
      case 'anthropic/claude-3-7-sonnet:beta':
      case 'anthropic/claude-3.5-sonnet':
      case 'anthropic/claude-3.5-sonnet:beta':
      case 'anthropic/claude-3.5-sonnet-20240620':
      case 'anthropic/claude-3.5-sonnet-20240620:beta':
      case 'anthropic/claude-3-5-haiku':
      case 'anthropic/claude-3-5-haiku:beta':
      case 'anthropic/claude-3-5-haiku-20241022':
      case 'anthropic/claude-3-5-haiku-20241022:beta':
      case 'anthropic/claude-3-haiku':
      case 'anthropic/claude-3-haiku:beta':
      case 'anthropic/claude-3-opus':
      case 'anthropic/claude-3-opus:beta': {
        openAiMessages[0] = {
          role: 'system',
          content: [
            {
              type: 'text',
              text: systemPrompt,
              // @ts-ignore-next-line
              cache_control: cacheControl,
            },
          ],
        }
        // Add cache_control to the last two user messages
        // (note: this works because we only ever add one user message at a time, but if we added multiple we'd need to mark the user message before the last assistant message)
        const lastTwoUserMessages = openAiMessages.filter((msg) => msg.role === 'user').slice(-2)
        for (const msg of lastTwoUserMessages) {
          if (typeof msg.content === 'string') {
            msg.content = [{ type: 'text', text: msg.content }]
          }
          if (Array.isArray(msg.content)) {
            let lastTextPart = msg.content.filter((part) => part.type === 'text').pop()

            if (!lastTextPart) {
              lastTextPart = { type: 'text', text: '...' }
              msg.content.push(lastTextPart)
            }
            // @ts-ignore-next-line
            lastTextPart.cache_control = cacheControl
          }
        }
        break
      }
      default:
        break
    }

    // Not sure how openrouter defaults max tokens when no value is provided, but the anthropic api requires this value and since they offer both 4096 and 8192 variants, we should ensure 8192.
    // (models usually default to max tokens allowed)
    let maxTokens: number | undefined
    switch (this.model.id) {
      case 'anthropic/claude-3.7-sonnet:thinking':
      case 'anthropic/claude-3.7-sonnet':
      case 'anthropic/claude-3.7-sonnet:beta':
      case 'anthropic/claude-3-7-sonnet':
      case 'anthropic/claude-3-7-sonnet:beta':
      case 'anthropic/claude-3.5-sonnet':
      case 'anthropic/claude-3.5-sonnet:beta':
      case 'anthropic/claude-3.5-sonnet-20240620':
      case 'anthropic/claude-3.5-sonnet-20240620:beta':
      case 'anthropic/claude-3-5-haiku':
      case 'anthropic/claude-3-5-haiku:beta':
      case 'anthropic/claude-3-5-haiku-20241022':
      case 'anthropic/claude-3-5-haiku-20241022:beta':
        maxTokens = 8_192
        break
    }

    // Removes messages in the middle when close to context window limit. Should not be applied to models that support prompt caching since it would continuously break the cache.
    let shouldApplyMiddleOutTransform = !this.model.info.supportsPromptCache
    // except for deepseek (which we set supportsPromptCache to true for), where because the context window is so small our truncation algo might miss and we should use openrouter's middle-out transform as a fallback to ensure we don't exceed the context window (FIXME: once we have a more robust token estimator we should not rely on this)
    if (this.model.id === 'deepseek/deepseek-chat') {
      shouldApplyMiddleOutTransform = true
    }

    // @ts-ignore-next-line
    const stream = await this.#client.chat.completions.create({
      model: this.model.id,
      max_completion_tokens: maxTokens,
      messages: openAiMessages,
      temperature: 0,
      stream: true,
      transforms: shouldApplyMiddleOutTransform ? ['middle-out'] : undefined,
      include_reasoning: true,
    })

    let genId: string | undefined

    for await (const chunk of stream) {
      // openrouter returns an error object instead of the openai sdk throwing an error
      if ('error' in chunk) {
        const error = chunk.error as { message?: string; code?: number }
        console.error(`OpenRouter API Error: ${error?.code} - ${error?.message}`)
        throw new Error(`OpenRouter API Error ${error?.code}: ${error?.message}`)
      }

      if (!genId && chunk.id) {
        genId = chunk.id
      }

      const delta = chunk.choices[0]?.delta

      if ((delta as any)?.reasoning) {
        yield {
          type: 'reasoning',
          text: (delta as any).reasoning,
        }
      }
      if (delta?.content) {
        yield {
          type: 'text',
          text: delta.content,
        }
      }
    }

    // delay 500ms to ensure generation endpoint is ready
    await new Promise((resolve) => setTimeout(resolve, 1000))

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5 seconds
    try {
      const response = await fetch(`https://openrouter.ai/api/v1/generation?id=${genId}`, {
        headers: {
          Authorization: `Bearer ${this.#apiKey}`,
        },
        signal: controller.signal, // this request hangs sometimes
      })
      const responseBody = await response.json()

      const generation = responseBody.data
      yield {
        type: 'usage',
        // cacheWriteTokens: 0,
        // cacheReadTokens: 0,
        // openrouter generation endpoint fails often
        inputTokens: generation?.native_tokens_prompt || 0,
        outputTokens: generation?.native_tokens_completion || 0,
        totalCost: generation?.total_cost || 0,
      }
    } catch (error) {
      // ignore if fails
      console.error('Error fetching OpenRouter generation details:', error)
    } finally {
      clearTimeout(timeout)
    }
  }
}
