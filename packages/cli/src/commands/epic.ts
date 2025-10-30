import { getProvider } from '@polka-codes/cli-shared'
import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import { getUserInput } from '../utils/userInput'
import { epicWorkflow } from '../workflows/epic.workflow'
import { EpicMemoryStore, EpicTodoItemStore, loadEpicContext } from '../workflows/epic-context'

export async function runEpic(task: string | undefined, _options: any, command: Command) {
  const globalOpts = (command.parent ?? command).opts()
  const { verbose, yes } = globalOpts
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

    epicContext.task = taskInput
  }

  await runWorkflow(epicWorkflow, epicContext, {
    commandName: 'epic',
    command,
    logger,
    yes,
    getProvider: (opt) =>
      getProvider({
        ...opt,
        todoItemStore: new EpicTodoItemStore(epicContext),
        memoryStore: new EpicMemoryStore(epicContext),
      }),
  })
}

export const epicCommand = new Command('epic')
  .description('Orchestrates a large feature or epic, breaking it down into smaller tasks.')
  .argument('[task]', 'The epic to plan and implement.')
  .action(runEpic)
