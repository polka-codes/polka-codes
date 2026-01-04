import { Command } from 'commander'
import { createPr } from '../api'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the pull request generation')
  .action(async (message, _options, command: Command) => {
    const globalOpts = (command.parent ?? command).opts()
    await createPr({
      context: message,
      interactive: !globalOpts.yes,
      ...globalOpts,
    })
  })
