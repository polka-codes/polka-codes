import { ExitReason, type TaskInfo, defaultModels } from '@polka-codes/core'
import { Chat } from '../Chat'
import { Runner } from '../Runner'
import { parseOptions } from '../options'
import { configPrompt } from './config'

export const runChat = async (options: any) => {
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
