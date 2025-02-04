import os from 'node:os'
/**
 * Initialize polkacodes configuration command.
 * Generated by polka.codes
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { confirm, select } from '@inquirer/prompts'
import { AnalyzerAgent, MultiAgent, analyzerAgentInfo, createService, generateProjectConfig } from '@polka-codes/core'
import { Command } from 'commander'
import { set } from 'lodash'
import { parse, stringify } from 'yaml'

import { ZodError } from 'zod'
import { type Config, getGlobalConfigPath, loadConfigAtPath, localConfigFileName } from '../config'
import { type ProviderConfig, configPrompt } from '../configPrompt'
import { parseOptions } from '../options'
import { getProvider } from '../provider'
import { printEvent } from '../utils/eventHandler'
import { listFiles } from '../utils/listFiles'

export const initCommand = new Command('init')
  .description('Initialize polkacodes configuration')
  .option('-g, --global', 'Use global config')

initCommand.action(async (options, command: Command) => {
  const cmdOptions = command.parent?.opts() ?? {}
  const globalConfigPath = getGlobalConfigPath()

  let gloabl = options.global
  let configPath = gloabl ? globalConfigPath : localConfigFileName

  try {
    // Check for existing config
    if (existsSync(configPath)) {
      const proceed = await confirm({
        message: `Found existing config at ${configPath}. Do you want to proceed? This will overwrite the existing config.`,
        default: false,
      })
      if (!proceed) {
        console.log('Cancelled')
        return
      }
    } else {
      // If no config exists and not explicitly global, ask for location
      if (!global) {
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
          gloabl = true
          configPath = globalConfigPath
        }
      }
    }

    console.log(`Config file path: ${configPath}`)

    let existingConfig: Config = {}
    try {
      existingConfig = loadConfigAtPath(configPath) ?? {}
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Unable to parse config file: ${configPath}`, error)
        process.exit(1)
      }
    }

    const { config, providerConfig, verbose } = parseOptions(cmdOptions)
    let { provider, model, apiKey } = providerConfig.getConfigForCommand('init') ?? {}

    // Get provider configuration
    let newConfig: ProviderConfig | undefined
    if (!provider) {
      newConfig = await configPrompt({ provider, model, apiKey })
      provider = newConfig.provider
      model = newConfig.model
      apiKey = newConfig.apiKey
    }

    // Handle API key storage if provided
    if (newConfig?.apiKey && !gloabl) {
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
          // do nothing, will be saved in local config
          break
        case 2: {
          const globalConfig = loadConfigAtPath(globalConfigPath) ?? {}
          set(globalConfig, ['providers', newConfig.provider, 'apiKey'], newConfig.apiKey)
          mkdirSync(dirname(globalConfigPath), { recursive: true })
          writeFileSync(globalConfigPath, stringify(globalConfig))
          console.log(`API key saved to global config file: ${globalConfigPath}`)
          newConfig.apiKey = undefined
          break
        }
        case 3: {
          let envFileContent: string
          if (existsSync('.env')) {
            envFileContent = readFileSync('.env', 'utf8')
            envFileContent += `\n${newConfig.provider.toUpperCase()}_API_KEY=${newConfig.apiKey}`
          } else {
            envFileContent = `${newConfig.provider.toUpperCase()}_API_KEY=${newConfig.apiKey}`
          }
          writeFileSync('.env', envFileContent)
          console.log('API key saved to .env file')
          newConfig.apiKey = undefined
          break
        }
      }
    }

    // Ask if user wants to analyze project
    const shouldAnalyze =
      !gloabl &&
      (await confirm({
        message: 'Would you like to analyze the project to generate recommended configuration?',
        default: true,
      }))

    let generatedConfig = {}
    if (shouldAnalyze) {
      // Create AI service
      const service = createService(provider, {
        apiKey,
        model,
        enableCache: true,
      })

      // Create MultiAgent
      const multiAgent = new MultiAgent({
        createAgent: async (name: string) => {
          const agentName = name.trim().toLowerCase()
          switch (agentName) {
            case analyzerAgentInfo.name:
              return new AnalyzerAgent({
                ai: service,
                os: os.platform(),
                provider: getProvider('analyzer', config),
                interactive: false,
              })
            default:
              throw new Error(`Unknown agent: ${name}`)
          }
        },
      })

      // Generate project config
      console.log('Analyzing project files...')
      const files: Record<string, string> = {}
      const [relevantFiles] = await listFiles('.', true, 1000, process.cwd())

      // Read relevant files
      for (const filePath of relevantFiles) {
        if (typeof filePath === 'string' && existsSync(filePath)) {
          try {
            const content = readFileSync(filePath, 'utf8')
            files[filePath] = content
          } catch (error) {
            console.warn(`Failed to read file: ${filePath}`)
          }
        }
      }

      const { response } = await generateProjectConfig(multiAgent, relevantFiles, printEvent(verbose))
      generatedConfig = response ? parse(response) : {}
    }

    // Combine configs
    const finalConfig = {
      ...(existingConfig ?? {}),
      ...generatedConfig,
    }

    if (newConfig) {
      finalConfig.defaultProvider = newConfig.provider
      finalConfig.defaultModel = newConfig.model
      if (newConfig.apiKey) {
        set(finalConfig, ['providers', newConfig.provider, 'apiKey'], newConfig.apiKey)
      }
    }

    if (!finalConfig.defaultProvider) {
      finalConfig.defaultProvider = provider
    }

    if (!finalConfig.defaultModel) {
      finalConfig.defaultModel = model
    }

    // Save config
    mkdirSync(dirname(configPath), { recursive: true })
    writeFileSync(configPath, stringify(finalConfig))
    console.log(`Configuration saved to ${configPath}`)
  } catch (error) {
    console.error('Failed to generate configuration:', error)
    process.exit(1)
  }
})
