import { execSync, spawnSync } from 'node:child_process'
import { UsageMeter, createService, generateGithubPullRequestDetails } from '@polka-codes/core'
import { Command } from 'commander'
import ora from 'ora'

import { parseOptions } from '../options'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, _options, command: Command) => {
    const options = command.parent?.opts() ?? {}
    const { providerConfig, config } = parseOptions(options)

    const { provider, model, apiKey, parameters } = providerConfig.getConfigForCommand('pr') ?? {}

    console.log('Provider:', provider)
    console.log('Model:', model)

    const spinner = ora('Gathering information...').start()

    if (!provider) {
      console.error('Error: No provider specified. Please run "pokla config" to configure your AI provider.')
      process.exit(1)
    }

    try {
      // Check if gh CLI is installed
      execSync('gh --version', { stdio: 'ignore' })
    } catch {
      console.error('Error: GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/')
      process.exit(1)
    }

    try {
      // get branch name usnig git
      const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()

      const defaultBranchNames = ['master', 'main', 'develop']

      let defaultBranch: string | undefined

      for (const branchName of defaultBranchNames) {
        if (execSync(`git branch --list ${branchName}`, { encoding: 'utf-8' }).includes(branchName)) {
          defaultBranch = branchName
          break
        }
      }

      if (!defaultBranch) {
        // git remote is slow as it needs to fetch the remote info
        const originInfo = execSync('git remote show origin', { encoding: 'utf-8' })
        defaultBranch = originInfo.match(/HEAD branch: (.*)/)?.[1]
      }

      if (!defaultBranch) {
        console.error('Error: Could not determine default branch name.')
        process.exit(1)
      }

      const commits = execSync(`git --no-pager log --oneline --no-color --no-merges --no-decorate ${defaultBranch}..HEAD`, {
        encoding: 'utf-8',
      })

      const diff = execSync(`git diff --cached -U50 ${defaultBranch}`, { encoding: 'utf-8' })

      const usage = new UsageMeter({
        prices: config.prices,
      })

      const ai = createService(provider, {
        apiKey,
        model,
        parameters,
        usageMeter: usage,
      })

      spinner.text = 'Generating pull request details...'

      const prDetails = await generateGithubPullRequestDetails(ai, {
        branchName: branchName,
        context: message,
        commitMessages: commits,
        commitDiff: diff,
      })

      spinner.succeed('Pull request details generated')

      console.log('Title:', prDetails.response.title)
      console.log(prDetails.response.description)

      // wait for 10ms to let the spinner stop
      await new Promise((resolve) => setTimeout(resolve, 10))

      spawnSync('gh', ['pr', 'create', '--title', prDetails.response.title.trim(), '--body', prDetails.response.description.trim()], {
        stdio: 'inherit',
      })

      usage.printUsage()
    } catch (error) {
      console.error('Error creating pull request:', error)
      process.exit(1)
    }
  })
