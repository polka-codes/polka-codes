import type { AiServiceOptions, ApiStream, ApiStreamChunk, ApiUsage, MessageParam } from './AiServiceBase'
import { AiServiceBase } from './AiServiceBase'
import { AnthropicService } from './AnthropicService'
import { DeepSeekService } from './DeepSeekService'
import type { ModelInfo } from './ModelInfo'
import { OllamaService } from './OllamaService'
import { OpenRouterService } from './OpenRouterService'
import { UsageMeter } from './UsageMeter'

export enum AiServiceProvider {
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  DeepSeek = 'deepseek',
  OpenRouter = 'openrouter',
}

export const defaultModels = {
  [AiServiceProvider.Anthropic]: 'claude-3-7-sonnet-20250219',
  [AiServiceProvider.Ollama]: 'maryasov/qwen2.5-coder-cline:7b',
  [AiServiceProvider.DeepSeek]: 'deepseek-chat',
  [AiServiceProvider.OpenRouter]: 'anthropic/claude-3.7-sonnet',
}

export const createService = (provider: AiServiceProvider, options: AiServiceOptions) => {
  switch (provider) {
    case AiServiceProvider.Anthropic:
      return new AnthropicService(options)
    case AiServiceProvider.Ollama:
      return new OllamaService(options)
    case AiServiceProvider.DeepSeek:
      return new DeepSeekService(options)
    case AiServiceProvider.OpenRouter:
      // fetch model from OpenRouter API
      return new OpenRouterService(options)
  }
}

export { UsageMeter, AiServiceBase }

export type { MessageParam, AiServiceOptions, ModelInfo, ApiUsage, ApiStream, ApiStreamChunk }
