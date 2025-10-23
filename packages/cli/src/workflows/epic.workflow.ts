import { listFiles, readBinaryFile, readFile, searchFiles, ToolResponseType } from '@polka-codes/core'
import { agentWorkflow, type WorkflowFn } from '@polka-codes/workflow'
import { z } from 'zod'
import { gitDiff } from '../tools'
import type { CliToolRegistry } from '../workflow-tools'
import { codeWorkflow } from './code.workflow'
import { planWorkflow } from './plan.workflow'
import { CODE_REVIEW_SYSTEM_PROMPT, EPIC_TASK_BREAKDOWN_SYSTEM_PROMPT, formatReviewToolInput, type ReviewToolInput } from './prompts'
import { formatElapsedTime, getDefaultContext, parseGitDiffNameStatus, type ReviewResult, reviewOutputSchema } from './workflow.utils'

export type EpicWorkflowInput = {
  task: string
}

const epicSchema = z.object({
  overview: z.string().describe('A brief technical overview of the epic.'),
  tasks: z.array(z.string().describe('A detailed, self-contained, and implementable task description.')),
  branchName: z.string().describe('A short, descriptive branch name in kebab-case. For example: `feat/new-feature`'),
})

export const epicWorkflow: WorkflowFn<EpicWorkflowInput, void, CliToolRegistry> = async (input, context) => {
  const { logger, step, tools } = context
  const { task } = input

  const workflowStartTime = Date.now()
  const commitMessages: string[] = []

  // Validation: Check for empty task
  if (!task || task.trim() === '') {
    logger.error('❌ Error: Task cannot be empty. Please provide a valid task description.')
    return
  }

  // Phase 1: Pre-flight Checks
  logger.info('📋 Phase 1: Running pre-flight checks...\n')

  // Check if git is initialized
  const gitCheckResult = await step('gitCheck', async () => tools.executeCommand({ command: 'git', args: ['rev-parse', '--git-dir'] }))

  if (gitCheckResult.exitCode !== 0) {
    logger.error('❌ Error: Git is not initialized in this directory. Please run `git init` first.')
    return
  }

  const gitStatusResult = await step('gitStatus', async () => tools.executeCommand({ command: 'git status --porcelain', shell: true }))

  if (gitStatusResult.stdout.trim() !== '') {
    logger.error('❌ Error: Your working directory is not clean. Please stash or commit your changes before running the epic workflow.')
    return
  }
  logger.info('✅ Pre-flight checks passed.\n')

  logger.info('📝 Phase 2: Creating high-level plan...\n')
  const planResult = await step('plan', async () => {
    return await planWorkflow({ task, mode: 'confirm' }, context)
  })

  if (!planResult) {
    logger.info('Plan not approved. Exiting.')
    return
  }
  const highLevelPlan = planResult.plan
  logger.info('✅ High-level plan approved.\n')

  // Phase 3: Task Breakdown
  logger.info('🔨 Phase 3: Breaking down plan into tasks...\n')
  const taskBreakdownResult = await step('taskBreakdown', async () => {
    const defaultContext = await getDefaultContext()
    const userMessage = `Based on the following high-level plan, break it down into a list of smaller, sequential, and implementable tasks. Also, provide a suitable git branch name for this epic and a brief technical overview of the epic\n\n${defaultContext}.

<plan>
${highLevelPlan}
</plan>

The overview should be a short paragraph that summarizes the overall technical approach.
Each task should be a self-contained unit of work that can be implemented and committed separately.
The branch name should be short, descriptive, and in kebab-case. For example: \`feat/new-feature\`.
`
    return await agentWorkflow(
      {
        systemPrompt: EPIC_TASK_BREAKDOWN_SYSTEM_PROMPT,
        userMessage: [{ role: 'user', content: userMessage }],
        tools: [listFiles, readFile, searchFiles, readBinaryFile],
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
    logger.error('❌ Error: No tasks were generated from the plan. Exiting.')
    return
  }

  logger.info(`✅ Tasks created: ${tasks.length} task(s)\n`)
  logger.info('📝 Task list:')
  tasks.forEach((t, i) => {
    logger.info(`  ${i + 1}. ${t}`)
  })
  logger.info('')

  // Phase 4: Branch Creation
  logger.info('🌿 Phase 4: Creating feature branch...\n')

  // Validate branch name format
  if (!/^[a-zA-Z0-9/_-]+$/.test(branchName)) {
    logger.error(
      `❌ Error: Invalid branch name format: "${branchName}". Branch names should contain only letters, numbers, hyphens, underscores, and forward slashes.`,
    )
    return
  }

  // Check if branch already exists
  const branchCheckResult = await step('checkBranch', async () =>
    tools.executeCommand({ command: 'git', args: ['rev-parse', '--verify', branchName] }),
  )

  if (branchCheckResult.exitCode === 0) {
    logger.error(`❌ Error: Branch '${branchName}' already exists. Please use a different branch name or delete the existing branch.`)
    return
  }

  await step('createBranch', async () => await tools.executeCommand({ command: 'git', args: ['checkout', '-b', branchName] }))
  logger.info(`✅ Branch '${branchName}' created.\n`)

  // Phase 5: Task Execution Loop
  logger.info('🚀 Phase 5: Executing tasks...\n')
  logger.info(`${'='.repeat(80)}\n`)

  for (const [index, taskItem] of tasks.entries()) {
    const taskStartTime = Date.now()
    const taskNumber = index + 1
    const totalTasks = tasks.length

    logger.info(`\n${'━'.repeat(80)}`)
    logger.info(`📌 Task ${taskNumber} of ${totalTasks}`)
    logger.info(`${'━'.repeat(80)}`)
    logger.info(`${taskItem}\n`)

    await step(`task-${index}`, async () => {
      const taskWithOverview = `You are in the middle of a larger epic. Here is the overview of the epic:\n${overview}\n\nYour current task is: ${taskItem}`
      await codeWorkflow({ task: taskWithOverview, mode: 'noninteractive' }, context)
    })

    const commitMessage = `feat: ${taskItem}`
    await step(`commit-initial-${index}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', commitMessage] })
    })
    commitMessages.push(commitMessage)

    const maxRetries = 5
    let reviewPassed = false

    for (let i = 0; i < maxRetries; i++) {
      const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] })
      const changedFiles = parseGitDiffNameStatus(diffResult.stdout)

      // Early exit: Skip review if no files were changed
      if (changedFiles.length === 0) {
        logger.info('ℹ️  No files were changed. Skipping review.\n')
        reviewPassed = true
        break
      }

      // Check if any reviewable source files were modified
      const reviewableExtensions = [
        '.ts',
        '.tsx',
        '.js',
        '.jsx',
        '.py',
        '.java',
        '.go',
        '.rs',
        '.c',
        '.cpp',
        '.h',
        '.css',
        '.scss',
        '.html',
        '.vue',
        '.svelte',
      ]
      const hasReviewableFiles = changedFiles.some((file) => reviewableExtensions.some((ext) => file.path.endsWith(ext)))

      if (!hasReviewableFiles) {
        logger.info('ℹ️  No reviewable source files were modified. Skipping review.\n')
        reviewPassed = true
        break
      }

      logger.info(`\n🔎 Review iteration ${i + 1}/${maxRetries}`)
      logger.info(`   Changed files: ${changedFiles.length}`)
      logger.info(`   Reviewable files: ${changedFiles.filter((f) => reviewableExtensions.some((ext) => f.path.endsWith(ext))).length}\n`)

      const changeInfo: ReviewToolInput = {
        commitRange: 'HEAD~1...HEAD',
        changedFiles,
      }

      const reviewAgentResult = await step(`review-${index}-${i}`, async () => {
        const defaultContext = await getDefaultContext()
        const userMessage = `${defaultContext}\n\n${formatReviewToolInput(changeInfo)}`
        return await agentWorkflow(
          {
            systemPrompt: CODE_REVIEW_SYSTEM_PROMPT,
            userMessage: [{ role: 'user', content: userMessage }],
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
        logger.info('✅ Review passed. No issues found.\n')
        reviewPassed = true
        break // Exit review loop
      }

      logger.warn(`⚠️  Review found ${reviewResult.specificReviews.length} issue(s). Attempting to fix...\n`)
      reviewResult.specificReviews.forEach((review, idx) => {
        logger.warn(`   ${idx + 1}. ${review.file}:${review.lines}`)
      })
      logger.warn('')

      const reviewSummary = reviewResult.specificReviews.map((r) => `File: ${r.file} (lines: ${r.lines})\nReview: ${r.review}`).join('\n\n')
      const fixTask = `You are in the middle of a larger epic. The original task was: "${taskItem}".
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
        logger.error(`\n🚫 Max retries (${maxRetries}) reached. Moving to the next task, but issues might remain.\n`)
      }
    }

    const taskElapsed = Date.now() - taskStartTime
    const taskElapsedTime = formatElapsedTime(taskElapsed)

    if (reviewPassed) {
      logger.info(`✅ Task ${taskNumber}/${totalTasks} completed successfully (${taskElapsedTime})`)
    } else {
      logger.warn(`⚠️  Task ${taskNumber}/${totalTasks} completed with potential issues (${taskElapsedTime})`)
    }

    logger.info(`${'━'.repeat(80)}\n`)
  }

  // End-of-workflow summary
  const totalElapsed = Date.now() - workflowStartTime
  const totalElapsedTime = formatElapsedTime(totalElapsed)

  logger.info(`\n${'='.repeat(80)}`)
  logger.info('🎉 Epic Workflow Complete!')
  logger.info(`${'='.repeat(80)}`)
  logger.info('\n📊 Summary:')
  logger.info(`   Total tasks: ${tasks.length}`)
  logger.info(`   Total commits: ${commitMessages.length}`)
  logger.info(`   Branch: ${branchName}`)
  logger.info(`   Total time: ${totalElapsedTime}\n`)

  logger.info('📝 Commits created:')
  commitMessages.forEach((msg, idx) => {
    logger.info(`   ${idx + 1}. ${msg}`)
  })

  logger.info(`\n💡 Next steps:`)
  logger.info(`   • Review your changes: git log`)
  logger.info(`   • Push to remote: git push origin ${branchName}`)
  logger.info(`   • Create a pull request on your Git platform\n`)
  logger.info(`${'='.repeat(80)}\n`)
}
