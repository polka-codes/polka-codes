import { Command } from 'commander'
import { runWorkflow } from '../runWorkflow'
import { prWorkflow } from '../workflows'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the pull request generation')
  .action(async (message, _options, command: Command) => {
    const input = { ...(message && { context: message }) }

    await runWorkflow('pr', prWorkflow, command, input)
  })
