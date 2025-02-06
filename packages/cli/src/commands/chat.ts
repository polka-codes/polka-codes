import { type ExitReason, ToolResponseType, architectAgentInfo } from '@polka-codes/core'
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

  // TODO: configure starter agent
  const startAgent = architectAgentInfo.name
  let { provider, model, apiKey } = providerConfig.getConfigForAgent(startAgent) ?? {}

  if (!provider) {
    // new user? ask for config
    const newConfig = await configPrompt({ provider, model, apiKey })
    provider = newConfig.provider
    model = newConfig.model
    apiKey = newConfig.apiKey
  }

  console.log('Starting chat session...')
  console.log('Provider:', provider)
  console.log('Model:', model)
  console.log('Type ".help" for more information.')
  console.log('What can I do for you?')

  const runner = new Runner({
    providerConfig,
    config: config ?? {},
    maxMessageCount,
    budget,
    interactive: true,
    eventCallback: printEvent(verbose),
    enableCache: true,
  })

  let started = false
  const chat = new Chat({
    onMessage: async (message) => {
      let exitReason: ExitReason
      if (started) {
        const reason = await runner.continueTask(message)
        exitReason = reason
      } else {
        const reason = await runner.startTask(message)
        started = true
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
