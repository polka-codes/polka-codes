import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { input, password, select } from '@inquirer/prompts'
import { stringify } from 'yaml'

import { AiServiceProvider, anthropicDefaultModelId, anthropicModels, deepSeekDefaultModelId } from '@polka-codes/core'

import { set } from 'lodash'
import { getGlobalConfigPath, loadConfigAtPath, localConfigFileName } from '../config'

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

type ProviderConfig = {
  provider: string
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
      // fetch model list from Ollama API

      break
    case AiServiceProvider.DeepSeek:
      model = deepSeekDefaultModelId
      break
  }

  let apiKey: string | undefined
  if (provider !== AiServiceProvider.Ollama) {
    apiKey = await password({ message: 'Enter API Key:', mask: '*' })
  }

  return { provider, model, apiKey }
}

async function printConfig(configPath: string) {
  const config = existsSync(configPath) ? loadConfigAtPath(configPath) : undefined
  if (!config) {
    console.log('No config found')
    return
  }
  console.log(`Config file path: ${configPath}`)
  if (config.providers) {
    for (const key of Object.keys(config.providers)) {
      if (config.providers[key as AiServiceProvider].apiKey) {
        config.providers[key as AiServiceProvider].apiKey = '<redacted>'
      }
    }
  }

  console.log(stringify(config))
}

export async function configCommand(options: { global?: boolean; print?: boolean }) {
  const globalConfigPath = getGlobalConfigPath()
  let configPath = options.global ? globalConfigPath : localConfigFileName

  if (options.print) {
    await printConfig(configPath)
    return
  }

  const existingConfig = existsSync(configPath) ? loadConfigAtPath(configPath) : undefined

  if (!existingConfig && !options.global) {
    const isGlobal = await select({
      message: 'No config file found. Do you want to create one?',
      choices: [
        {
          name: `Create a global config at ${globalConfigPath}`,
          value: true,
        },
        {
          name: `Create a local config at ${configPath}`,
          value: false,
        },
      ],
    })
    if (isGlobal) {
      configPath = globalConfigPath
    } else {
      configPath = localConfigFileName
    }
  }
  console.log(`Config file path: ${configPath}`)

  let { provider, model, apiKey } = await configPrompt({ provider: existingConfig?.defaultProvider, model: existingConfig?.defaultModel })

  if (apiKey && configPath === localConfigFileName) {
    const option = await select({
      message: 'It is not recommended to store API keys in the local config file. How would you like to proceed?',
      choices: [
        {
          name: 'Save API key in the local config file',
          value: 1,
        },
        {
          name: 'Save API key in the global config file',
          value: 2,
        },
        {
          name: 'Save API key to .env file',
          value: 3,
        },
      ],
    })

    switch (option) {
      case 1:
        // do nothing
        break
      case 2: {
        const globalConfig = loadConfigAtPath(globalConfigPath) ?? {}
        set(globalConfig, ['providers', provider, 'apiKey'], apiKey)
        mkdirSync(dirname(globalConfigPath), { recursive: true })
        writeFileSync(globalConfigPath, stringify(globalConfig))
        console.log(`API key saved to global config file: ${globalConfigPath}`)
        apiKey = undefined
        break
      }
      case 3: {
        let envFileContent: string
        if (existsSync('.env')) {
          envFileContent = readFileSync('.env', 'utf8')
          envFileContent += `\n${provider.toUpperCase()}_API_KEY=${apiKey}`
        } else {
          envFileContent = `${provider.toUpperCase()}_API_KEY=${apiKey}`
        }
        writeFileSync('.env', envFileContent)
        console.log('API key saved to .env file')
        apiKey = undefined
        break
      }
    }
  }

  const newConfig = {
    ...existingConfig,
    defaultProvider: provider,
    defaultModel: model,
  }
  if (apiKey) {
    set(newConfig, ['providers', provider, 'apiKey'], apiKey)
  }
  mkdirSync(dirname(configPath), { recursive: true })
  writeFileSync(configPath, stringify(newConfig))
  console.log(`Config file saved at: ${configPath}`)
  return
}
