import { execSync, spawnSync } from 'node:child_process'
import { confirm } from '@inquirer/prompts'
import { generateGitCommitMessage, UsageMeter } from '@polka-codes/core'
import { Command } from 'commander'
import { merge } from 'lodash'
import ora from 'ora'
import { getModel } from '../getModel'
import { parseOptions } from '../options'
import prices from '../prices'

export const commitCommand = new Command('commit')
  .description('Create a commit with AI-generated message')
  .option('-a, --all', 'Stage all files before committing')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, localOptions, command: Command) => {
    const options = command.parent?.opts() ?? {}
    const { providerConfig, config } = parseOptions(options)

    const commandConfig = providerConfig.getConfigForCommand('commit')

    if (!commandConfig || !commandConfig.provider || !commandConfig.model) {
      console.error('Error: No provider specified. Please run "polka config" to configure your AI provider.')
      process.exit(1)
    }

    console.log('Provider:', commandConfig.provider)
    console.log('Model:', commandConfig.model)

    const spinner = ora('Gathering information...').start()

    const usage = new UsageMeter(merge(prices, config.prices ?? {}))

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

      const llm = getModel(commandConfig)

      const commitMessage = await generateGitCommitMessage(llm, { diff, context: message }, usage)

      usage.printUsage()

      spinner.succeed('Commit message generated')

      console.log(`\nCommit message:\n${commitMessage}`)

      // Make the commit
      try {
        spawnSync('git', ['commit', '-m', commitMessage], { stdio: 'inherit' })
      } catch {
        console.error('Error: Commit failed')
        process.exit(1)
      }
    } catch (error) {
      if ((error as Error).constructor.name === 'ExitPromptError') {
        spinner.stop()
        console.log('\nCommit cancelled by user.')
        process.exit(0)
      } else {
        spinner.fail('An unexpected error occurred.')
        console.error('Error:', error)
        process.exit(1)
      }
    }
  })
