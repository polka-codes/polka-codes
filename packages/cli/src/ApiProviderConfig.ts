import type { Config } from '@polka-codes/cli-shared'
import { AiProvider } from './getModel'

const defaultModels = {
  [AiProvider.Anthropic]: 'claude-sonnet-4-20250514',
  [AiProvider.Ollama]: 'deepseek-r1:32b',
  [AiProvider.DeepSeek]: 'deepseek-chat',
  [AiProvider.OpenRouter]: 'google/gemini-2.5-pro',
  [AiProvider.OpenAI]: 'gpt-5-2025-08-07',
  [AiProvider.GoogleVertex]: 'gemini-2.5-pro',
}

export class ApiProviderConfig {
  readonly defaultProvider?: AiProvider
  readonly providers: Readonly<Partial<Record<AiProvider, { apiKey: string; defaultModel?: string; defaultParameters: any }>>>
  readonly commands?: Partial<Record<string, { provider?: AiProvider; model?: string; parameters: any }>>
  readonly defaultParameters: any

  constructor(config: Config) {
    this.defaultProvider = config.defaultProvider as AiProvider | undefined
    this.defaultParameters = config.defaultParameters ?? {}
    this.providers = config.providers ?? {}
    this.commands = config.commands as Partial<Record<string, { provider?: AiProvider; model?: string; parameters: any }>>
  }

  getConfigForCommand(command: string) {
    // TODO: strong type command
    const { provider, model, parameters } = this.commands?.[command] ?? this.commands?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const { apiKey, defaultModel, defaultParameters, location, project, keyFile, baseUrl } = (this.providers[finalProvider] as any) ?? {}
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
      parameters: finalParameters,
    }
  }
}
