import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createVertex } from '@ai-sdk/google-vertex'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ollama-ai-provider-v2'

export enum AiProvider {
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  DeepSeek = 'deepseek',
  OpenRouter = 'openrouter',
  OpenAI = 'openai',
  GoogleVertex = 'google-vertex',
}

export type ModelConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
  baseUrl?: string
  location?: string
  project?: string
  keyFile?: string
}

export const getModel = (config: ModelConfig, debugLogging = false): LanguageModelV2 => {
  const fetchOverride: typeof fetch | undefined = debugLogging
    ? ((async (url, options) => {
        // log outgoing request
        console.log('-> Request URL:', url)
        console.log('-> Request Headers:', options?.headers)
        console.log('-> Request Body:')
        console.dir(JSON.parse(options?.body as any), { depth: null })

        const res = await fetch(url, options)
        console.log('<- Response Status:', res.status)

        const contentType = res.headers.get('content-type') || ''
        // if it's a streaming response, clone the body stream
        if (contentType.includes('text/event-stream') && res.body) {
          const [branch, clientStream] = res.body.tee()
          // consume branch to log chunks
          ;(async () => {
            const reader = branch.getReader()
            const decoder = new TextDecoder()
            let done = false
            while (!done) {
              const { value, done: d } = await reader.read()
              done = d
              if (value) {
                const text = decoder.decode(value)
                console.log('<- Stream chunk:', text.replace(/\n/g, '\\n'))
              }
            }
          })()
          // return the other branch to the SDK
          return new Response(clientStream, {
            headers: res.headers,
            status: res.status,
          })
        }

        // non-stream: read and log full body
        const full = await res.text()
        console.log('<- Response Body:')
        console.dir(JSON.parse(full), { depth: null })
        return new Response(full, {
          headers: res.headers,
          status: res.status,
        })
      }) as typeof fetch)
    : undefined

  switch (config.provider) {
    case AiProvider.Anthropic: {
      const anthropic = createAnthropic({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        fetch: fetchOverride,
      })
      return anthropic(config.model)
    }

    case AiProvider.Ollama: {
      const ollama = createOllama({
        baseURL: config.baseUrl,
        fetch: fetchOverride,
      })
      return ollama(config.model)
    }

    case AiProvider.DeepSeek: {
      const deepseek = createDeepSeek({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        fetch: fetchOverride,
      })
      return deepseek(config.model)
    }

    case AiProvider.OpenRouter: {
      const openrouter = createOpenRouter({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        fetch: fetchOverride,
      })
      return openrouter.chat(config.model, {
        usage: { include: true },
      })
    }

    case AiProvider.OpenAI: {
      const openai = createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        fetch: fetchOverride,
      })
      return openai(config.model)
    }

    case AiProvider.GoogleVertex: {
      const vertex = createVertex({
        fetch: fetchOverride,
        location: config.location,
        project: config.project,
        googleAuthOptions: {
          keyFile: config.keyFile,
        },
      })
      return vertex(config.model)
    }
  }
}
