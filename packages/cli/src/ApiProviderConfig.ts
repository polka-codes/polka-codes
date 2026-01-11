import type { Config } from '@polka-codes/cli-shared'
import type { ConfigRule, ProviderConfig } from '@polka-codes/core'
import { AiProvider } from './getModel'

const defaultModels = {
  [AiProvider.Anthropic]: 'claude-sonnet-4-20250514',
  [AiProvider.Ollama]: 'deepseek-r1:32b',
  [AiProvider.DeepSeek]: 'deepseek-chat',
  [AiProvider.OpenRouter]: 'google/gemini-2.5-pro',
  [AiProvider.OpenAI]: 'gpt-5-2025-08-07',
  [AiProvider.OpenAICompatible]: 'gpt-4o',
  [AiProvider.GoogleVertex]: 'gemini-2.5-pro',
  [AiProvider.Google]: 'gemini-2.5-pro',
}

export class ApiProviderConfig {
  readonly defaultProvider?: AiProvider
  readonly providers: Readonly<Partial<Record<AiProvider, ProviderConfig>>>
  readonly commands?: Config['commands']
  readonly defaultParameters: Record<string, unknown>

  constructor(config: Config) {
    this.defaultProvider = config.defaultProvider as AiProvider | undefined
    this.defaultParameters = config.defaultParameters ?? {}
    this.providers = config.providers ?? {}
    this.commands = config.commands
  }

  getConfigForCommand(command: string) {
    // TODO: strong type command
    const commandConfig = this.commands?.[command]
    const defaultConfig = this.commands?.default
    const mergedConfig = { ...defaultConfig, ...commandConfig }
    return this.resolveModelConfig(mergedConfig)
  }

  resolveModelConfig(config: {
    provider?: string
    model?: string
    parameters?: Record<string, unknown>
    budget?: number
    rules?: ConfigRule[] | string
  }) {
    const { provider, model, parameters, budget, rules } = config
    const finalProvider = (provider as AiProvider) ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const { apiKey, defaultModel, defaultParameters, location, project, keyFile, baseUrl, name } = this.providers[finalProvider] ?? {}
    const finalModel = model ?? defaultModel ?? defaultModels[finalProvider]
    const finalParameters = {
      ...this.defaultParameters,
      ...(defaultParameters ?? {}),
      ...(parameters ?? {}),
    }
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      location,
      project,
      keyFile,
      baseUrl,
      name,
      parameters: finalParameters,
      budget,
      rules,
    }
  }
}
