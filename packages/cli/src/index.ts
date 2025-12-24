// disable AI SDK Warning: The "temperature" setting is not supported by this model - temperature is not supported for reasoning models
globalThis.AI_SDK_LOG_WARNINGS = false

import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'
import { codeCommand } from './commands/code'
import { commitCommand } from './commands/commit'
import { epicCommand } from './commands/epic'
import { fixCommand } from './commands/fix'
import { initCommand } from './commands/init'
import { runMeta } from './commands/meta'
import { planCommand } from './commands/plan'
import { prCommand } from './commands/pr'
import { reviewCommand } from './commands/review'
import { workflowCommand } from './commands/workflow'
import { addSharedOptions } from './options'

export * from './api'

const program = new Command()

program.name('polka').description('Polka Codes CLI').version(version)

// Main command for executing tasks
program.argument('[task]', 'The task to execute').action((task, _options, command) => runMeta(task, command))

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

// Epic command
program.addCommand(epicCommand)

// Fix command
program.addCommand(fixCommand)

program.addCommand(workflowCommand)

addSharedOptions(program)

program.parse()

process.on('uncaughtException', (error) => {
  if (error instanceof Error && error.name === 'ExitPromptError') {
    // User cancelled - exit gracefully
    process.exit(0)
  } else {
    // Log error and exit with code 1
    console.error('Uncaught exception:', error)
    process.exit(1)
  }
})
