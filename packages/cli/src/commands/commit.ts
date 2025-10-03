import { Command } from 'commander'
import { runWorkflowV2 } from '../runWorkflowV2'
import { commitWorkflow } from '../workflows'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const input = { ...(localOptions.all && { all: true }), ...(message && { context: message }) }

    await runWorkflowV2('commit', commitWorkflow, command, input)
  })
