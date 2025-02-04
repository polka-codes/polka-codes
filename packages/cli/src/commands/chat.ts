import { type AiServiceProvider, type ExitReason, type TaskInfo, ToolResponseType, defaultModels } from '@polka-codes/core'
import type { Command } from 'commander'

import { Chat } from '../Chat'
import { Runner } from '../Runner'
import { configPrompt } from '../configPrompt'
import { parseOptions } from '../options'
import { printEvent } from '../utils/eventHandler'

export const runChat = async (opts: any, command?: Command) => {
  const options = command?.parent?.opts() ?? opts ?? {}
  const { config, providerConfig, maxMessageCount, verbose, budget } = parseOptions(options)

  if (!process.stdin.isTTY) {
    console.error('Error: Terminal is not interactive. Please run this command in an interactive terminal.')
    process.exit(1)
  }

  let { provider, model, apiKey } = providerConfig.getConfigForAgent('coder') ?? {}

  if (!provider) {
    // new user? ask for config
    const newConfig = await configPrompt({ provider, model, apiKey })
    provider = newConfig.provider as AiServiceProvider
    model = newConfig.model
    apiKey = newConfig.apiKey
  }

  console.log('Starting chat session...')
  console.log('Provider:', provider)
  console.log('Model:', model)
  console.log('Type ".help" for more information.')
  console.log('What can I do for you?')

  const runner = new Runner({
    provider,
    model: model ?? defaultModels[provider],
    apiKey,
    config: config ?? {},
    maxMessageCount,
    budget,
    interactive: true,
    eventCallback: printEvent(verbose),
    enableCache: true,
  })

  let taskInfo: TaskInfo | undefined
  const chat = new Chat({
    onMessage: async (message) => {
      let exitReason: ExitReason
      if (taskInfo) {
        const [reason, info] = await runner.continueTask(message, taskInfo)
        taskInfo = info
        exitReason = reason
      } else {
        const [reason, info] = await runner.startTask(message)
        taskInfo = info
        exitReason = reason
      }
      switch (exitReason.type) {
        case 'UsageExceeded':
          console.log('Usage exceeded.')
          chat.close()
          // TODO: ask user if they want to continue
          break
        case 'WaitForUserInput':
          break
        case ToolResponseType.Interrupted:
          console.log('Interrupted.')
          chat.close()
          break
        case ToolResponseType.Exit:
          chat.close()
          return undefined
      }
    },
    onExit: async () => {
      console.log()
      runner.printUsage()
      process.exit(0)
    },
  })
}
