import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'
import { runChat } from './commands/chat'
import { commitCommand } from './commands/commit'
import { createCommand } from './commands/create'
import { initCommand } from './commands/init'
import { prCommand } from './commands/pr'
import { runTask } from './commands/task'
import { addSharedOptions } from './options'

const program = new Command()

program.name('polka').description('Polka Codes CLI').version(version)

// Main command for executing tasks
program.argument('[task]', 'The task to execute').action(runTask)

// Chat command
program.command('chat').description('Start an interactive chat session').action(runChat)

// Init command
program.addCommand(initCommand)

// Commit command
program.addCommand(commitCommand)

// PR command
program.addCommand(prCommand)

// Create command
program.addCommand(createCommand)

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
