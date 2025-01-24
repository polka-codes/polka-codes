import { execSync } from 'node:child_process'
import { confirm } from '@inquirer/prompts'
import { Command } from 'commander'

import { createService, generateGitCommitMessage } from '@polka-codes/core'
import { parseOptions } from '../options'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, options) => {
    const { provider, modelId, apiKey, config } = parseOptions(options)
    if (!provider) {
      console.error('Error: No provider specified. Please run "polka-codes config" to configure your AI provider.')
      process.exit(1)
    }

    const ai = createService(provider, {
      apiKey,
      modelId,
    })

    try {
      // Check if there are any staged files
      const status = execSync('git status --porcelain').toString()
      const stagedFiles = status.split('\n').filter((line) => line.match(/^[MADRC]/))

      // Handle no staged files case
      if (stagedFiles.length === 0) {
        if (options.all) {
          // Stage all files
          execSync('git add .')
        } else {
          const addAll = await confirm({
            message: 'No staged files found. Do you want to stage all files?',
          })
          if (addAll) {
            execSync('git add .')
          } else {
            console.error('Error: No files to commit')
            process.exit(1)
          }
        }
      }

      // Get diff with 200 lines of context
      const diff = execSync('git diff --cached -U200').toString()

      // Generate commit message
      const result = await generateGitCommitMessage(ai, { diff, context: message })

      // Make the commit
      try {
        execSync(`git commit -m "${result.response}"`)
      } catch {
        console.error('Error: Commit failed')
        process.exit(1)
      }

      console.log(`\nCommit message:\n${result.response}`)
    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    }
  })
