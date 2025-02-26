// source: https://github.com/cline/cline/blob/f6c19c29a64ca84e9360df7ab2c07d128dcebe64/src/api/providers/ollama.ts

import OpenAI from 'openai'

import { AiServiceBase, type AiServiceOptions, type ApiStream, type MessageParam } from './AiServiceBase'
import { type ModelInfo, openAiModelInfoSaneDefaults } from './ModelInfo'
import { convertToOpenAiMessages } from './utils'

export class OllamaService extends AiServiceBase {
  #client: OpenAI

  readonly model: { provider: string; id: string; info: ModelInfo }

  constructor(options: AiServiceOptions) {
    super(options.usageMeter)

    this.#client = new OpenAI({
      baseURL: `${options.baseUrl || 'http://localhost:11434'}/v1`,
      apiKey: 'ollama',
    })

    this.model = {
      provider: 'ollama',
      id: options.model || 'maryasov/qwen2.5-coder-cline:7b',
      info: openAiModelInfoSaneDefaults,
    }
  }

  override async *sendImpl(systemPrompt: string, messages: MessageParam[]): ApiStream {
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...convertToOpenAiMessages(messages),
    ]

    const stream = await this.#client.chat.completions.create({
      model: this.model.id,
      messages: openAiMessages,
      temperature: 0,
      stream: true,
    })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        yield {
          type: 'text',
          text: delta.content,
        }
      }
    }
  }
}
