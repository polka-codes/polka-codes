import type { Command } from 'commander'
import { Runner } from '../Runner'
import { parseOptions } from '../options'
import { printEvent } from '../utils/eventHandler'
import { runChat } from './chat'

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

export async function runTask(taskArg: string | undefined, _options: any, command: Command) {
  let task = taskArg
  if (!task) {
    try {
      const stdinInput = await readStdin()
      if (stdinInput) {
        // Use stdin input as task
        task = stdinInput
      } else {
        // No stdin input, fall back to chat
        runChat(command.opts())
        return
      }
    } catch (error) {
      console.error('Error reading stdin:', error)
      process.exit(1)
    }
  }

  const { config, providerConfig, verbose, maxMessageCount, budget, agent } = parseOptions(command.opts())

  const { provider, model } = providerConfig.getConfigForAgent(agent) ?? {}

  if (!provider || !model) {
    console.error('Provider and model must be configured')
    process.exit(1)
  }

  console.log('Provider:', provider)
  console.log('Model:', model)

  const runner = new Runner({
    providerConfig,
    config,
    maxMessageCount,
    budget,
    interactive: process.stdin.isTTY,
    eventCallback: printEvent(verbose),
    enableCache: true,
  })

  await runner.startTask(task, agent)
  runner.printUsage()
}
