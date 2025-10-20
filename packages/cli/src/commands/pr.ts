import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflowV2 } from '../runWorkflowV2'
import { prWorkflow } from '../workflows'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the pull request generation')
  .action(async (message, _options, command: Command) => {
    const input = { ...(message && { context: message }) }

    const globalOpts = (command.parent ?? command).opts()
    const { verbose } = globalOpts
    const logger = createLogger({
      verbose: verbose,
    })

    await runWorkflowV2(prWorkflow, input, { commandName: 'pr', command, logger })
  })
