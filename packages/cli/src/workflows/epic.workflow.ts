import {
  appendMemory,
  askFollowupQuestion,
  type FullToolInfo,
  fetchUrl,
  listFiles,
  listMemoryTopics,
  readBinaryFile,
  readFile,
  readMemory,
  removeMemory,
  replaceMemory,
  searchFiles,
  ToolResponseType,
} from '@polka-codes/core'
import { agentWorkflow, type JsonUserContent, type WorkflowContext, type WorkflowFn } from '@polka-codes/workflow'
import type { z } from 'zod'
import { UserCancelledError } from '../errors'
import { gitDiff } from '../tools'
import type { CliToolRegistry } from '../workflow-tools'
import { codeWorkflow, type JsonFilePart, type JsonImagePart } from './code.workflow'
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  EPIC_PLAN_UPDATE_SYSTEM_PROMPT,
  EPIC_PLANNER_SYSTEM_PROMPT,
  EpicPlanSchema,
  formatReviewToolInput,
  getPlanPrompt,
  type ReviewToolInput,
  UpdatedPlanSchema,
} from './prompts'
import { formatElapsedTime, getDefaultContext, parseGitDiffNameStatus, type ReviewResult, reviewOutputSchema } from './workflow.utils'

export type EpicWorkflowInput = {
  task: string
}

type CreatePlanOutput = z.infer<typeof EpicPlanSchema>
type CreatePlanInput = {
  task: string
  plan?: string
  files?: (JsonFilePart | JsonImagePart)[]
  feedback?: string
}

async function createPlan(
  input: CreatePlanInput,
  context: WorkflowContext<CliToolRegistry>,
): Promise<CreatePlanOutput & { type: ToolResponseType }> {
  const { task, plan, files, feedback } = input

  const content: JsonUserContent = [{ type: 'text', text: getPlanPrompt(task, plan) }]
  if (files) {
    for (const file of files) {
      if (file.type === 'file') {
        content.push({
          type: 'file',
          mediaType: file.mediaType,
          filename: file.filename,
          data: { type: 'base64', value: file.data },
        })
      } else if (file.type === 'image') {
        content.push({
          type: 'image',
          mediaType: file.mediaType,
          image: { type: 'base64', value: file.image },
        })
      }
    }
  }
  if (feedback) {
    content.push({
      type: 'text',
      text: `The user has provided the following feedback on the plan, please adjust it:\n${feedback}`,
    })
  }

  const planResult = await agentWorkflow(
    {
      systemPrompt: EPIC_PLANNER_SYSTEM_PROMPT,
      userMessage: [{ role: 'user', content }],
      tools: [
        askFollowupQuestion,
        fetchUrl,
        listFiles,
        readFile,
        readBinaryFile,
        searchFiles,
        readMemory,
        appendMemory,
        replaceMemory,
        removeMemory,
        listMemoryTopics,
      ] as FullToolInfo[],
      outputSchema: EpicPlanSchema,
    },
    context,
  )

  if (planResult.type === ToolResponseType.Exit) {
    return { ...(planResult.object as CreatePlanOutput), type: planResult.type }
  }

  return { plan: '', reason: 'Usage limit exceeded.', type: ToolResponseType.Exit, branchName: '' }
}

async function updatePlanAgent(
  currentPlan: string,
  implementationSummary: string,
  completedTask: string,
  context: WorkflowContext<CliToolRegistry>,
): Promise<{ updatedPlan: string; isComplete: boolean; nextTask: string | null }> {
  const userMessage = `# Current Plan

<plan>
${currentPlan}
</plan>

# Implementation Summary

${implementationSummary}

# Completed Task

${completedTask}

Please update the plan by marking the completed task as [x] and identify the next incomplete task.`

  const result = await agentWorkflow(
    {
      systemPrompt: EPIC_PLAN_UPDATE_SYSTEM_PROMPT,
      userMessage: [{ role: 'user', content: userMessage }],
      tools: [] as FullToolInfo[],
      outputSchema: UpdatedPlanSchema,
    },
    context,
  )

  if (result.type !== ToolResponseType.Exit || !result.object) {
    throw new Error('Plan update agent failed')
  }

  const updateResult = result.object as z.infer<typeof UpdatedPlanSchema>
  return {
    updatedPlan: updateResult.updatedPlan,
    isComplete: updateResult.isComplete,
    nextTask: updateResult.nextTask || null,
  }
}

function extractFirstIncompleteTask(plan: string): string | null {
  const lines = plan.split('\n')
  for (const line of lines) {
    const match = line.match(/^\s*-\s*\[\s*\]\s*(.+)$/)
    if (match) {
      return match[1].trim()
    }
  }
  return null
}

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
  let feedback: string | undefined
  let highLevelPlan: string | undefined | null
  let branchName: string

  try {
    while (true) {
      const result = await step('plan', () => createPlan({ task, feedback }, context))

      if (result.question) {
        const answer = await tools.input({
          message: result.question.question,
          default: result.question.defaultAnswer || undefined,
        })
        feedback = `The user answered the question "${result.question.question}" with: "${answer}"`
        continue
      }

      if (!result.plan) {
        if (result.reason) {
          logger.info(`No plan created. Reason: ${result.reason}`)
        } else {
          logger.info('No plan created.')
        }
        return
      }

      logger.info(`📝 Plan:\n${result.plan}`)
      if (result.branchName) {
        logger.info(`🌿 Suggested branch name: ${result.branchName}`)
      }
      feedback = await tools.input({ message: 'Press Enter to approve the plan, or provide feedback to refine it.' })
      if (feedback.trim() === '') {
        highLevelPlan = result.plan
        branchName = result.branchName
        break
      }
    }
  } catch (e) {
    if (e instanceof UserCancelledError) {
      logger.info('Plan creation cancelled by user.')
      return
    }
    throw e
  }

  if (!highLevelPlan) {
    logger.info('Plan not approved. Exiting.')
    return
  }
  logger.info('✅ High-level plan approved.\n')

  if (!branchName) {
    logger.error('❌ Error: No branch name was generated from the plan. Exiting.')
    return
  }

  // Phase 3: Branch Creation
  logger.info('🌿 Phase 3: Creating feature branch...\n')

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

  // Phase 4: Iterative Implementation Loop
  logger.info('🚀 Phase 4: Iterative Implementation Loop...\n')
  logger.info(`${'='.repeat(80)}\n`)

  let currentPlan = highLevelPlan
  let iterationCount = 0
  let isComplete = false

  while (!isComplete) {
    iterationCount++
    const taskStartTime = Date.now()

    const taskItem = extractFirstIncompleteTask(currentPlan)

    if (!taskItem) {
      logger.error('❌ Error: No incomplete checklist item found in plan, but isComplete is false.')
      break
    }

    logger.info(`\n${'━'.repeat(80)}`)
    logger.info(`📌 Iteration ${iterationCount}`)
    logger.info(`${'━'.repeat(80)}`)
    logger.info(`${taskItem}\n`)

    let implementationSummary = ''

    const codeResult = await step(`task-${iterationCount}`, async () => {
      const taskWithContext = `You are working on an epic. Here is the full plan:

<plan>
${currentPlan}
</plan>

Your current task is to implement this specific item:
${taskItem}

Focus only on this item, but use the plan for context.`
      return await codeWorkflow({ task: taskWithContext, mode: 'noninteractive' }, context)
    })

    if (codeResult && 'summaries' in codeResult && codeResult.summaries.length > 0) {
      implementationSummary = codeResult.summaries.join('\n')
    } else {
      implementationSummary = taskItem
    }

    const commitMessage = `feat: ${taskItem}`
    await step(`commit-initial-${iterationCount}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', commitMessage] })
    })
    commitMessages.push(commitMessage)

    const maxRetries = 5
    let reviewPassed = false

    for (let i = 0; i < maxRetries; i++) {
      const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] })
      const changedFiles = parseGitDiffNameStatus(diffResult.stdout)

      if (changedFiles.length === 0) {
        logger.info('ℹ️  No files were changed. Skipping review.\n')
        reviewPassed = true
        break
      }

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

      const reviewAgentResult = await step(`review-${iterationCount}-${i}`, async () => {
        const defaultContext = await getDefaultContext()
        const memoryContext = await tools.getMemoryContext()
        const userMessage = `${defaultContext}\n${memoryContext}\n\n${formatReviewToolInput(changeInfo)}`
        return await agentWorkflow(
          {
            systemPrompt: CODE_REVIEW_SYSTEM_PROMPT,
            userMessage: [{ role: 'user', content: userMessage }],
            tools: [
              readFile,
              readBinaryFile,
              searchFiles,
              listFiles,
              gitDiff,
              readMemory,
              appendMemory,
              replaceMemory,
              removeMemory,
              listMemoryTopics,
            ],
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
        break
      }

      logger.warn(`⚠️  Review found ${reviewResult.specificReviews.length} issue(s). Attempting to fix...\n`)
      reviewResult.specificReviews.forEach((review, idx) => {
        logger.warn(`   ${idx + 1}. ${review.file}:${review.lines}`)
      })
      logger.warn('')

      const reviewSummary = reviewResult.specificReviews.map((r) => `File: ${r.file} (lines: ${r.lines})\nReview: ${r.review}`).join('\n\n')
      const fixTask = `You are working on an epic. The original task was: "${taskItem}".

Here is the full plan for context:
<plan>
${currentPlan}
</plan>

After an initial implementation, a review found the following issues. Please fix them:

${reviewSummary}`

      await step(`fix-${iterationCount}-${i}`, async () => {
        await codeWorkflow({ task: fixTask, mode: 'noninteractive' }, context)
      })

      await step(`commit-fix-${iterationCount}-${i}`, async () => {
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
      logger.info(`✅ Iteration ${iterationCount} completed successfully (${taskElapsedTime})`)
    } else {
      logger.warn(`⚠️  Iteration ${iterationCount} completed with potential issues (${taskElapsedTime})`)
    }

    const updateResult = await step(`update-plan-${iterationCount}`, async () => {
      return await updatePlanAgent(currentPlan, implementationSummary, taskItem, context)
    })

    currentPlan = updateResult.updatedPlan
    isComplete = updateResult.isComplete

    const completedCount = (currentPlan.match(/- \[x\]/g) || []).length
    const totalCount = (currentPlan.match(/- \[[x ]\]/g) || []).length
    logger.info(`\n📊 Progress: ${completedCount}/${totalCount} items completed`)

    if (isComplete) {
      logger.info('✅ All tasks complete!\n')
      break
    }

    if (updateResult.nextTask) {
      logger.info(`📌 Next task: ${updateResult.nextTask}\n`)
    }

    logger.info(`${'━'.repeat(80)}\n`)
  }

  const totalElapsed = Date.now() - workflowStartTime
  const totalElapsedTime = formatElapsedTime(totalElapsed)

  logger.info(`\n${'='.repeat(80)}`)
  logger.info('🎉 Epic Workflow Complete!')
  logger.info(`${'='.repeat(80)}`)
  logger.info('\n📊 Summary:')
  logger.info(`   Total iterations: ${iterationCount}`)
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
