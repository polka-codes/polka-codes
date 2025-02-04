/**
 * Task command implementation for handling both direct arguments and stdin input.
 * Generated by polka.codes
 */
import { type AiServiceProvider, defaultModels } from '@polka-codes/core'
import type { Command } from 'commander'

import { Runner } from '../Runner'
import { parseOptions } from '../options'
import { printEvent } from '../utils/eventHandler'
import { runChat } from './chat'
import { configPrompt } from './config'

const readStdin = async (timeoutMs = 30000): Promise<string> => {
  if (process.stdin.isTTY) {
    return ''
  }

  return new Promise((resolve, reject) => {
    let input = ''
    let timeoutId: NodeJS.Timer | undefined = undefined

    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      process.stdin.removeAllListeners()
      process.stdin.resume()
    }

    timeoutId = setTimeout(() => {
      cleanup()
      reject(new Error('Stdin read timeout'))
    }, timeoutMs)

    process.stdin.on('data', (chunk: Buffer) => {
      input += chunk.toString()
    })

    process.stdin.on('end', () => {
      cleanup()
      if (!input) {
        reject(new Error('Empty stdin input'))
        return
      }
      resolve(input)
    })

    process.stdin.on('error', (err) => {
      cleanup()
      reject(err)
    })
  })
}

export const runTask = async (taskArg: string, _options: any, command: Command) => {
  const options = command.parent?.opts() ?? {}

  let task = taskArg
  if (!task) {
    try {
      const stdinInput = await readStdin()
      if (stdinInput) {
        // Use stdin input as task
        task = stdinInput
      } else {
        // No stdin input, fall back to chat
        runChat(options, command)
        return
      }
    } catch (error) {
      console.error('Error reading stdin:', error)
      process.exit(1)
    }
  }

  const { providerConfig, config, maxMessageCount, verbose, budget } = parseOptions(options)

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
    maxMessageCount,
    budget,
    interactive: false,
    eventCallback: printEvent(verbose),
  })
  await runner.startTask(task)
  runner.printUsage()
}
