// Generated by polka.codes

import os from 'node:os'
import { AiServiceProvider } from '@polka-codes/core'
import type { Command } from 'commander'
import { set } from 'lodash'

import { ApiProviderConfig } from './ApiProviderConfig'
import { loadConfig } from './config'

export interface CliOptions {
  config?: string | string[]
  apiProvider?: string
  model?: string
  apiKey?: string
  maxMessageCount?: number
  budget?: number
  verbose?: number
  baseDir?: string
}

export function addSharedOptions(command: Command) {
  return command
    .option('-c --config <paths...>', 'Path to config file(s)')
    .option('--api-provider <provider>', 'API provider')
    .option('--model <model>', 'Model ID')
    .option('--api-key <key>', 'API key')
    .option('--max-messages <iterations>', 'Maximum number of messages to send. Default to 50', Number.parseInt, 50)
    .option('--budget <budget>', 'Budget for the AI service. Default to $1000', Number.parseFloat, 1000)
    .option('-v --verbose', 'Enable verbose output. Use -v for level 1, -vv for level 2', (value, prev) => prev + 1, 0)
    .option('-d --base-dir <path>', 'Base directory to run commands in')
}

export function parseOptions(options: CliOptions, cwdArg?: string, home: string = os.homedir()) {
  let cwd = cwdArg
  if (options.baseDir) {
    process.chdir(options.baseDir)
    cwd = options.baseDir
    console.log('Changed working directory to', cwd)
  } else {
    cwd = process.cwd()
  }

  const config = loadConfig(options.config, cwd, home) ?? {}

  const defaultProvider = (options.apiProvider || process.env.POLKA_API_PROVIDER || config.defaultProvider) as AiServiceProvider | undefined
  const defaultModel = options.model || process.env.POLKA_MODEL || config.defaultModel

  if (defaultProvider && defaultModel) {
    set(config, ['providers', defaultProvider, 'defaultModel'], defaultModel)
  }

  const apiKey = options.apiKey || process.env.POLKA_API_KEY

  if (apiKey) {
    if (!defaultProvider) {
      throw new Error('Must specify a provider if providing an API key')
    }
    set(config, ['providers', defaultProvider, 'apiKey'], apiKey)
  }

  for (const provider of Object.values(AiServiceProvider)) {
    const providerApiKey = process.env[`${provider.toUpperCase()}_API_KEY`]
    if (providerApiKey) {
      set(config, ['providers', provider, 'apiKey'], providerApiKey)
    }
  }

  const providerConfig = new ApiProviderConfig({
    defaultProvider,
    ...config,
  })

  return {
    maxMessageCount: options.maxMessageCount ?? config.maxMessageCount ?? 30,
    budget: options.budget ?? Number(process.env.POLKA_BUDGET) ?? config.budget ?? 1000,
    verbose: options.verbose ?? 0,
    config,
    providerConfig,
  }
}
