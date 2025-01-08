// Generated by polka.codes
import { type AiServiceProvider, defaultModels } from '@polka-codes/core'
import type { Command } from 'commander'
import { loadConfig } from './config'

export interface CliOptions {
  config?: string
  c?: string
  apiProvider?: string
  modelId?: string
  apiKey?: string
  maxIterations?: number
}

export function addSharedOptions(command: Command) {
  return command
    .option('-c --config <path>', 'Path to config file')
    .option('--api-provider <provider>', 'API provider')
    .option('--model-id <model>', 'Model ID')
    .option('--api-key <key>', 'API key')
    .option('--max-iterations <iterations>', 'Maximum number of iterations to run. Default to 30', Number.parseInt)
}

export function parseOptions(options: CliOptions) {
  const config = loadConfig(options.config ?? options.c)

  const provider = (options.apiProvider || process.env.POLKA_API_PROVIDER || config?.provider || 'ollama') as AiServiceProvider
  return {
    provider,
    model: options.modelId || process.env.POLKA_MODEL_ID || config?.modelId || defaultModels[provider],
    apiKey: options.apiKey || process.env.POLKA_API_KEY || config?.apiKey,
    maxIterations: options.maxIterations ?? 30,
    config,
  }
}
