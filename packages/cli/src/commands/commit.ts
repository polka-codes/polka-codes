import { execSync } from 'node:child_process'
import { confirm } from '@inquirer/prompts'
import { Command } from 'commander'
import ora from 'ora'

import { createService, generateGitCommitMessage } from '@polka-codes/core'
import { parseOptions } from '../options'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, options) => {
    const spinner = ora('Gathering information...').start()

    const { providerConfig } = parseOptions(options)

    const { provider, model, apiKey } = providerConfig.getConfigForCommand('commit') ?? {}

    if (!provider) {
      console.error('Error: No provider specified. Please run "polka-codes config" to configure your AI provider.')
      process.exit(1)
    }

    const ai = createService(provider, {
      apiKey,
      model,
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
          spinner.stopAndPersist()
          // wait for 10ms to let the spinner stop
          await new Promise((resolve) => setTimeout(resolve, 10))
          const addAll = await confirm({
            message: 'No staged files found. Do you want to stage all files?',
          })
          spinner.start()
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

      spinner.text = 'Generating commit message...'

      // Generate commit message
      const result = await generateGitCommitMessage(ai, { diff, context: message })

      spinner.succeed('Commit message generated')

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
