import type { Config } from '@polka-codes/cli-shared'
import { type AiServiceProvider, type ToolFormat, defaultModels } from '@polka-codes/core'

const isSonnet4 = (model: string) => model.includes('claude-sonnet-4')

const getToolFormat = (model: string, toolFormat?: ToolFormat) => {
  if (toolFormat) {
    return toolFormat
  }
  if (isSonnet4(model)) {
    return 'native'
  }
  return 'polka-codes'
}

export class ApiProviderConfig {
  readonly defaultProvider?: AiServiceProvider
  readonly providers: Readonly<Partial<Record<AiServiceProvider, { apiKey: string; defaultModel?: string; defaultParameters: any }>>>
  readonly commands?: Partial<Record<string, { provider?: AiServiceProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>>
  readonly agents?: Partial<Record<string, { provider?: AiServiceProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>>
  readonly defaultParameters: any
  readonly toolFormat?: ToolFormat

  constructor(config: Config) {
    this.defaultProvider = config.defaultProvider as AiServiceProvider | undefined
    this.defaultParameters = config.defaultParameters ?? {}
    this.providers = config.providers ?? {}
    this.commands = config.commands as Partial<
      Record<string, { provider?: AiServiceProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>
    >
    this.agents = config.agents as Partial<
      Record<string, { provider?: AiServiceProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>
    >
    this.toolFormat = config.toolFormat
  }

  getConfigForCommand(command: string) {
    // TODO: strong type command
    const { provider, model, parameters, toolFormat } = this.commands?.[command] ?? this.commands?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const finalModel = model ?? this.providers[finalProvider]?.defaultModel ?? defaultModels[finalProvider]
    const apiKey = this.providers[finalProvider]?.apiKey
    const finalParameters = {
      ...this.defaultParameters,
      ...(this.providers[finalProvider]?.defaultParameters ?? {}),
      ...(parameters ?? {}),
    }
    const finalToolFormat = getToolFormat(finalModel, toolFormat ?? this.toolFormat)
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      parameters: finalParameters,
      toolFormat: finalToolFormat,
    }
  }

  getConfigForAgent(agent: string) {
    // TODO: strong type agent
    const { provider, model, parameters, toolFormat } = this.agents?.[agent] ?? this.agents?.default ?? {}
    const finalProvider = provider ?? this.defaultProvider
    if (!finalProvider) {
      return undefined
    }
    const finalModel = model ?? this.providers[finalProvider]?.defaultModel ?? defaultModels[finalProvider]
    const apiKey = this.providers[finalProvider]?.apiKey
    const finalParameters = {
      ...this.defaultParameters,
      ...(this.providers[finalProvider]?.defaultParameters ?? {}),
      ...(parameters ?? {}),
    }
    const finalToolFormat = getToolFormat(finalModel, toolFormat ?? this.toolFormat)
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      parameters: finalParameters,
      toolFormat: finalToolFormat,
    }
  }
}
