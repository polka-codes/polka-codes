import { Command } from 'commander'
import { runWorkflowCommand } from '../runWorkflow'
import { prWorkflow } from '../workflows'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the pull request generation')
  .action(async (message, _options, command: Command) => {
    const input = { ...(message && { context: message }) }

    await runWorkflowCommand('pr', prWorkflow, command, input, async (result, _command) => {
      if (result.type === 'success') {
        console.log('\nPull request created successfully.')
      }
    })
  })
