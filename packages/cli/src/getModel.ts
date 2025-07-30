import { appendFileSync } from 'node:fs'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createVertex } from '@ai-sdk/google-vertex'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ollama-ai-provider-v2'
import { getEnv } from './env'
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
  const { TRACING_FILE } = getEnv()

  const fetchOverride: typeof fetch | undefined =
    debugLogging || TRACING_FILE
      ? ((async (url, options) => {
          const requestBody = options?.body ? JSON.parse(options.body as string) : undefined

          if (debugLogging) {
            console.log('-> Request URL:', url)
            console.log('-> Request Headers:', options?.headers)
            console.log('-> Request Body:')
            console.dir(requestBody, { depth: null })
          }
          if (TRACING_FILE) {
            appendFileSync(
              TRACING_FILE,
              `${JSON.stringify(
                {
                  type: 'request',
                  timestamp: new Date().toISOString(),
                  url,
                  headers: options?.headers,
                  body: requestBody,
                },
                null,
                2,
              )}\n`,
            )
          }

          const res = await fetch(url, options)

          if (debugLogging) {
            console.log('<- Response Status:', res.status)
          }

          const contentType = res.headers.get('content-type') || ''
          if (contentType.includes('text/event-stream') && res.body) {
            const [branch, clientStream] = res.body.tee()
            ;(async () => {
              const reader = branch.getReader()
              const decoder = new TextDecoder()
              let done = false
              while (!done) {
                const { value, done: d } = await reader.read()
                done = d
                if (value) {
                  const text = decoder.decode(value)
                  if (debugLogging) {
                    console.log('<- Stream chunk:', text.replace(/\n/g, '\\n'))
                  }
                  if (TRACING_FILE) {
                    appendFileSync(
                      TRACING_FILE,
                      JSON.stringify(
                        {
                          type: 'response-chunk',
                          timestamp: new Date().toISOString(),
                          chunk: text,
                        },
                        null,
                        2,
                      ),
                    )
                  }
                }
              }
            })()
            return new Response(clientStream, {
              headers: res.headers,
              status: res.status,
            })
          }

          const full = await res.text()
          const responseBody = JSON.parse(full)

          if (debugLogging) {
            console.log('<- Response Body:')
            console.dir(responseBody, { depth: null })
          }
          if (TRACING_FILE) {
            appendFileSync(
              TRACING_FILE,
              JSON.stringify(
                {
                  type: 'response',
                  timestamp: new Date().toISOString(),
                  status: res.status,
                  headers: Object.fromEntries(res.headers.entries()),
                  body: responseBody,
                },
                null,
                2,
              ),
            )
          }

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
