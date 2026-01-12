import { Command } from 'commander'
import { createPr } from '../api'
import { getBaseWorkflowOptions } from '../utils/command'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the pull request generation')
  .action(async (message, _options, command: Command) => {
    const workflowOpts = getBaseWorkflowOptions(command)
    await createPr({
      context: message,
      ...workflowOpts,
    })
  })
