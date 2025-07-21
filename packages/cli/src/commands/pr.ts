import { execSync, spawnSync } from 'node:child_process'
import { UsageMeter, generateGithubPullRequestDetails } from '@polka-codes/core'
import { Command } from 'commander'
import ora from 'ora'

import { getModel } from '../getModel'
import { parseOptions } from '../options'

const prompt = `
# Generate GitHub Pull Request Details

**Inputs**
- \`<tool_input_branch_name>\`
- \`<tool_input_commit_messages>\` = all commit messages combined
- \`<tool_input_commit_diff>\` - all diffs combined
- \`<tool_input_context>\` (optional)

**Steps**
1. If \`<tool_input_context>\` contains an issue number, prepend
   \`Closes #<number>\` **exactly in this format** to the PR description.
   - Do **not** use variations like “Closes issue #xxx”.
2. Analyze the combined commit messages and diffs.

**Output**
- **Title:** A single concise GitHub Pull Request title.
- **Description:** A clear explanation of the changes. If step 1 applies, start with the required \`Closes #<number>\` line.
`

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, _options, command: Command) => {
    const options = command.parent?.opts() ?? {}
    const { providerConfig, config } = parseOptions(options)

    const { provider, model, apiKey } = providerConfig.getConfigForCommand('pr') ?? {}

    const spinner = ora('Gathering information...').start()

    if (!provider || !model) {
      console.error('Error: No provider specified. Please run "pokla config" to configure your AI provider.')
      process.exit(1)
    }

    console.log('Provider:', provider)
    console.log('Model:', model)

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

      const usage = new UsageMeter(config.prices)

      const ai = getModel({
        provider,
        apiKey,
        model,
      })

      spinner.text = 'Generating pull request details...'

      const resp = await generateGithubPullRequestDetails(
        ai,
        {
          commitDiff: diff,
          commitMessages: commits,
          branchName,
          context: message,
        },
        usage,
      )

      usage.printUsage()

      spinner.succeed('Pull request details generated')

      const title = resp.title.trim()
      const description = resp.description.trim()

      console.log('Title:', title)
      console.log(description)

      // wait for 10ms to let the spinner stop
      await new Promise((resolve) => setTimeout(resolve, 10))

      spawnSync('gh', ['pr', 'create', '--title', title, '--body', description], {
        stdio: 'inherit',
      })

      usage.printUsage()
    } catch (error) {
      console.error('Error creating pull request:', error)
      process.exit(1)
    }
  })
