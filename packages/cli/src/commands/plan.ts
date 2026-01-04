import { readFileSync } from 'node:fs'
import { Command } from 'commander'
import { plan } from '../api'
import { getUserInput } from '../utils/userInput'

export const planCommand = new Command('plan')
  .description('Create or update a plan for a task.')
  .argument('[task]', 'The task to plan.')
  .option('-p, --plan-file <path>', 'The path to the plan file.')
  .action(async (task: string | undefined, options: { planFile?: string }, command: Command) => {
    let taskInput = task
    let fileContent: string | undefined
    if (options.planFile) {
      try {
        fileContent = readFileSync(options.planFile, 'utf-8').trim()
      } catch {
        // we can't read the file, maybe it doesn't exist, that's fine
      }
    }

    if (!taskInput) {
      taskInput = await getUserInput('What is the task you want to plan?')
      if (taskInput === undefined) {
        return
      }

      if (!taskInput.trim()) {
        console.log('No task provided. Exiting...')
        return
      }
    }

    const globalOpts = (command.parent ?? command).opts()

    await plan({
      task: taskInput,
      fileContent,
      planFile: options.planFile,
      interactive: !globalOpts.yes,
      ...globalOpts,
    })
  })
