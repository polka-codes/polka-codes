import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { input, password, select } from '@inquirer/prompts'
import { stringify } from 'yaml'

import { AiServiceProvider, anthropicDefaultModelId, anthropicModels, createServiceLogger, deepSeekDefaultModelId } from '@polka-codes/core'

import { merge } from 'lodash'
import { getGlobalConfigPath, loadConfigAtPath, localConfigFileName } from '../config'

const logger = createServiceLogger('cli/config')

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

export async function configPrompt(options: { global?: boolean }, save: boolean) {
  const globalConfigPath = getGlobalConfigPath()
  let configPath = options.global ? globalConfigPath : localConfigFileName
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

  // select AI provider
  const provider = await select({
    message: 'Choose AI Provider:',
    choices: Object.entries(AiServiceProvider).map(([key, value]) => ({ name: key, value })),
    default: existingConfig?.provider,
  })

  let modelId = existingConfig?.modelId

  switch (provider) {
    case AiServiceProvider.Anthropic:
      modelId = await select({
        message: 'Choose Model ID:',
        choices: Object.keys(anthropicModels).map((key) => ({ name: key, value: key })),
        default: existingConfig?.modelId ?? anthropicDefaultModelId,
      })
      break
    case AiServiceProvider.Ollama:
      {
        const models = await fetchOllamaModels()
        if (models && models.length > 0) {
          modelId = await select({
            message: 'Choose Model ID:',
            choices: models.map((model) => ({ name: model, value: model })),
            default: existingConfig?.modelId,
          })
        } else {
          modelId = await input({ message: 'Enter Model ID:' })
        }
      }
      // fetch model list from Ollama API

      break
    case AiServiceProvider.DeepSeek:
      modelId = deepSeekDefaultModelId
      break
  }

  const apiKey = await password({ message: 'Enter API Key:', mask: '*' })

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
        globalConfig.apiKey = apiKey
        mkdirSync(dirname(globalConfigPath), { recursive: true })
        writeFileSync(globalConfigPath, stringify(globalConfig))
        console.log(`API key saved to global config file: ${globalConfigPath}`)
        break
      }
      case 3: {
        let envFileContent: string
        if (existsSync('.env')) {
          envFileContent = readFileSync('.env', 'utf8')
          envFileContent += `\nPOLKA_API_KEY=${apiKey}`
        } else {
          envFileContent = 'POLKA_API_KEY=${apiKey}'
        }
        writeFileSync('.env', envFileContent)
        console.log('API key saved to .env file')
        break
      }
    }
  }

  const newConfig = merge({}, existingConfig, { provider, modelId, apiKey })
  if (save) {
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(newConfig))
    console.log(`Config file saved at: ${configPath}`)
  }
  return newConfig
}

async function printConfig(configPath: string) {
  const config = existsSync(configPath) ? loadConfigAtPath(configPath) : undefined
  if (!config) {
    console.log('No config found')
    return
  }
  console.log(`Config file path: ${configPath}`)
  if (config.apiKey) {
    config.apiKey = '<redacted>'
  }
  console.log(stringify(config))
}

export async function configCommand(options: { global?: boolean; print?: boolean }) {
  const globalConfigPath = getGlobalConfigPath()
  const configPath = options.global ? globalConfigPath : localConfigFileName

  if (options.print) {
    await printConfig(configPath)
    return
  }

  await configPrompt(options, true)
}
