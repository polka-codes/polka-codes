import { type ExitReason, ToolResponseType } from '@polka-codes/core'
import type { Command } from 'commander'

import { Chat } from '../Chat'
import { configPrompt } from '../configPrompt'
import { parseOptions } from '../options'
import { Runner } from '../Runner'

export const runChat = async (opts: any, command?: Command) => {
  const options = command?.parent?.opts() ?? opts ?? {}
  const { config, providerConfig, maxMessageCount, verbose, budget, agent } = parseOptions(options)

  if (!process.stdin.isTTY) {
    console.error('Error: Terminal is not interactive. Please run this command in an interactive terminal.')
    process.exit(1)
  }

  let { provider, model, apiKey, parameters } = providerConfig.getConfigForAgent(agent) ?? {}

  if (!provider) {
    // new user? ask for config
    const newConfig = await configPrompt({})
    provider = newConfig.provider
    model = newConfig.model
    apiKey = newConfig.apiKey
  }

  console.log('Starting chat session...')
  console.log('Provider:', provider)
  console.log('Model:', model)
  for (const [key, value] of Object.entries(parameters ?? {})) {
    console.log(`${key}:`, value)
  }
  console.log('Type ".help" for more information.')
  console.log('What can I do for you?')

  const runner = new Runner({
    providerConfig,
    config: config ?? {},
    maxMessageCount,
    budget,
    interactive: true,
    verbose,
  })

  const chat = new Chat({
    onMessage: async (message) => {
      let exitReason: ExitReason
      if (runner.hasActiveAgent) {
        const reason = await runner.continueTask(message)
        exitReason = reason
      } else {
        const reason = await runner.startTask(message, agent)
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
    onInterrupt: () => {
      runner.abort()
    },
  })
}
