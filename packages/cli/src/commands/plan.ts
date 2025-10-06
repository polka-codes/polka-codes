import { existsSync, readFileSync } from 'node:fs'
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

    let fileContent: string | undefined
    if (options.file && existsSync(options.file)) {
      fileContent = readFileSync(options.file, 'utf-8')
    }

    await runWorkflow('plan', planWorkflow, command, { task: taskInput, fileContent, filePath: options.file })
  })
