import { getProvider } from '@polka-codes/cli-shared'
import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import { getUserInput } from '../utils/userInput'
import { type EpicWorkflowInput, epicWorkflow } from '../workflows/epic.workflow'
import { EpicMemoryStore, EpicTodoItemStore, loadEpicContext } from '../workflows/epic-context'

export async function runEpic(task: string | undefined, _options: any, command: Command) {
  let taskInput = task

  if (!taskInput) {
    taskInput = await getUserInput('What epic or large feature do you want to implement?')
    if (!taskInput) {
      return
    }
  }

  if (!taskInput) {
    // This should not happen based on the logic above, but as a safeguard:
    console.error('No task provided. Aborting.')
    return
  }

  const ctx = await loadEpicContext()

  const workflowInput: EpicWorkflowInput = {
    task: taskInput,
    epicContext: ctx,
  }

  const globalOpts = (command.parent ?? command).opts()
  const { verbose, yes } = globalOpts
  const logger = createLogger({
    verbose,
  })

  await runWorkflow(epicWorkflow, workflowInput, {
    commandName: 'epic',
    command,
    logger,
    yes,
    getProvider: (opt) => getProvider({ ...opt, todoItemStore: new EpicTodoItemStore(ctx), memoryStore: new EpicMemoryStore(ctx) }),
  })
}

export const epicCommand = new Command('epic')
  .description('Orchestrates a large feature or epic, breaking it down into smaller tasks.')
  .argument('[task]', 'The epic to plan and implement.')
  .action(runEpic)
