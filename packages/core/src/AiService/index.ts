import type { AiServiceBase, AiServiceOptions, ApiUsage, MessageParam } from './AiServiceBase'
import { AnthropicService } from './AnthropicService'
import { DeepSeekService } from './DeepSeekService'
import type { ModelInfo } from './ModelInfo'
import { OllamaService } from './OllamaService'

export enum AiServiceProvider {
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  DeepSeek = 'deepseek',
}

export const defaultModels = {
  [AiServiceProvider.Anthropic]: 'claude-3-5-sonnet-20241022',
  [AiServiceProvider.Ollama]: 'maryasov/qwen2.5-coder-cline:7b',
  [AiServiceProvider.DeepSeek]: 'deepseek-chat',
}

export const createService = (provider: AiServiceProvider, options: AiServiceOptions) => {
  switch (provider) {
    case AiServiceProvider.Anthropic:
      return new AnthropicService(options)
    case AiServiceProvider.Ollama:
      return new OllamaService(options)
    case AiServiceProvider.DeepSeek:
      return new DeepSeekService(options)
  }
}

export type { MessageParam, AiServiceOptions, AiServiceBase, ModelInfo, ApiUsage }
