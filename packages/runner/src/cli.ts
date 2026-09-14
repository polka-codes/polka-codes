import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'
import { runRunner } from './runner.js'

const program = new Command()

program
  .name('polka-runner')
  .description('polka.codes service runner')
  .version(version)
  .requiredOption('--task-id <id>', 'Task ID')
  .requiredOption('--session-token <token>', 'Session token for authentication')
  .option('--api <url>', 'API URL', process.env.API_URL || 'wss://dev-api.polka.codes/api/ws/runner')
  .action(async (options) => {
    await runRunner({
      taskId: options.taskId,
      sessionToken: options.sessionToken,
      api: options.api,
    })
  })

try {
  await program.parseAsync()
} catch (error) {
  console.error('Runner startup failed:', error instanceof Error ? error.message : 'Unknown startup error.')
  process.exitCode = 1
}
