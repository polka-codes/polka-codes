import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'
import { runChat } from './commands/chat'
import { commitCommand } from './commands/commit'
import { configCommand } from './commands/config'
import { runTask } from './commands/task'
import { addSharedOptions } from './options'

const program = new Command()

program.name('polka').description('Polka Codes CLI').version(version)

// Chat command
program.command('chat').description('Start an interactive chat session').action(runChat)

// Config command
program
  .command('config')
  .description('Configure global or local settings')
  .option('-g, --global', 'Use global config')
  .option('-p, --print', 'Print config')
  .action(configCommand)

// Main command for executing tasks
program.argument('[task]', 'The task to execute').action(runTask)

// Commit command
program.addCommand(commitCommand)

addSharedOptions(program)

program.parse()

process.on('uncaughtException', (error) => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    // do nothing
  } else {
    // Rethrow unknown errors
    throw error
  }
})
