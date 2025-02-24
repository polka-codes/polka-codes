import { createAmazonBedrock } from '@ai-sdk/amazon-bedrock'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from '@mastra/core'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ollama-ai-provider'

import { AiProvider, type ModelConfig } from './types'

export const getModel = (config: ModelConfig): LanguageModel => {
  switch (config.provider) {
    case AiProvider.Anthropic: {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })
      return anthropic(config.model)
    }

    case AiProvider.Ollama: {
      const ollama = createOllama({
        baseURL: config.baseUrl,
      })
      return ollama(config.model)
    }

    case AiProvider.DeepSeek: {
      const deepseek = createDeepSeek({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })
      return deepseek(config.model)
    }

    case AiProvider.OpenRouter: {
      const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })
      return openrouter.chat(config.model)
    }

    case AiProvider.OpenAI: {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
      })

      return openai(config.model)
    }

    case AiProvider.Bedrock: {
      // API key is JSON string of { region: string, accessKeyId: string, secretAccessKey: string }
      let region: string | undefined
      let accessKeyId: string | undefined
      let secretAccessKey: string | undefined

      if (config.apiKey) {
        try {
          const apiKey = JSON.parse(config.apiKey)
          region = apiKey.region
          accessKeyId = apiKey.accessKeyId
          secretAccessKey = apiKey.secretAccessKey
        } catch (e) {}
      }

      const bedrock = createAmazonBedrock({
        baseURL: config.baseUrl,
        region,
        accessKeyId,
        secretAccessKey,
      })
      return bedrock(config.model)
    }
  }
}
