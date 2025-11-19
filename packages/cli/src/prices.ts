import { AiProvider } from './getModel'

export type ModelInfo = {
  inputPrice: number // USD per 1 M prompt tokens
  outputPrice: number // USD per 1 M completion tokens
  cacheWritesPrice: number // prompt-caching write cost (where offered)
  cacheReadsPrice: number // prompt-caching read/"cached input" cost
  supportsThinking?: boolean
}

export default {
  [AiProvider.Anthropic]: {
    'claude-sonnet-4-5-20250929': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: true },
    'claude-opus-4-20250514': { inputPrice: 15, outputPrice: 75, cacheWritesPrice: 18.75, cacheReadsPrice: 1.5, supportsThinking: true },
    'claude-opus-4-1-20250805': { inputPrice: 15, outputPrice: 75, cacheWritesPrice: 18.75, cacheReadsPrice: 1.5, supportsThinking: true },
    'claude-sonnet-4-20250514': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: true },
    'claude-3-7-sonnet-20250219': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: true },
    'claude-3-5-sonnet-20241022': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: false },
    'claude-3-5-haiku-20241022': { inputPrice: 0.8, outputPrice: 4, cacheWritesPrice: 1, cacheReadsPrice: 0.08, supportsThinking: false },
    'claude-haiku-4-5-20250929': { inputPrice: 1, outputPrice: 5, cacheWritesPrice: 1.25, cacheReadsPrice: 0.1, supportsThinking: false },
  },

  [AiProvider.Ollama]: {},

  [AiProvider.DeepSeek]: {
    'deepseek-chat': { inputPrice: 0.28, outputPrice: 0.42, cacheWritesPrice: 0, cacheReadsPrice: 0.028 },
    'deepseek-reasoner': { inputPrice: 0.28, outputPrice: 0.42, cacheWritesPrice: 0, cacheReadsPrice: 0.028, supportsThinking: true },
  },

  [AiProvider.OpenRouter]: {
    // openrouter provides usage info in the response
  },

  [AiProvider.OpenAI]: {
    'gpt-5-2025-08-07': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 0.125, supportsThinking: true },
    'gpt-5-mini-2025-08-07': { inputPrice: 0.25, outputPrice: 2, cacheWritesPrice: 0, cacheReadsPrice: 0.025, supportsThinking: false },
    'gpt-5-nano-2025-08-07': { inputPrice: 0.05, outputPrice: 0.4, cacheWritesPrice: 0, cacheReadsPrice: 0.005, supportsThinking: false },
    'gpt-5.1-2025-11-13': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 0.125, supportsThinking: true },
    'gpt-5.1-codex': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 0.125, supportsThinking: true },
  },

  [AiProvider.GoogleVertex]: {
    'gemini-2.5-pro': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 1.625, cacheReadsPrice: 0.125, supportsThinking: true },
    'gemini-2.5-flash': { inputPrice: 0.3, outputPrice: 2.5, cacheWritesPrice: 0, cacheReadsPrice: 0.075, supportsThinking: true },
    'gemini-2.5-flash-lite': { inputPrice: 0.1, outputPrice: 0.4, cacheWritesPrice: 0, cacheReadsPrice: 0.025, supportsThinking: false },
    'gemini-3-pro-preview': {
      inputPrice: 2,
      outputPrice: 12,
      cacheWritesPrice: 2.375,
      cacheReadsPrice: 0.2,
      supportsThinking: true,
    },
    'gemini-3-pro': {
      inputPrice: 2,
      outputPrice: 12,
      cacheWritesPrice: 2.375,
      cacheReadsPrice: 0.2,
      supportsThinking: true,
    },
  },
} as const satisfies Record<AiProvider, Record<string, ModelInfo>>
