import { listFiles, readBinaryFile, readFile, searchFiles, ToolResponseType } from '@polka-codes/core'
import { agentWorkflow, type WorkflowFn } from '@polka-codes/workflow'
import { z } from 'zod'
import { gitDiff } from '../tools'
import type { CliToolRegistry } from '../workflow-tools'
import { codeWorkflow } from './code.workflow'
import { planWorkflow } from './plan.workflow'
import { CODE_REVIEW_PROMPT, EPIC_TASK_BREAKDOWN_PROMPT, formatReviewToolInput, type ReviewToolInput } from './prompts'
import { parseGitDiffNameStatus, type ReviewResult, reviewOutputSchema } from './workflow.utils'

export type EpicWorkflowInput = {
  task: string
}

const epicSchema = z.object({
  overview: z.string().describe('A brief technical overview of the epic.'),
  tasks: z.array(
    z.object({
      description: z.string().describe('A concise, one-sentence description of the task.'),
    }),
  ),
  branchName: z.string().describe('A short, descriptive branch name in kebab-case. For example: `feat/new-feature`'),
})

export const epicWorkflow: WorkflowFn<EpicWorkflowInput, void, CliToolRegistry> = async (input, context) => {
  const { logger, step, tools } = context
  const { task } = input

  // Phase 1: Pre-flight Checks
  logger.info('📋 Phase 1: Running pre-flight checks...\n')
  const gitStatusResult = await step('gitStatus', async () => tools.executeCommand({ command: 'git status --porcelain', shell: true }))

  if (gitStatusResult.stdout.trim() !== '') {
    logger.error('Your working directory is not clean. Please stash or commit your changes before running the epic workflow.')
    return
  }
  logger.info('✅ Pre-flight checks passed.\n')

  logger.info('\n📝 Phase 2: Creating high-level plan...\n')
  const planResult = await step('plan', async () => {
    return await planWorkflow({ task, mode: 'confirm' }, context)
  })

  if (!planResult) {
    logger.info('Plan not approved. Exiting.')
    return
  }
  const highLevelPlan = planResult.plan
  logger.info('✅ High-level plan approved.\n')

  // Phase 4: Task Breakdown
  logger.info('🔨 Phase 3: Breaking down plan into tasks...\n')
  const taskBreakdownResult = await step('taskBreakdown', async () => {
    const userMessage = `Based on the following high-level plan, break it down into a list of smaller, sequential, and implementable tasks. Also, provide a suitable git branch name for this epic and a brief technical overview of the epic.

<plan>
${highLevelPlan}
</plan>

The overview should be a short paragraph that summarizes the overall technical approach.
Each task should be a self-contained unit of work that can be implemented and committed separately.
The branch name should be short, descriptive, and in kebab-case. For example: \`feat/new-feature\`.
`
    return await agentWorkflow(
      {
        systemPrompt: EPIC_TASK_BREAKDOWN_PROMPT,
        userMessage: [{ role: 'user', content: userMessage }],
        tools: [], // No tools needed for breakdown
        outputSchema: epicSchema,
      },
      context,
    )
  })

  if (taskBreakdownResult.type !== ToolResponseType.Exit || !taskBreakdownResult.object) {
    logger.error('Task breakdown failed.')
    return
  }

  const { tasks, branchName, overview } = taskBreakdownResult.object as z.infer<typeof epicSchema>

  if (!tasks || tasks.length === 0) {
    logger.error('No tasks were generated from the plan. Exiting.')
    return
  }
  logger.info('✅ Tasks created.\n')

  // Phase 5: Branch Creation
  logger.info('🌿 Phase 4: Creating feature branch...\n')
  await step('createBranch', async () => await tools.executeCommand({ command: 'git', args: ['checkout', '-b', branchName] }))
  logger.info(`✅ Branch '${branchName}' created.\n`)

  // Phase 6: Task Execution Loop
  logger.info('🚀 Phase 5: Executing tasks...\n')
  for (const [index, taskItem] of tasks.entries()) {
    logger.info(`▶️  Starting task: ${taskItem.description}`)

    await step(`task-${index}`, async () => {
      const taskWithOverview = `You are in the middle of a larger epic. Here is the overview of the epic:\n${overview}\n\nYour current task is: ${taskItem.description}`
      await codeWorkflow({ task: taskWithOverview, mode: 'noninteractive' }, context)
    })

    await step(`commit-initial-${index}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', `feat: ${taskItem.description}`] })
    })

    const maxRetries = 5
    let reviewPassed = false

    for (let i = 0; i < maxRetries; i++) {
      logger.info(`\n🔎 Running review #${i + 1}...\n`)

      const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] })
      const changedFiles = parseGitDiffNameStatus(diffResult.stdout)

      const changeInfo: ReviewToolInput = {
        commitRange: 'HEAD~1...HEAD',
        changedFiles,
      }

      const reviewAgentResult = await step(`review-${index}-${i}`, async () => {
        return await agentWorkflow(
          {
            systemPrompt: CODE_REVIEW_PROMPT,
            userMessage: [{ role: 'user', content: formatReviewToolInput(changeInfo) }],
            tools: [readFile, readBinaryFile, searchFiles, listFiles, gitDiff],
            outputSchema: reviewOutputSchema,
          },
          context,
        )
      })

      if (reviewAgentResult.type !== ToolResponseType.Exit) {
        logger.error(`🚫 Review agent failed with status: ${reviewAgentResult.type}.`)
        break
      }

      const reviewResult = reviewAgentResult.object as ReviewResult

      if (!reviewResult || !reviewResult.specificReviews || reviewResult.specificReviews.length === 0) {
        logger.info('✅ Review passed. No issues found.')
        reviewPassed = true
        break // Exit review loop
      }

      logger.warn(`🚨 Review found ${reviewResult.specificReviews.length} issues. Attempting to fix...`)

      const reviewSummary = reviewResult.specificReviews.map((r) => `File: ${r.file} (lines: ${r.lines})\nReview: ${r.review}`).join('\n\n')
      const fixTask = `You are in the middle of a larger epic. The original task was: "${taskItem.description}".
Here is the overview of the epic:
${overview}

After an initial implementation, a review found the following issues. Please fix them:\n\n${reviewSummary}`

      await step(`fix-${index}-${i}`, async () => {
        await codeWorkflow({ task: fixTask, mode: 'noninteractive' }, context)
      })

      await step(`commit-fix-${index}-${i}`, async () => {
        await tools.executeCommand({ command: 'git', args: ['add', '.'] })
        await tools.executeCommand({ command: 'git', args: ['commit', '--amend', '--no-edit'] })
      })

      if (i === maxRetries - 1) {
        logger.error(`🚫 Max retries reached for task: ${taskItem.description}. Moving to the next task, but issues might remain.`)
      }
    }

    if (reviewPassed) {
      logger.info(`✅ Task completed and committed: ${taskItem.description}`)
    }
  }
}
