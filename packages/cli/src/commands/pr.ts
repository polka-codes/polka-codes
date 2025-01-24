import { execSync } from 'node:child_process'
import { createService, generateGithubPullRequestDetails } from '@polka-codes/core'
import { Command } from 'commander'

import { parseOptions } from '../options'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, options) => {
    const { provider, modelId, apiKey, config } = parseOptions(options)
    if (!provider) {
      console.error('Error: No provider specified. Please run "polka-codes config" to configure your AI provider.')
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

      // get default branch name
      const originInfo = execSync('git remote show origin', { encoding: 'utf-8' })
      let defaultBranch = originInfo.match(/HEAD branch: (.*)/)?.[1]

      if (!defaultBranch) {
        const defaultBranchNames = ['main', 'master']

        for (const branchName of defaultBranchNames) {
          if (execSync(`git branch --list ${branchName}`, { encoding: 'utf-8' }).includes(branchName)) {
            defaultBranch = branchName
            break
          }
        }
      }

      if (!defaultBranch) {
        console.error('Error: Could not determine default branch name.')
        process.exit(1)
      }

      const commits = execSync(`git log --pretty=format:"%h %s" --no-merges --no-decorate ${defaultBranch}..HEAD`, {
        encoding: 'utf-8',
      })

      const diff = execSync(`git diff --cached -U200 ${defaultBranch}..HEAD`, { encoding: 'utf-8' })

      const ai = createService(provider, {
        apiKey,
        modelId,
      })

      const prDetails = await generateGithubPullRequestDetails(ai, {
        branchName: branchName,
        context: message,
        commitMessages: commits,
        commitDiff: diff,
      })

      // Create PR using gh CLI
      execSync(`gh pr create --title "${prDetails.response.title}" --body "${prDetails.response.description}"`, {
        stdio: 'inherit',
      })
    } catch (error) {
      console.error('Error creating pull request:', error)
      process.exit(1)
    }
  })
