import { execSync, spawnSync } from 'node:child_process'
import { streamObject } from 'ai'
import { Command } from 'commander'
import ora from 'ora'
import { z } from 'zod'

import { UsageMeter, getModel } from '@polka-codes/core'

import { parseOptions } from '../options'

export const prCommand = new Command('pr')
  .description('Create a GitHub pull request')
  .argument('[message]', 'Optional context for the commit message generation')
  .action(async (message, _options, command: Command) => {
    const spinner = ora('Gathering information...').start()

    const options = command.parent?.opts() ?? {}
    const { providerConfig } = parseOptions(options)

    const { provider, model, apiKey } = providerConfig.getConfigForCommand('pr') ?? {}

    console.log('Provider:', provider)
    console.log('Model:', model)

    if (!provider || !model) {
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

      const usage = new UsageMeter()

      spinner.text = 'Generating pull request details...'

      const stream = streamObject({
        model: getModel({
          provider: provider as any,
          model,
          apiKey,
        }),
        schema: z.object({
          title: z.string().describe('The title of the pull request'),
          description: z.string().describe('The description of the pull request'),
        }),
        messages: [
          {
            role: 'system',
            content: prompt,
          },
          {
            role: 'user',
            content: `<tool_diff>
${diff}
</tool_diff>
<tool_context>
${message}
</tool_context>
<tool_commig_messages>
${commits}
</tool_commig_messages>
<tool_branch_name>
${branchName}
</tool_branch_name>`,
          },
        ],
      })

      // consume the stream but ignore the output
      for await (const _ of stream.textStream) {
      }

      const prDetails = await stream.object

      spinner.succeed('Pull request details generated')
      // wait for 10ms to let the spinner stop
      await new Promise((resolve) => setTimeout(resolve, 10))

      spawnSync('gh', ['pr', 'create', '--title', prDetails.title.trim(), '--body', prDetails.description.trim()], {
        stdio: 'inherit',
      })

      usage.printUsage()
    } catch (error) {
      console.error('Error creating pull request:', error)
      process.exit(1)
    }
  })

const prompt = `
# Generate Github Pull Request Details

You are given:
- A branch name in <tool_input_branch_name>.
- An optional context message in <tool_input_context> (which may or may not be present).
- All commit messages combined in <tool_input_commit_messages>.
- All diffs combined in <tool_input_commit_diff>.

Your task:
1. Consider the optional context (if provided).
   - If an issue number is found, add "Closes #xxx" at the beginning of the PR description
   - IMPORTANT: Use ONLY the exact format "Closes #xxx" at the beginning of the description
   - DO NOT use variations like "Closes issue #xxx" or other formats
2. Analyze the combined commit messages and diffs.
3. Produce a single GitHub Pull Request title.
4. Produce a Pull Request description that explains the changes.
`
