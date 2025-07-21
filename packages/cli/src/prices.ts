import { AiProvider } from './getModel'

export type ModelInfo = {
  inputPrice: number // USD per 1 M prompt tokens
  outputPrice: number // USD per 1 M completion tokens
  cacheWritesPrice: number // prompt-caching write cost (where offered)
  cacheReadsPrice: number // prompt-caching read/“cached input” cost
}

export default {
  [AiProvider.Anthropic]: {
    'claude-opus-4-20250514': { inputPrice: 15, outputPrice: 75, cacheWritesPrice: 18.75, cacheReadsPrice: 1.5 },
    'claude-sonnet-4-20250514': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3 },
    'claude-3-7-sonnet-20250219': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3 },
    'claude-3-5-sonnet-20241022': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3 },
    'claude-3-5-haiku-20241022': { inputPrice: 0.8, outputPrice: 4, cacheWritesPrice: 1, cacheReadsPrice: 0.08 },
  },

  [AiProvider.Ollama]: {},

  [AiProvider.DeepSeek]: {
    'deepseek-chat': { inputPrice: 0.27, outputPrice: 1.1, cacheWritesPrice: 0, cacheReadsPrice: 0.07 },
    'deepseek-reasoner': { inputPrice: 0.55, outputPrice: 2.19, cacheWritesPrice: 0, cacheReadsPrice: 0.14 },
  },

  [AiProvider.OpenRouter]: {
    // openrouter provides usage info in the response
  },

  [AiProvider.OpenAI]: {
    'gpt-4.1': { inputPrice: 2, outputPrice: 8, cacheWritesPrice: 0.5, cacheReadsPrice: 0.5 },
    'gpt-4.1-mini': { inputPrice: 0.4, outputPrice: 1.6, cacheWritesPrice: 0.1, cacheReadsPrice: 0.1 },
    'gpt-4.1-nano': { inputPrice: 0.1, outputPrice: 0.4, cacheWritesPrice: 0.025, cacheReadsPrice: 0.025 },
    'o4-mini': { inputPrice: 1.1, outputPrice: 4.4, cacheWritesPrice: 0.275, cacheReadsPrice: 0.275 },
  },
} as const satisfies Record<AiProvider, Record<string, ModelInfo>>
