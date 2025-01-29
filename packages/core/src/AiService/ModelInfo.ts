// source: https://github.com/cline/cline/blob/1f2acc519bc71bd8f38f4df87af0e07876cba0f6/src/shared/api.ts

export interface ModelInfo {
  maxTokens?: number
  contextWindow?: number
  supportsImages?: boolean
  supportsComputerUse?: boolean
  supportsPromptCache?: boolean
  inputPrice?: number
  outputPrice?: number
  cacheWritesPrice?: number
  cacheReadsPrice?: number
}

// Anthropic
// https://docs.anthropic.com/en/docs/about-claude/models
export type AnthropicModelId = keyof typeof anthropicModels
export const anthropicDefaultModelId: AnthropicModelId = 'claude-3-5-sonnet-20241022'
export const anthropicModels = {
  'claude-3-5-sonnet-20241022': {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: true,
    supportsComputerUse: true,
    supportsPromptCache: true,
    inputPrice: 3.0, // $3 per million input tokens
    outputPrice: 15.0, // $15 per million output tokens
    cacheWritesPrice: 3.75, // $3.75 per million tokens
    cacheReadsPrice: 0.3, // $0.30 per million tokens
  },
  'claude-3-5-haiku-20241022': {
    maxTokens: 8192,
    contextWindow: 200_000,
    supportsImages: false,
    supportsPromptCache: true,
    inputPrice: 0.8,
    outputPrice: 4.0,
    cacheWritesPrice: 1.0,
    cacheReadsPrice: 0.08,
  },
  'claude-3-opus-20240229': {
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
    supportsPromptCache: true,
    inputPrice: 15.0,
    outputPrice: 75.0,
    cacheWritesPrice: 18.75,
    cacheReadsPrice: 1.5,
  },
  'claude-3-haiku-20240307': {
    maxTokens: 4096,
    contextWindow: 200_000,
    supportsImages: true,
    supportsPromptCache: true,
    inputPrice: 0.25,
    outputPrice: 1.25,
    cacheWritesPrice: 0.3,
    cacheReadsPrice: 0.03,
  },
} as const satisfies Record<string, ModelInfo>

export const openAiModelInfoSaneDefaults = {
  maxTokens: -1,
  contextWindow: 128_000,
  supportsImages: true,
  supportsPromptCache: false,
  inputPrice: 0,
  outputPrice: 0,
} as const satisfies ModelInfo

// DeepSeek
// https://api-docs.deepseek.com/quick_start/pricing
export type DeepSeekModelId = keyof typeof deepSeekModels
export const deepSeekDefaultModelId: DeepSeekModelId = 'deepseek-chat'
export const deepSeekModels = {
  'deepseek-chat': {
    maxTokens: 8_000,
    contextWindow: 64_000,
    supportsImages: false,
    supportsPromptCache: true, // supports context caching, but not in the way anthropic does it (deepseek reports input tokens and reads/writes in the same usage report) FIXME: we need to show users cache stats how deepseek does it
    inputPrice: 0, // technically there is no input price, it's all either a cache hit or miss (ApiOptions will not show this)
    outputPrice: 0.28,
    cacheWritesPrice: 0.14,
    cacheReadsPrice: 0.014,
  },
  'deepseek-reasoner': {
    maxTokens: 8_000,
    contextWindow: 64_000,
    supportsImages: false,
    supportsPromptCache: true,
    inputPrice: 0,
    outputPrice: 2.19,
    cacheWritesPrice: 0.55,
    cacheReadsPrice: 0.14,
  },
} as const satisfies Record<string, ModelInfo>
