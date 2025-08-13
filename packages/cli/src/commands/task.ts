import { ToolResponseType } from '@polka-codes/core'
import type { Command } from 'commander'
import { parseOptions } from '../options'
import { Runner } from '../Runner'
import { runChat } from './chat'

const readStdin = async (timeoutMs = 30000): Promise<string> => {
  if (process.stdin.isTTY) {
    return ''
  }

  return new Promise((resolve, reject) => {
    let input = ''
    const cleanup = () => {
      if (timeoutId) clearTimeout(timeoutId)
      process.stdin.removeAllListeners()
      process.stdin.resume()
    }

    const timeoutId = setTimeout(() => {
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

  const { config, providerConfig, verbose, maxMessageCount, budget, agent, silent } = parseOptions(command.opts())

  const { provider, model, parameters } = providerConfig.getConfigForAgent(agent) ?? {}

  if (!provider || !model) {
    console.error('Provider and model must be configured')
    process.exit(1)
  }

  if (!silent) {
    console.log('Provider:', provider)
    console.log('Model:', model)
    for (const [key, value] of Object.entries(parameters ?? {})) {
      console.log(`${key}:`, value)
    }
  }

  const runner = new Runner({
    providerConfig,
    config,
    maxMessageCount,
    budget,
    interactive: process.stdin.isTTY,
    verbose,
    silent,
  })

  const sigintHandler = () => {
    runner.abort()
    if (!silent) {
      console.log()
      runner.printUsage()
    }
    process.exit(0)
  }

  process.on('SIGINT', sigintHandler)

  const exitReason = await runner.startTask(task, agent)

  process.off('SIGINT', sigintHandler)

  if (silent) {
    if (exitReason.type === ToolResponseType.Exit) {
      console.log(exitReason.message)
    }
  } else {
    runner.printUsage()
  }
}
