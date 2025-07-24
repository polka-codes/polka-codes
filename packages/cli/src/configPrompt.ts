import { input, password, select } from '@inquirer/prompts'
import { AiProvider } from './getModel'
import prices from './prices'

const fetchOllamaModels = async () => {
  try {
    const resp = await fetch('http://localhost:11434/api/tags')
    const data = await resp.json()
    return data.models.map((model: any) => model.name) as string[]
  } catch (_error) {
    console.log('Unable to fetch Ollama models')
    return []
  }
}

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

  let model = existingConfig?.model

  switch (provider) {
    case AiProvider.Anthropic:
      model = await select({
        message: 'Choose Model ID:',
        choices: Object.keys(prices[AiProvider.Anthropic]).map((key) => ({ name: key, value: key })),
        default: existingConfig?.model ?? 'claude-opus-4-20250514',
      })
      break
    case AiProvider.Ollama:
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
    case AiProvider.DeepSeek:
      model = await select({
        message: 'Choose Model ID:',
        choices: [
          { name: 'deepseek-chat', value: 'deepseek-chat' },
          { name: 'deepseek-reasoner', value: 'deepseek-reasoner' },
        ],
        default: existingConfig?.model ?? 'deepseek-chat',
      })
      break
    case AiProvider.OpenRouter:
      // TODO: search for models
      model = await input({ message: 'Enter Model ID (Visit https://openrouter.ai/models for available models):' })
      break
  }

  let apiKey: string | undefined
  if (provider !== AiProvider.Ollama) {
    apiKey = await password({ message: 'Enter API Key:', mask: '*' })
  }

  return { provider, model: model as string, apiKey }
}
