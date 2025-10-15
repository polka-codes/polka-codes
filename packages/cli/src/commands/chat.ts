import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { confirm } from '@inquirer/prompts'
import { type ExitReason, ToolResponseType } from '@polka-codes/core'
import type { FilePart, ImagePart } from 'ai'
import type { Command } from 'commander'
import { set } from 'lodash-es'
import { lookup } from 'mime-types'

import { ApiProviderConfig } from '../ApiProviderConfig'
import { Chat } from '../Chat'
import { configPrompt } from '../configPrompt'
import { parseOptions } from '../options'
import { Runner } from '../Runner'

export const runChat = async (opts: any, command?: Command) => {
  const options = command?.parent?.opts() ?? opts ?? {}
  let { config, providerConfig, maxMessageCount, verbose, budget, agent } = parseOptions(options)

  if (!process.stdin.isTTY) {
    console.error('Error: Terminal is not interactive. Please run this command in an interactive terminal.')
    process.exit(1)
  }

  let providerDetails = providerConfig.getConfigForAgent(agent)

  if (!providerDetails?.provider) {
    // new user? ask for config
    const newConfig = await configPrompt({})
    const updatedConfig = JSON.parse(JSON.stringify(config ?? {}))
    set(updatedConfig, `providers.${newConfig.provider}.model`, newConfig.model)
    set(updatedConfig, `providers.${newConfig.provider}.apiKey`, newConfig.apiKey)
    if (newConfig.baseURL) {
      set(updatedConfig, `providers.${newConfig.provider}.baseURL`, newConfig.baseURL)
    }

    providerConfig = new ApiProviderConfig(updatedConfig)
    providerDetails = providerConfig.getConfigForAgent(agent)
    config = updatedConfig
  }

  const { provider, model, parameters } = providerDetails ?? {}

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
    config: config,
    maxMessageCount,
    budget,
    interactive: true,
    verbose,
  })

  const chat = new Chat({
    onMessage: async (message, files) => {
      let exitReason: ExitReason
      const fileParts: (FilePart | ImagePart)[] = []
      for (const file of files) {
        try {
          const content = await readFile(file)
          const mimeType = lookup(file)

          if (typeof mimeType === 'string' && mimeType.startsWith('image/')) {
            fileParts.push({
              type: 'image',
              mediaType: mimeType,
              image: content,
            })
          } else {
            fileParts.push({
              type: 'file',
              mediaType: mimeType || 'application/octet-stream',
              filename: basename(file),
              data: content,
            })
          }
        } catch (e: any) {
          console.error(`Error reading file ${file}: ${e.message}`)
          // continue with other files
        }
      }

      if (runner.hasActiveAgent) {
        exitReason = await runner.continueTask(message, fileParts)
      } else {
        exitReason = await runner.startTask(message, agent, fileParts)
      }

      while (exitReason.type === 'UsageExceeded') {
        const continueChat = await confirm({
          message: 'Usage limit exceeded. Do you want to continue?',
          default: true,
        })
        if (continueChat) {
          runner.usageMeter.resetUsage()
          exitReason = await runner.continueTask(message, fileParts)
        } else {
          chat.close()
          return
        }
      }

      switch (exitReason.type) {
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
