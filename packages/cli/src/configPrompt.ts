import { input, password, select } from '@inquirer/prompts'
import { DEFAULT_MODELS } from './ApiProviderConfig'
import { AiProvider } from './getModel'
import prices from './prices'

export type ProviderConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
}

export async function configPrompt(existingConfig?: Partial<ProviderConfig>): Promise<ProviderConfig> {
  // select AI provider
  const provider = await select({
    message: 'Choose AI Provider:',
    choices: Object.entries(AiProvider).map(([key, value]) => ({ name: key, value })),
    default: existingConfig?.provider,
  })

  const modelChoices = Object.keys(prices[provider])
  const defaultModel = existingConfig?.model ?? DEFAULT_MODELS[provider]
  const model =
    modelChoices.length > 0
      ? await select({
          message: 'Choose Model ID:',
          choices: modelChoices.map((value) => ({ name: value, value })),
          default: modelChoices.includes(defaultModel) ? defaultModel : modelChoices[0],
        })
      : await input({ message: 'Enter Model ID:', default: defaultModel })

  const apiKey = await password({ message: 'Enter API Key:', mask: '*' })

  return { provider, model, apiKey }
}
