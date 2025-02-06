import type { AiServiceProvider } from '@polka-codes/core'
import type { Config } from './config'

export class ApiProviderConfig {
  readonly defaultProvider?: AiServiceProvider
  readonly providers: Readonly<Partial<Record<AiServiceProvider, { apiKey: string; defaultModel?: string }>>>
  readonly commands?: Partial<Record<string, { provider?: AiServiceProvider; model?: string }>>
  readonly agents?: Partial<Record<string, { provider?: AiServiceProvider; model?: string }>>

  constructor(config: Config) {
    this.defaultProvider = config.defaultProvider as AiServiceProvider | undefined
    this.providers = config.providers ?? {}
    this.commands = config.commands as Partial<Record<string, { provider?: AiServiceProvider; model?: string }>>
    this.agents = config.agents as Partial<Record<string, { provider?: AiServiceProvider; model?: string }>>
  }

  getConfigForCommand(command: string) {
    // TODO: strong type command
    const { provider, model } = this.commands?.[command] ?? this.commands?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const finalModel = model ?? this.providers[finalProvider]?.defaultModel
    const apiKey = this.providers[finalProvider]?.apiKey
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
    }
  }

  getConfigForAgent(agent: string) {
    // TODO: strong type agent
    const { provider, model } = this.agents?.[agent] ?? this.agents?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const finalModel = model ?? this.providers[finalProvider]?.defaultModel
    const apiKey = this.providers[finalProvider]?.apiKey
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
    }
  }
}
