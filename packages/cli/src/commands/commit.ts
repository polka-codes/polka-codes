import { Command } from 'commander'
import { commit } from '../api'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const globalOpts = (command.parent ?? command).opts()
    await commit({
      all: localOptions.all,
      context: message,
      files: globalOpts.file,
      interactive: !globalOpts.yes,
    })
  })
