import os from 'node:os'
/**
 * Initialize polkacodes configuration command.
 * Generated by polka.codes
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { confirm } from '@inquirer/prompts'
import {
  type AiServiceProvider,
  AnalyzerAgent,
  MultiAgent,
  analyzerAgentInfo,
  createService,
  generateProjectConfig,
} from '@polka-codes/core'
import { Command } from 'commander'
import { parse, stringify } from 'yaml'

import { localConfigFileName, readLocalConfig } from '../config'
import { parseOptions } from '../options'
import { getProvider } from '../provider'
import { printEvent } from '../utils/eventHandler'
import { listFiles } from '../utils/listFiles'
import { configPrompt } from './config'

export const initCommand = new Command('init').description('Initialize polkacodes configuration')

initCommand.action(async (_options, command: Command) => {
  const options = command.parent?.opts() ?? {}

  try {
    // Check for existing config
    const localConfig = readLocalConfig() ?? {}
    if (localConfig) {
      const proceed = await confirm({
        message: `Found existing config at ${localConfigFileName}. Do you want to proceed? This will overwrite the existing config.`,
        default: false,
      })
      if (!proceed) {
        console.log('Cancelled')
        return
      }
    }

    const { config: existingConfig, providerConfig, verbose } = parseOptions(options)

    let { provider, model, apiKey } = providerConfig.getConfigForCommand('init') ?? {}

    console.log('Provider:', provider)
    console.log('Model:', model)

    if (!provider) {
      // new user? ask for config
      const newConfig = await configPrompt({ provider, model, apiKey })
      provider = newConfig.provider as AiServiceProvider
      model = newConfig.model
      apiKey = newConfig.apiKey
      localConfig.defaultProvider = provider
      localConfig.defaultModel = model
    }

    // Create AI service
    const service = createService(provider as AiServiceProvider, {
      apiKey: apiKey ?? process.env.POLKA_API_KEY ?? options.apiKey ?? existingConfig.providers?.[provider]?.apiKey,
      model,
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
              provider: getProvider('analyzer', existingConfig),
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

    const { response: generatedConfig } = await generateProjectConfig(multiAgent, relevantFiles, printEvent(verbose))

    // Parse generated config
    const parsedConfig = generatedConfig ? parse(generatedConfig) : {}

    // Combine configs
    const config = {
      ...localConfig,
      ...parsedConfig,
    }

    if (apiKey) {
      config.providers = {
        [provider]: {
          apiKey,
        },
      }
    }

    // Save config
    writeFileSync(localConfigFileName, stringify(config))
    console.log(`Configuration saved to ${localConfigFileName}`)
  } catch (error) {
    console.error('Failed to generate configuration:', error)
    process.exit(1)
  }
})
