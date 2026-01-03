import { getProvider } from '@polka-codes/cli-shared'
import type { UsageMeter } from '@polka-codes/core'
import { Command } from 'commander'
import { epic } from '../api'
import { createLogger } from '../logger'
import { getUserInput } from '../utils/userInput'
import {
  type EpicContext,
  EpicMemoryStore,
  EpicTodoItemStore,
  loadEpicContext,
  saveEpicContext as persistEpicContext,
} from '../workflows/epic-context'

export async function runEpic(task: string | undefined, options: any, command: Command) {
  const globalOpts = (command.parent ?? command).opts()
  const { verbose } = globalOpts
  const { review } = options
  const logger = createLogger({
    verbose,
  })

  let taskInput = task
  const epicContext = await loadEpicContext()

  if (epicContext.task) {
    if (taskInput) {
      logger.error('Error: Existing epic context found, but task was provided via CLI args. Exiting.')
      return
    }
    logger.info('Resuming existing epic session. Task:')
    logger.info(`   ${epicContext.task}`)
  } else {
    if (!taskInput) {
      taskInput = await getUserInput('What feature do you want to implement?')
      if (!taskInput) {
        logger.info('No task provided. Exiting.')
        return
      }
    }
  }

  let usageMeter: UsageMeter | undefined

  try {
    await epic({
      task: taskInput,
      noReview: review === false,
      interactive: !globalOpts.yes,
      onUsage: (meter: UsageMeter) => {
        usageMeter = meter
      },
      ...globalOpts,
      getProvider: (opt: any) =>
        getProvider({
          ...opt,
          todoItemStore: new EpicTodoItemStore(epicContext),
          memoryStore: new EpicMemoryStore(epicContext),
        }),
      _workflowInput: epicContext,
      _saveEpicContext: async (context: EpicContext) => {
        // Update fields that might have changed in the workflow
        if (context.task) epicContext.task = context.task
        if (context.plan) epicContext.plan = context.plan
        if (context.branchName) epicContext.branchName = context.branchName
        if (context.baseBranch) epicContext.baseBranch = context.baseBranch

        await persistEpicContext(epicContext)
      },
      _saveUsageSnapshot: async () => {
        if (usageMeter) {
          const currentUsage = usageMeter.usage
          if (!epicContext.usages) {
            epicContext.usages = []
          }
          epicContext.usages.push({ ...currentUsage, timestamp: Date.now() })
          await persistEpicContext(epicContext)
        }
      },
    } as any)
  } catch (error) {
    if (error instanceof Error && error.message.includes('Existing epic context found')) {
      logger.error(`Error: ${error.message}`)
      return
    }
    throw error
  }
}

export const epicCommand = new Command('epic')
  .description('Orchestrates a large feature or epic, breaking it down into smaller tasks.')
  .argument('[task]', 'The epic to plan and implement.')
  .option('--no-review', 'Disable the review step')
  .action(runEpic)
