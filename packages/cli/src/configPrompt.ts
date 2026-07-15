import { input, password, select } from '@inquirer/prompts'
import { AiProvider } from './getModel'
import prices from './prices'

export type ProviderConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
  baseURL?: string
}

export async function configPrompt(existingConfig?: Partial<ProviderConfig>): Promise<ProviderConfig> {
  // select AI provider
  const provider = await select({
    message: 'Choose AI Provider:',
    choices: Object.entries(AiProvider).map(([key, value]) => ({ name: key, value })),
    default: existingConfig?.provider,
  })

  let model = existingConfig?.model

  switch (provider) {
    case AiProvider.Anthropic:
      model = await select({
        message: 'Choose Model ID:',
        choices: Object.keys(prices[AiProvider.Anthropic]).map((key) => ({ name: key, value: key })),
        default: existingConfig?.model ?? 'claude-opus-4-20250514',
      })
      break
    case AiProvider.DeepSeek: {
      const deepSeekModels = ['deepseek-chat', 'deepseek-reasoner'] as const
      const defaultModel = deepSeekModels.find((candidate) => candidate === existingConfig?.model) ?? 'deepseek-chat'

      model = await select({
        message: 'Choose Model ID:',
        choices: deepSeekModels.map((value) => ({ name: value, value })),
        default: defaultModel,
      })
      break
    }
    case AiProvider.OpenRouter:
      // TODO: search for models
      model = await input({ message: 'Enter Model ID (Visit https://openrouter.ai/models for available models):' })
      break
  }

  const apiKey = await password({ message: 'Enter API Key:', mask: '*' })

  let baseURL: string | undefined

  return { provider, model: model as string, apiKey, baseURL }
}
