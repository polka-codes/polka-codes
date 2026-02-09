import { Command } from 'commander'
import { task } from '../api'
import { getBaseWorkflowOptions } from '../utils/command'

export async function runTask(taskInput: string | undefined, options: { json?: boolean }, command: Command) {
  const workflowOpts = getBaseWorkflowOptions(command)

  // Handle JSON output mode
  if (options.json) {
    workflowOpts.silent = true
  }

  const result = await task({
    task: taskInput ?? '',
    jsonMode: options.json === true,
    ...workflowOpts,
  })

  // Output JSON if requested
  if (options.json) {
    if (result) {
      // If the agent returned an object (structured JSON), output that
      if (result.type === 'Exit' && result.object) {
        console.log(JSON.stringify(result.object, null, 2))
      } else {
        // Otherwise output the ExitReason structure
        console.log(JSON.stringify(result, null, 2))
      }
    }
  }
}

export const taskCommand = new Command('task')
  .description('Run a generic task using an AI agent.')
  .argument('[task]', 'The task to perform')
  .option('--json', 'Output result as JSON')
  .action(runTask)
