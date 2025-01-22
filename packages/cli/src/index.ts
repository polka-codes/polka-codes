import 'dotenv/config'
import { Command } from 'commander'

import { ExitReason, type TaskInfo, defaultModels } from '@polka-codes/core'
import { version } from '../package.json'
import { Chat } from './Chat'
import { Runner } from './Runner'
import { configCommand, configPrompt } from './commands/config'
import { addSharedOptions, parseOptions } from './options'

const program = new Command()

program.name('polka').description('Polka Codes CLI').version(version)

const runChat = async (options: any) => {
  let { provider, modelId, apiKey, config, maxIterations } = parseOptions(options)

  if (!provider) {
    // new user? ask for config
    const newConfig = await configPrompt({ provider, modelId, apiKey, ...config })
    provider = newConfig.provider
    modelId = newConfig.modelId
    apiKey = newConfig.apiKey
  }

  console.log('Starting chat session...')
  console.log('Provider:', provider)
  console.log('Model:', modelId)
  console.log('Type ".help" for more information.')
  console.log('What can I do for you?')

  const runner = new Runner({
    provider,
    modelId: modelId ?? defaultModels[provider],
    apiKey,
    config: config ?? {},
    maxIterations,
    interactive: true,
    eventCallback: (event) => {
      if (event.newText) {
        process.stdout.write(event.newText)
      }
      if (event.kind === 'end_request') {
        console.log('\n\n========\n')
      }
    },
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
      switch (exitReason) {
        case ExitReason.Completed:
          chat.close()
          return undefined
        case ExitReason.MaxIterations:
          console.log('Max iterations reached.')
          chat.close()
          // TODO: ask user if they want to continue
          break
        case ExitReason.Interrupted:
          console.log('Interrupted.')
          chat.close()
          break
        case ExitReason.WaitForUserInput:
          break
      }
    },
    onExit: async () => {
      console.log()
      runner.printUsage()
      process.exit(0)
    },
  })
}

// Chat command
program.command('chat').description('Start an interactive chat session').action(runChat)

// Config command
program
  .command('config')
  .description('Configure global or local settings')
  .option('-g, --global', 'Use global config')
  .option('-p, --print', 'Print config')
  .action(configCommand)

// Main command for executing tasks
program.argument('[task]', 'The task to execute').action(async (taskArg, options) => {
  if (!taskArg) {
    runChat(options)
    return
  }

  let { provider, modelId, apiKey, config, maxIterations } = parseOptions(options)

  if (!provider) {
    // new user? ask for config
    const newConfig = await configPrompt({ provider, modelId, apiKey, ...config })
    provider = newConfig.provider
    modelId = newConfig.modelId
    apiKey = newConfig.apiKey
  }

  console.log('Provider:', provider)
  console.log('Model:', modelId)

  const runner = new Runner({
    provider,
    modelId: modelId ?? defaultModels[provider],
    apiKey,
    config: config ?? {},
    maxIterations,
    interactive: false,
    eventCallback: (event) => {
      if (event.kind === 'start_request') {
        console.log('>>>>')
        const { userMessage } = event
        if (userMessage) {
          console.log(userMessage)
        }
        console.log('====')
      }

      if (event.newText) {
        process.stdout.write(event.newText)
      }
      if (event.kind === 'end_request') {
        process.stdout.write('\n')
        console.log('<<<<')
      }
      if (event.kind === 'max_iterations_reached') {
        console.log('Max iterations reached')
      }
    },
  })
  await runner.startTask(taskArg)
  runner.printUsage()
})

addSharedOptions(program)

program.parse()

process.on('uncaughtException', (error) => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    // do nothing
  } else {
    // Rethrow unknown errors
    throw error
  }
})
