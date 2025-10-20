import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflowV2 } from '../runWorkflowV2'
import { commitWorkflow } from '../workflows'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const input = { ...(localOptions.all && { all: true }), ...(message && { context: message }) }

    const globalOpts = (command.parent ?? command).opts()
    const { verbose } = globalOpts
    const logger = createLogger({
      verbose,
    })

    await runWorkflowV2(commitWorkflow, input, {
      commandName: 'commit',
      command,
      logger,
    })
  })
