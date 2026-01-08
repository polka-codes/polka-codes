import { appendFileSync } from 'node:fs'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createVertex } from '@ai-sdk/google-vertex'
import { createOpenAI } from '@ai-sdk/openai'
import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createOllama } from 'ollama-ai-provider-v2'
import { getEnv } from './env'

function headersToObject(headers: HeadersInit | undefined): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }
  if (headers instanceof Headers) {
    return Object.fromEntries(headers.entries())
  }
  if (Array.isArray(headers)) {
    return Object.fromEntries(headers)
  }
  return headers
}

function redactHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) {
    return undefined
  }
  const redactedHeaders: Record<string, string> = {}
  const sensitiveKeywords = ['authorization', 'cookie', 'key', 'token']
  for (const [key, value] of Object.entries(headers)) {
    if (sensitiveKeywords.some((keyword) => key.toLowerCase().includes(keyword))) {
      redactedHeaders[key] = 'REDACTED'
    } else {
      redactedHeaders[key] = value
    }
  }
  return redactedHeaders
}
export enum AiProvider {
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  DeepSeek = 'deepseek',
  OpenRouter = 'openrouter',
  OpenAI = 'openai',
  OpenAICompatible = 'openai-compatible',
  GoogleVertex = 'google-vertex',
  Google = 'google',
}

export type ModelConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
  baseUrl?: string
  location?: string
  project?: string
  keyFile?: string
  name?: string // For OpenAI-compatible providers
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
                  headers: redactHeaders(headersToObject(options?.headers)),
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
              try {
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
                      for (const line of text.split('\n')) {
                        if (line.startsWith('data:')) {
                          const content = line.slice('data:'.length).trim()
                          if (content) {
                            try {
                              const json = JSON.parse(content)
                              appendFileSync(
                                TRACING_FILE,
                                `${JSON.stringify(
                                  {
                                    type: 'response-chunk',
                                    timestamp: new Date().toISOString(),
                                    chunk: json,
                                  },
                                  null,
                                  2,
                                )}\n`,
                              )
                            } catch (_e) {
                              appendFileSync(
                                TRACING_FILE,
                                `${JSON.stringify(
                                  {
                                    type: 'response-chunk',
                                    timestamp: new Date().toISOString(),
                                    chunk: content,
                                  },
                                  null,
                                  2,
                                )}\n`,
                              )
                            }
                          }
                        }
                      }
                    }
                  }
                }
              } finally {
                // Ensure the reader is properly closed to prevent memory leaks
                reader.releaseLock()
              }
            })().catch((error) => {
              if (debugLogging) {
                console.error('Stream reading error:', error)
              }
            })
            return new Response(clientStream, {
              headers: res.headers,
              status: res.status,
            })
          }

          const full = await res.text()
          let responseBody: unknown
          try {
            responseBody = JSON.parse(full)
          } catch (_error) {
            // If parsing fails, treat the body as a string (e.g. HTML error page)
            responseBody = full
          }

          if (debugLogging) {
            console.log('<- Response Body:')
            console.dir(responseBody, { depth: null })
          }
          if (TRACING_FILE) {
            appendFileSync(
              TRACING_FILE,
              `${JSON.stringify(
                {
                  type: 'response',
                  timestamp: new Date().toISOString(),
                  status: res.status,
                  headers: redactHeaders(Object.fromEntries(res.headers.entries())),
                  body: responseBody,
                },
                null,
                2,
              )}\n`,
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
        headers: {
          'HTTP-Referer': 'https://polka.codes',
          'X-Title': 'Polka Codes',
        },
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

    case AiProvider.OpenAICompatible: {
      if (!config.baseUrl) {
        throw new Error('OpenAI-compatible providers require a baseUrl')
      }
      const openaiCompatible = createOpenAICompatible({
        apiKey: config.apiKey,
        baseURL: config.baseUrl,
        name: config.name || 'OpenAI Compatible',
        fetch: fetchOverride,
      })
      return openaiCompatible(config.model)
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
    case AiProvider.Google: {
      const google = createGoogleGenerativeAI({
        fetch: fetchOverride,
        apiKey: config.apiKey,
      })
      return google(config.model)
    }
  }
}
