import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import { prWorkflow } from '../workflows'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the pull request generation')
  .action(async (message, _options, command: Command) => {
    const globalOpts = (command.parent ?? command).opts()
    const { verbose, yes } = globalOpts
    const input = {
      ...(message && { context: message }),
      interactive: !yes,
    }
    const logger = createLogger({
      verbose: verbose,
    })

    await runWorkflow(prWorkflow, input, { commandName: 'pr', command, logger })
  })
