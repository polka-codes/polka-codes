import { type AiServiceProvider, defaultModels } from '@polka-codes/core'
import type { Config } from './config'

export class ApiProviderConfig {
  readonly defaultProvider?: AiServiceProvider
  readonly providers: Readonly<Partial<Record<AiServiceProvider, { apiKey: string; defaultModel?: string; defaultParameters: any }>>>
  readonly commands?: Partial<Record<string, { provider?: AiServiceProvider; model?: string; parameters: any }>>
  readonly agents?: Partial<Record<string, { provider?: AiServiceProvider; model?: string; parameters: any }>>

  constructor(config: Config) {
    this.defaultProvider = config.defaultProvider as AiServiceProvider | undefined
    this.providers = config.providers ?? {}
    this.commands = config.commands as Partial<Record<string, { provider?: AiServiceProvider; model?: string; parameters: any }>>
    this.agents = config.agents as Partial<Record<string, { provider?: AiServiceProvider; model?: string; parameters: any }>>
  }

  getConfigForCommand(command: string) {
    // TODO: strong type command
    const { provider, model, parameters } = this.commands?.[command] ?? this.commands?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const finalModel = model ?? this.providers[finalProvider]?.defaultModel ?? defaultModels[finalProvider]
    const apiKey = this.providers[finalProvider]?.apiKey
    const finalParameters = parameters ?? this.providers[finalProvider]?.defaultParameters ?? {}
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      parameters: finalParameters,
    }
  }

  getConfigForAgent(agent: string) {
    // TODO: strong type agent
    const { provider, model, parameters } = this.agents?.[agent] ?? this.agents?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const finalModel = model ?? this.providers[finalProvider]?.defaultModel ?? defaultModels[finalProvider]
    const apiKey = this.providers[finalProvider]?.apiKey
    const finalParameters = parameters ?? this.providers[finalProvider]?.defaultParameters ?? {}
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      parameters: finalParameters,
    }
  }
}
