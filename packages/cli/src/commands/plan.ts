import { readFileSync } from 'node:fs'
import { input } from '@inquirer/prompts'
import { Command } from 'commander'
import { runWorkflow } from '../runWorkflow'
import { planWorkflow } from '../workflows/plan.workflow'

export const planCommand = new Command('plan')
  .description('Create or update a plan for a task.')
  .argument('[task]', 'The task to plan.')
  .option('-f, --file <path>', 'The path to the plan file.')
  .action(async (task: string | undefined, options: { file?: string }, command: Command) => {
    let taskInput = task
    let fileContent: string | undefined
    if (options.file) {
      try {
        fileContent = readFileSync(options.file, 'utf-8').trim()
      } catch {
        // we can't read the file, maybe it doesn't exist, that's fine
      }
    }

    if (fileContent && !taskInput) {
      taskInput = 'Improve the existing plan.'
    }

    if (!taskInput) {
      try {
        taskInput = await input({ message: 'What is the task you want to plan?' })
      } catch (error) {
        if (error instanceof Error && error.name === 'ExitPromptError') {
          return
        }
        throw error
      }
    }

    await runWorkflow('plan', planWorkflow, command, { task: taskInput, fileContent, filePath: options.file })
  })
