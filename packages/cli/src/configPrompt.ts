import { input, password, select } from '@inquirer/prompts'
import type { ProviderConfig as ProviderSettings } from '@polka-codes/core'
import { DEFAULT_MODELS } from './ApiProviderConfig'
import { AiProvider } from './getModel'
import prices from './prices'

export type PromptedProviderConfig = {
  provider: AiProvider
  model: string
  settings: ProviderSettings
}

type ExistingProviderConfig = Partial<Omit<PromptedProviderConfig, 'settings'>> & {
  settings?: Partial<ProviderSettings>
}

const API_KEY_ENVIRONMENT_VARIABLES: Partial<Record<AiProvider, string>> = {
  [AiProvider.Anthropic]: 'ANTHROPIC_API_KEY',
  [AiProvider.DeepSeek]: 'DEEPSEEK_API_KEY',
  [AiProvider.OpenRouter]: 'OPENROUTER_API_KEY',
  [AiProvider.OpenAI]: 'OPENAI_API_KEY',
  [AiProvider.OpenAICompatible]: 'POLKA_API_KEY',
  [AiProvider.Google]: 'GOOGLE_API_KEY',
}

export function getApiKeyEnvironmentVariable(provider: AiProvider): string | undefined {
  return API_KEY_ENVIRONMENT_VARIABLES[provider]
}

export function isAiProvider(value: string | undefined): value is AiProvider {
  return Object.values(AiProvider).some((provider) => provider === value)
}

export async function configPrompt(existingConfig: ExistingProviderConfig = {}): Promise<PromptedProviderConfig> {
  // select AI provider
  const provider = await select({
    message: 'Choose AI Provider:',
    choices: Object.entries(AiProvider).map(([key, value]) => ({ name: key, value })),
    default: existingConfig.provider,
  })

  const modelChoices = Object.keys(prices[provider])
  const existingSettings = provider === existingConfig.provider ? existingConfig.settings : undefined
  const defaultModel = (provider === existingConfig.provider ? existingConfig.model : undefined) ?? DEFAULT_MODELS[provider]
  const model =
    modelChoices.length > 0
      ? await select({
          message: 'Choose Model ID:',
          choices: modelChoices.map((value) => ({ name: value, value })),
          default: modelChoices.includes(defaultModel) ? defaultModel : modelChoices[0],
        })
      : await input({ message: 'Enter Model ID:', default: defaultModel })

  const settings: ProviderSettings = {}

  if (provider === AiProvider.OpenAICompatible) {
    settings.baseUrl = await input({
      message: 'Enter API base URL:',
      default: existingSettings?.baseUrl,
      validate: (value) => value.trim().length > 0 || 'API base URL is required',
    })
    const name = await input({
      message: 'Enter provider name (optional):',
      default: existingSettings?.name,
    })
    settings.name = name || undefined
  } else if (provider === AiProvider.GoogleVertex) {
    const project = await input({ message: 'Enter Google Cloud project ID (optional):', default: existingSettings?.project })
    const location = await input({ message: 'Enter Google Cloud location (optional):', default: existingSettings?.location })
    const keyFile = await input({
      message: 'Enter service account key file path (optional):',
      default: existingSettings?.keyFile,
    })
    settings.project = project || undefined
    settings.location = location || undefined
    settings.keyFile = keyFile || undefined
  }

  if (getApiKeyEnvironmentVariable(provider)) {
    const apiKey = await password({ message: 'Enter API Key (optional):', mask: '*' })
    if (apiKey) {
      settings.apiKey = apiKey
    }
  }

  return { provider, model, settings }
}
