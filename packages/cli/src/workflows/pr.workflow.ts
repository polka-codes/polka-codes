// packages/cli/src/workflows/pr.workflow.ts

import { execSync } from 'node:child_process'
import {
  builder,
  type CustomStepSpec,
  parseJsonFromMarkdown,
  type StepRunResult,
  type WorkflowContext,
  type WorkflowSpec,
} from '@polka-codes/core'
import type { Ora } from 'ora'
import { z } from 'zod'

export type PrWorkflowInput = {
  context?: string
}

export interface PrWorkflowContext extends WorkflowContext {
  ui: { spinner: Ora }
}

type PrInfo = {
  branchName: string
  commits: string
  diff: string
  context?: string
}

const getPrInfo: CustomStepSpec<PrWorkflowInput, PrInfo> = {
  id: 'get-pr-info',
  type: 'custom' as const,
  run: async (input, context): Promise<StepRunResult<PrInfo>> => {
    const {
      ui: { spinner },
    } = context as PrWorkflowContext

    try {
      execSync('gh --version', { stdio: 'ignore' })
    } catch (error) {
      spinner.fail('GitHub CLI (gh) is not installed. Please install it from https://cli.github.com/')
      throw error
    }

    spinner.text = 'Gathering information...'

    const branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim()

    const defaultBranchNames = ['master', 'main', 'develop']
    let defaultBranch: string | undefined

    for (const name of defaultBranchNames) {
      if (execSync(`git branch --list ${name}`, { encoding: 'utf-8' }).includes(name)) {
        defaultBranch = name
        break
      }
    }

    if (!defaultBranch) {
      const originInfo = execSync('git remote show origin', { encoding: 'utf-8' })
      defaultBranch = originInfo.match(/HEAD branch: (.*)/)?.[1]
    }

    if (!defaultBranch) {
      throw new Error('Could not determine default branch name.')
    }

    const commits = execSync(`git --no-pager log --oneline --no-color --no-merges --no-decorate ${defaultBranch}..HEAD`, {
      encoding: 'utf-8',
    })

    const diff = execSync(`git diff -U50 ${defaultBranch}..HEAD`, { encoding: 'utf-8' })

    spinner.text = 'Generating pull request details...'

    return {
      type: 'success',
      output: {
        branchName,
        commits,
        diff,
        context: input.context,
      },
    }
  },
}

const PULL_REQUEST_PROMPT = `
You are an expert at creating GitHub pull requests.
Based on the provided git diff, commit messages, and branch name, generate a title and description for the pull request.

<branch_name>
<%= branchName %>
</branch_name>

<commit_messages>
<%= commits %>
</commit_messages>

<diff>
<%= diff %>
</diff>

<% if (context) { %><context><%= context %></context><% } %>

Respond with a JSON object containing the title and description.
Example format:
\`\`\`json
{
  "title": "feat: Add a new feature",
  "description": "This pull request introduces a new feature that does X, Y, and Z."
}
\`\`\`
`

const prDetailsSchema = z.object({
  title: z.string(),
  description: z.string(),
})

const handlePrResult: CustomStepSpec<{ title: string; description: string }, { title: string; description: string }> = {
  id: 'handle-pr-result',
  type: 'custom' as const,
  run: async (input, context) => {
    const {
      ui: { spinner },
    } = context as PrWorkflowContext
    const logger = context.logger ?? console

    spinner.succeed('Pull request details generated')

    logger.log('Title:', input.title)
    logger.log(input.description)

    return { type: 'success', output: input }
  },
}

export const prWorkflow: WorkflowSpec<PrWorkflowInput, { title: string; description: string }> = {
  name: 'Generate Pull Request',
  description: 'Generate GitHub pull request details based on current branch changes.',
  step: builder<PrWorkflowInput>()
    .custom(getPrInfo)
    .agent('generate-pr-details', {
      agent: 'analyzer',
      messages: [
        {
          type: 'template',
          template: PULL_REQUEST_PROMPT,
        },
      ],
      outputSchema: prDetailsSchema,
      parseOutput: parseJsonFromMarkdown,
    })
    .custom(handlePrResult)
    .build(),
}
