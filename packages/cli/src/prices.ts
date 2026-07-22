import { AiProvider } from './getModel'

export type ModelInfo = {
  inputPrice: number // USD per 1 M prompt tokens
  outputPrice: number // USD per 1 M completion tokens
  cacheWritesPrice: number // prompt-caching write cost (where offered)
  cacheReadsPrice: number // prompt-caching read/"cached input" cost
  supportsThinking?: boolean
}

const googleModelPrices = {
  'gemini-3.6-flash': { inputPrice: 1.5, outputPrice: 7.5, cacheWritesPrice: 0, cacheReadsPrice: 0.15, supportsThinking: true },
  'gemini-3.5-flash': { inputPrice: 1.5, outputPrice: 9, cacheWritesPrice: 0, cacheReadsPrice: 0.15, supportsThinking: true },
  'gemini-3.5-flash-lite': { inputPrice: 0.3, outputPrice: 2.5, cacheWritesPrice: 0, cacheReadsPrice: 0.03, supportsThinking: true },
  'gemini-3.1-pro-preview': { inputPrice: 2, outputPrice: 12, cacheWritesPrice: 0, cacheReadsPrice: 0.2, supportsThinking: true },
  'gemini-3.1-flash-lite': { inputPrice: 0.25, outputPrice: 1.5, cacheWritesPrice: 0, cacheReadsPrice: 0.025, supportsThinking: true },
  'gemini-3-flash-preview': { inputPrice: 0.5, outputPrice: 3, cacheWritesPrice: 0, cacheReadsPrice: 0.05, supportsThinking: true },
  'gemini-1.5-pro': { inputPrice: 1.25, outputPrice: 5, cacheWritesPrice: 0, cacheReadsPrice: 0.31, supportsThinking: false },
  'gemini-1.5-flash': { inputPrice: 0.075, outputPrice: 0.3, cacheWritesPrice: 0, cacheReadsPrice: 0.01875, supportsThinking: false },
  'gemini-2.0-flash': { inputPrice: 0.1, outputPrice: 0.4, cacheWritesPrice: 0, cacheReadsPrice: 0.025, supportsThinking: false },
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
} satisfies Record<string, ModelInfo>

export default {
  [AiProvider.Anthropic]: {
    'claude-fable-5': { inputPrice: 10, outputPrice: 50, cacheWritesPrice: 12.5, cacheReadsPrice: 1, supportsThinking: false },
    'claude-opus-4-8': { inputPrice: 5, outputPrice: 25, cacheWritesPrice: 6.25, cacheReadsPrice: 0.5, supportsThinking: false },
    // Introductory pricing through August 31, 2026; standard pricing is $3/$15 afterward.
    'claude-sonnet-5': { inputPrice: 2, outputPrice: 10, cacheWritesPrice: 2.5, cacheReadsPrice: 0.2, supportsThinking: false },
    'claude-haiku-4-5': { inputPrice: 1, outputPrice: 5, cacheWritesPrice: 1.25, cacheReadsPrice: 0.1, supportsThinking: true },
    'claude-haiku-4-5-20251001': { inputPrice: 1, outputPrice: 5, cacheWritesPrice: 1.25, cacheReadsPrice: 0.1, supportsThinking: true },
    'claude-opus-4-5-20251101': { inputPrice: 5, outputPrice: 25, cacheWritesPrice: 6.25, cacheReadsPrice: 0.5, supportsThinking: true },
    'claude-sonnet-4-5-20250929': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: true },
    'claude-opus-4-20250514': { inputPrice: 15, outputPrice: 75, cacheWritesPrice: 18.75, cacheReadsPrice: 1.5, supportsThinking: true },
    'claude-opus-4-1-20250805': { inputPrice: 15, outputPrice: 75, cacheWritesPrice: 18.75, cacheReadsPrice: 1.5, supportsThinking: true },
    'claude-sonnet-4-20250514': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: true },
    'claude-3-7-sonnet-20250219': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: true },
    'claude-3-5-sonnet-20241022': { inputPrice: 3, outputPrice: 15, cacheWritesPrice: 3.75, cacheReadsPrice: 0.3, supportsThinking: false },
    'claude-3-5-haiku-20241022': { inputPrice: 0.8, outputPrice: 4.0, cacheWritesPrice: 1, cacheReadsPrice: 0.08, supportsThinking: false },
  },

  [AiProvider.DeepSeek]: {
    'deepseek-v4-flash': { inputPrice: 0.14, outputPrice: 0.28, cacheWritesPrice: 0, cacheReadsPrice: 0.0028, supportsThinking: true },
    'deepseek-v4-pro': { inputPrice: 0.435, outputPrice: 0.87, cacheWritesPrice: 0, cacheReadsPrice: 0.003625, supportsThinking: true },
    'deepseek-chat': { inputPrice: 0.14, outputPrice: 0.28, cacheWritesPrice: 0, cacheReadsPrice: 0.0028 },
    'deepseek-reasoner': { inputPrice: 0.14, outputPrice: 0.28, cacheWritesPrice: 0, cacheReadsPrice: 0.0028, supportsThinking: true },
  },

  [AiProvider.OpenRouter]: {
    // openrouter provides usage info in the response
  },

  [AiProvider.OpenAI]: {
    'gpt-5.6': { inputPrice: 5, outputPrice: 30, cacheWritesPrice: 6.25, cacheReadsPrice: 0.5, supportsThinking: true },
    'gpt-5.6-sol': { inputPrice: 5, outputPrice: 30, cacheWritesPrice: 6.25, cacheReadsPrice: 0.5, supportsThinking: true },
    'gpt-5.6-terra': { inputPrice: 2.5, outputPrice: 15, cacheWritesPrice: 3.125, cacheReadsPrice: 0.25, supportsThinking: true },
    'gpt-5.6-luna': { inputPrice: 1, outputPrice: 6, cacheWritesPrice: 1.25, cacheReadsPrice: 0.1, supportsThinking: true },
    'gpt-4o': { inputPrice: 2.5, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 1.25, supportsThinking: false },
    'gpt-4o-mini': { inputPrice: 0.15, outputPrice: 0.6, cacheWritesPrice: 0, cacheReadsPrice: 0.075, supportsThinking: false },
    o1: { inputPrice: 15, outputPrice: 60, cacheWritesPrice: 0, cacheReadsPrice: 7.5, supportsThinking: true },
    'o3-mini': { inputPrice: 1.1, outputPrice: 4.4, cacheWritesPrice: 0, cacheReadsPrice: 0.55, supportsThinking: true },
    'gpt-5-2025-08-07': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 0.125, supportsThinking: true },
    'gpt-5-mini-2025-08-07': { inputPrice: 0.25, outputPrice: 2, cacheWritesPrice: 0, cacheReadsPrice: 0.025, supportsThinking: false },
    'gpt-5-nano-2025-08-07': { inputPrice: 0.05, outputPrice: 0.4, cacheWritesPrice: 0, cacheReadsPrice: 0.005, supportsThinking: false },
    'gpt-5.1-2025-11-13': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 0.125, supportsThinking: true },
    'gpt-5.1-codex': { inputPrice: 1.25, outputPrice: 10, cacheWritesPrice: 0, cacheReadsPrice: 0.125, supportsThinking: true },
  },

  [AiProvider.OpenAICompatible]: {
    // OpenAI-compatible providers have varying pricing
    // Configure pricing in your config file for accurate cost tracking
  },

  [AiProvider.GoogleVertex]: googleModelPrices,
  [AiProvider.Google]: googleModelPrices,
} as const satisfies Record<AiProvider, Record<string, ModelInfo>>
