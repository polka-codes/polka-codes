import type { Config } from '@polka-codes/cli-shared'
import type { ToolFormat } from '@polka-codes/core'
import { AiProvider } from './getModel'

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

const defaultModels = {
  [AiProvider.Anthropic]: 'claude-sonnet-4-20250514',
  [AiProvider.Ollama]: 'deepseek-r1:32b',
  [AiProvider.DeepSeek]: 'deepseek-chat',
  [AiProvider.OpenRouter]: 'google/gemini-2.5-pro',
  [AiProvider.OpenAI]: 'gpt-4.1',
  [AiProvider.GoogleVertex]: 'gemini-2.5-pro',
}

export class ApiProviderConfig {
  readonly defaultProvider?: AiProvider
  readonly providers: Readonly<Partial<Record<AiProvider, { apiKey: string; defaultModel?: string; defaultParameters: any }>>>
  readonly commands?: Partial<Record<string, { provider?: AiProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>>
  readonly agents?: Partial<Record<string, { provider?: AiProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>>
  readonly defaultParameters: any
  readonly toolFormat?: ToolFormat

  constructor(config: Config) {
    this.defaultProvider = config.defaultProvider as AiProvider | undefined
    this.defaultParameters = config.defaultParameters ?? {}
    this.providers = config.providers ?? {}
    this.commands = config.commands as Partial<
      Record<string, { provider?: AiProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>
    >
    this.agents = config.agents as Partial<
      Record<string, { provider?: AiProvider; model?: string; parameters: any; toolFormat?: ToolFormat }>
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
    const { apiKey, defaultModel, defaultParameters, location, project, keyFile } = (this.providers[finalProvider] as any) ?? {}
    const finalModel = model ?? defaultModel ?? defaultModels[finalProvider]
    const finalParameters = {
      ...this.defaultParameters,
      ...(defaultParameters ?? {}),
      ...(parameters ?? {}),
    }
    const finalToolFormat = getToolFormat(finalModel, toolFormat ?? this.toolFormat)
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      location,
      project,
      keyFile,
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
    const { apiKey, defaultModel, defaultParameters, location, project, keyFile } = (this.providers[finalProvider] as any) ?? {}
    const finalModel = model ?? defaultModel ?? defaultModels[finalProvider]
    const finalParameters = {
      ...this.defaultParameters,
      ...(defaultParameters ?? {}),
      ...(parameters ?? {}),
    }
    const finalToolFormat = getToolFormat(finalModel, toolFormat ?? this.toolFormat)
    return {
      provider: finalProvider,
      model: finalModel,
      apiKey,
      location,
      project,
      keyFile,
      parameters: finalParameters,
      toolFormat: finalToolFormat,
    }
  }
}
