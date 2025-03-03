import { execSync, spawnSync } from 'node:child_process'
import { confirm } from '@inquirer/prompts'
import { Command } from 'commander'
import ora from 'ora'

import { UsageMeter, createService, generateGitCommitMessage } from '@polka-codes/core'
import { parseOptions } from '../options'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const spinner = ora('Gathering information...').start()

    const options = command.parent?.opts() ?? {}
    const { providerConfig, config } = parseOptions(options)

    const { provider, model, apiKey, parameters } = providerConfig.getConfigForCommand('commit') ?? {}

    console.log('Provider:', provider)
    console.log('Model:', model)

    if (!provider) {
      console.error('Error: No provider specified. Please run "pokla config" to configure your AI provider.')
      process.exit(1)
    }

    const usage = new UsageMeter({
      prices: config.prices,
    })

    const ai = createService(provider, {
      apiKey,
      model,
      usageMeter: usage,
      parameters,
    })

    try {
      // Check if there are any staged files
      const status = execSync('git status --porcelain').toString()
      const stagedFiles = status.split('\n').filter((line) => line.match(/^[MADRC]/))

      // Handle no staged files case
      if (stagedFiles.length === 0) {
        if (localOptions.all) {
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

      // Get diff with some context
      const diff = execSync('git diff --cached -U50').toString()

      spinner.text = 'Generating commit message...'

      // Generate commit message
      const result = await generateGitCommitMessage(ai, { diff, context: message })

      usage.printUsage()

      spinner.succeed('Commit message generated')

      console.log(`\nCommit message:\n${result.response}`)

      // Make the commit
      try {
        spawnSync('git', ['commit', '-m', result.response], { stdio: 'inherit' })
      } catch {
        console.error('Error: Commit failed')
        process.exit(1)
      }
    } catch (error) {
      console.error('Error:', error)
      process.exit(1)
    }
  })
