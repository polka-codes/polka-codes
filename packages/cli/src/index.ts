// disable AI SDK Warning: The "temperature" setting is not supported by this model - temperature is not supported for reasoning models
globalThis.AI_SDK_LOG_WARNINGS = false

import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'
import { runChat } from './commands/chat'
import { codeCommand } from './commands/code'
import { commitCommand } from './commands/commit'
import { fixCommand } from './commands/fix'
import { initCommand } from './commands/init'
import { runMeta } from './commands/meta'
import { planCommand } from './commands/plan'
import { prCommand } from './commands/pr'
import { reviewCommand } from './commands/review'
import { addSharedOptions } from './options'

const program = new Command()

program.name('polka').description('Polka Codes CLI').version(version)

// Main command for executing tasks
program.argument('[task]', 'The task to execute').action((task, _options, command) => runMeta(task, command))

// Chat command
program.command('chat').description('Start an interactive chat session').action(runChat)

// Init command
program.addCommand(initCommand)

// Commit command
program.addCommand(commitCommand)

// PR command
program.addCommand(prCommand)

// Review command
program.addCommand(reviewCommand)

// Plan command
program.addCommand(planCommand)

// Code command
program.addCommand(codeCommand)

// Fix command
program.addCommand(fixCommand)

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
