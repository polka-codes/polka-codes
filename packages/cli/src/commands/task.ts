import { type AiServiceProvider, defaultModels } from '@polka-codes/core'
import { Runner } from '../Runner'
import { parseOptions } from '../options'
import { printEvent } from '../utils/eventHandler'
import { runChat } from './chat'
import { configPrompt } from './config'

export const runTask = async (taskArg: string, options: any) => {
  if (!taskArg) {
    runChat(options)
    return
  }

  const { providerConfig, config, maxIterations, verbose } = parseOptions(options)

  let { provider, model, apiKey } = providerConfig.getConfigForAgent('coder') ?? {}

  if (!provider) {
    // new user? ask for config
    const newConfig = await configPrompt({ provider, model, apiKey })
    provider = newConfig.provider as AiServiceProvider
    model = newConfig.model
    apiKey = newConfig.apiKey
  }

  console.log('Provider:', provider)
  console.log('Model:', model)

  const runner = new Runner({
    provider,
    model: model ?? defaultModels[provider],
    apiKey,
    config: config ?? {},
    maxIterations,
    interactive: false,
    eventCallback: printEvent(verbose),
  })
  await runner.startTask(taskArg)
  runner.printUsage()
}
