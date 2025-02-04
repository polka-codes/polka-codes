import { input, password, select } from '@inquirer/prompts'
import { AiServiceProvider, anthropicDefaultModelId, anthropicModels, deepSeekDefaultModelId } from '@polka-codes/core'

const fetchOllamaModels = async () => {
  try {
    const resp = await fetch('http://localhost:11434/api/tags')
    const data = await resp.json()
    return data.models.map((model: any) => model.name) as string[]
  } catch (error) {
    console.log('Unable to fetch Ollama models')
    return []
  }
}

export type ProviderConfig = {
  provider: AiServiceProvider
  model: string
  apiKey?: string
}

export async function configPrompt(existingConfig?: Partial<ProviderConfig>): Promise<ProviderConfig> {
  // select AI provider
  const provider = await select({
    message: 'Choose AI Provider:',
    choices: Object.entries(AiServiceProvider).map(([key, value]) => ({ name: key, value })),
    default: existingConfig?.provider,
  })

  let model = existingConfig?.model

  switch (provider) {
    case AiServiceProvider.Anthropic:
      model = await select({
        message: 'Choose Model ID:',
        choices: Object.keys(anthropicModels).map((key) => ({ name: key, value: key })),
        default: existingConfig?.model ?? anthropicDefaultModelId,
      })
      break
    case AiServiceProvider.Ollama:
      {
        // fetch model list from Ollama API
        const models = await fetchOllamaModels()
        if (models && models.length > 0) {
          model = await select({
            message: 'Choose Model ID:',
            choices: models.map((model) => ({ name: model, value: model })),
            default: existingConfig?.model,
          })
        } else {
          model = await input({ message: 'Enter Model ID:' })
        }
      }
      break
    case AiServiceProvider.DeepSeek:
      model = deepSeekDefaultModelId
      break
    case AiServiceProvider.OpenRouter:
      // TODO: search for models
      model = await input({ message: 'Enter Model ID (Visit https://openrouter.ai/models for available models):' })
      break
  }

  let apiKey: string | undefined
  if (provider !== AiServiceProvider.Ollama) {
    apiKey = await password({ message: 'Enter API Key:', mask: '*' })
  }

  return { provider, model, apiKey }
}
