import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import { commitWorkflow } from '../workflows'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const globalOpts = (command.parent ?? command).opts()
    const { verbose, yes } = globalOpts

    const input = {
      ...(localOptions.all && { all: true }),
      ...(message && { context: message }),
      interactive: !yes,
    }
    const logger = createLogger({
      verbose,
    })

    await runWorkflow(commitWorkflow, input, {
      commandName: 'commit',
      command,
      logger,
    })
  })
