import { spawnSync } from 'node:child_process'
import type { StepRunResult } from '@polka-codes/core'
import { Command } from 'commander'
import { runWorkflowCommand } from '../runWorkflow'
import { commitWorkflow } from '../workflows'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const input = { ...(localOptions.all && { all: true }), ...(message && { context: message }) }

    const handleSuccess = async (result: StepRunResult<{ commitMessage: string }>) => {
      if (result.type === 'success') {
        const { commitMessage } = result.output
        try {
          spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' })
        } catch (error) {
          console.error('Error: Commit failed', error)
          process.exit(1)
        }
      }
    }

    await runWorkflowCommand('commit', commitWorkflow, command, input, handleSuccess)
  })
