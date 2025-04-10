// Generated by polka.codes
import 'dotenv/config'
import { Command } from 'commander'
import { version } from '../package.json'
import { runRunner } from './runner'

const program = new Command()

program
  .name('polka-runner')
  .description('polka.codes service runner')
  .version(version)
  .requiredOption('--task-id <id>', 'Task ID')
  .requiredOption('--session-token <token>', 'Session token for authentication')
  .option('--github-token <token>', 'GitHub token for authentication (optional, defaults to GITHUB_TOKEN environment variable)', process.env.GITHUB_TOKEN)
  .option('--api <url>', 'API URL', process.env.API_URL || 'wss://dev-api.polka.codes/api/ws/runner')
  .action(async (options) => {
    await runRunner({
      taskId: options.taskId,
      sessionToken: options.sessionToken,
      githubToken: options.githubToken,
      api: options.api,
    })
  })

program.parse()
