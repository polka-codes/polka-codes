import {
  askFollowupQuestion,
  type FullToolInfo,
  fetchUrl,
  listFiles,
  listMemoryTopics,
  readBinaryFile,
  readFile,
  readMemory,
  searchFiles,
  ToolResponseType,
  updateMemory,
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

const MAX_REVIEW_RETRIES = 5
const BRANCH_NAME_PATTERN = /^[a-zA-Z0-9/_-]+$/

export type EpicWorkflowInput = {
  task: string
}

function validateBranchName(name: string): { valid: boolean; error?: string } {
  if (!BRANCH_NAME_PATTERN.test(name)) {
    return {
      valid: false,
      error: `Invalid branch name format: "${name}". Branch names should contain only letters, numbers, hyphens, underscores, and forward slashes.`,
    }
  }
  if (name.length > 255) {
    return { valid: false, error: 'Branch name is too long (max 255 characters).' }
  }
  return { valid: true }
}

async function performReviewAndFixCycle(
  iterationCount: number,
  taskItem: string,
  currentPlan: string,
  context: WorkflowContext<CliToolRegistry>,
): Promise<{ passed: boolean }> {
  const { logger, step, tools } = context

  for (let i = 0; i < MAX_REVIEW_RETRIES; i++) {
    const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] })
    const changedFiles = parseGitDiffNameStatus(diffResult.stdout)

    if (changedFiles.length === 0) {
      logger.info('ℹ️  No files were changed. Skipping review.\n')
      return { passed: true }
    }

    logger.info(`\n🔎 Review iteration ${i + 1}/${MAX_REVIEW_RETRIES}`)
    logger.info(`   Changed files: ${changedFiles.length}`)

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
          tools: [readFile, readBinaryFile, searchFiles, listFiles, gitDiff, readMemory, updateMemory, listMemoryTopics],
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
      return { passed: true }
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

    if (i === MAX_REVIEW_RETRIES - 1) {
      logger.error(`\n🚫 Max retries (${MAX_REVIEW_RETRIES}) reached. Moving to the next task, but issues might remain.\n`)
      return { passed: false }
    }
  }

  return { passed: false }
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
        updateMemory,
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

async function runPreflightChecks(context: WorkflowContext<CliToolRegistry>): Promise<{ success: boolean }> {
  const { logger, step, tools } = context

  logger.info('📋 Phase 1: Running pre-flight checks...\n')

  const gitCheckResult = await step('gitCheck', async () => tools.executeCommand({ command: 'git', args: ['rev-parse', '--git-dir'] }))

  if (gitCheckResult.exitCode !== 0) {
    logger.error('❌ Error: Git is not initialized in this directory. Please run `git init` first.')
    logger.info('💡 Suggestion: Run `git init` to initialize a git repository.\n')
    return { success: false }
  }

  const gitStatusResult = await step('gitStatus', async () => tools.executeCommand({ command: 'git status --porcelain', shell: true }))

  if (gitStatusResult.stdout.trim() !== '') {
    logger.error('❌ Error: Your working directory is not clean. Please stash or commit your changes before running the epic workflow.')
    logger.info(
      '💡 Suggestion: Run `git add .` and `git commit` to clean your working directory, or `git stash` to temporarily save changes.\n',
    )
    return { success: false }
  }

  logger.info('✅ Pre-flight checks passed.\n')
  return { success: true }
}

export const epicWorkflow: WorkflowFn<EpicWorkflowInput, void, CliToolRegistry> = async (input, context) => {
  const { logger, step, tools } = context
  const { task } = input

  const workflowStartTime = Date.now()
  const commitMessages: string[] = []

  if (!task || task.trim() === '') {
    logger.error('❌ Error: Task cannot be empty. Please provide a valid task description.')
    return
  }

  const preflightResult = await runPreflightChecks(context)
  if (!preflightResult.success) {
    return
  }

  async function createAndApprovePlan(
    task: string,
    context: WorkflowContext<CliToolRegistry>,
  ): Promise<{ plan: string; branchName: string } | null> {
    const { logger, step, tools } = context

    logger.info('📝 Phase 2: Creating high-level plan...\n')
    let feedback: string | undefined
    let highLevelPlan: string | undefined | null
    let branchName: string
    let planAttempt = 1

    try {
      while (true) {
        const result = await step(`plan-${planAttempt}`, () => createPlan({ task, feedback }, context))
        planAttempt++

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
          return null
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
        return null
      }
      throw e
    }

    if (!highLevelPlan) {
      logger.info('Plan not approved. Exiting.')
      return null
    }

    if (!branchName) {
      logger.error('❌ Error: No branch name was generated from the plan. Exiting.')
      return null
    }

    logger.info('✅ High-level plan approved.\n')
    return { plan: highLevelPlan, branchName }
  }

  const planResult = await createAndApprovePlan(task, context)
  if (!planResult) {
    return
  }

  const highLevelPlan = planResult.plan
  let branchName = planResult.branchName

  async function createFeatureBranch(
    branchName: string,
    task: string,
    plan: string,
    context: WorkflowContext<CliToolRegistry>,
  ): Promise<{ success: boolean; branchName: string | null }> {
    const { logger, step, tools } = context

    logger.info('🌿 Phase 3: Creating feature branch...\n')

    const branchValidation = validateBranchName(branchName)
    if (!branchValidation.valid) {
      logger.error(`❌ Error: ${branchValidation.error}`)
      return { success: false, branchName: null }
    }

    let finalBranchName = branchName

    const initialCheckResult = await step('checkBranch-initial', async () =>
      tools.executeCommand({ command: 'git', args: ['rev-parse', '--verify', finalBranchName] }),
    )

    if (initialCheckResult.exitCode === 0) {
      // Branch exists, find a new name
      logger.warn(`⚠️  Branch '${finalBranchName}' already exists. Trying to find an available name...`)

      const suffixMatch = branchName.match(/-(\d+)$/)
      let baseName = branchName
      let counter = 2
      if (suffixMatch) {
        baseName = branchName.substring(0, suffixMatch.index)
        counter = parseInt(suffixMatch[1], 10) + 1
      }

      while (true) {
        finalBranchName = `${baseName}-${counter}`
        const branchCheckResult = await step(`checkBranch-${counter}`, async () =>
          tools.executeCommand({ command: 'git', args: ['rev-parse', '--verify', finalBranchName] }),
        )

        if (branchCheckResult.exitCode !== 0) {
          // Branch doesn't exist, we can use this name
          break
        }
        counter++
      }
    }

    if (finalBranchName !== branchName) {
      logger.info(`Branch name '${branchName}' was taken. Using '${finalBranchName}' instead.`)
    }

    await step('createBranch', async () => await tools.executeCommand({ command: 'git', args: ['checkout', '-b', finalBranchName] }))
    logger.info(`✅ Branch '${finalBranchName}' created.\n`)

    await tools.updateMemory({
      operation: 'append',
      topic: 'epic-context',
      content: `Epic: ${task}\nBranch: ${finalBranchName}\nStarted: ${new Date().toISOString()}`,
    })
    await tools.updateMemory({ operation: 'append', topic: 'epic-plan', content: plan })

    return { success: true, branchName: finalBranchName }
  }

  const branchResult = await createFeatureBranch(branchName, task, highLevelPlan, context)
  if (!branchResult.success || !branchResult.branchName) {
    return
  }
  branchName = branchResult.branchName

  logger.info('🚀 Phase 4: Iterative Implementation Loop...\n')
  logger.info(`${'='.repeat(80)}\n`)

  let currentPlan = highLevelPlan
  let iterationCount = 0
  let isComplete = false
  let nextTask: string | null = null

  try {
    const firstTaskResult = await step('extract-first-task', async () => {
      return await updatePlanAgent(currentPlan, '', '', context)
    })

    currentPlan = firstTaskResult.updatedPlan
    nextTask = firstTaskResult.nextTask
    isComplete = firstTaskResult.isComplete

    while (!isComplete && nextTask) {
      iterationCount++
      const taskStartTime = Date.now()

      logger.info(`\n${'━'.repeat(80)}`)
      logger.info(`📌 Iteration ${iterationCount}`)
      logger.info(`${'━'.repeat(80)}`)
      logger.info(`${nextTask}\n`)

      let implementationSummary = ''

      const codeResult = await step(`task-${iterationCount}`, async () => {
        const taskWithContext = `You are working on an epic. Here is the full plan:

<plan>
${currentPlan}
</plan>

Your current task is to implement this specific item:
${nextTask}

Focus only on this item, but use the plan for context.`
        return await codeWorkflow({ task: taskWithContext, mode: 'noninteractive' }, context)
      })

      if (codeResult && 'summaries' in codeResult && codeResult.summaries.length > 0) {
        implementationSummary = codeResult.summaries.join('\n')
      } else {
        implementationSummary = nextTask
      }

      const commitMessage = `feat: ${nextTask}`
      await step(`commit-initial-${iterationCount}`, async () => {
        await tools.executeCommand({ command: 'git', args: ['add', '.'] })
        await tools.executeCommand({ command: 'git', args: ['commit', '-m', commitMessage] })
      })
      commitMessages.push(commitMessage)

      const { passed: reviewPassed } = await performReviewAndFixCycle(iterationCount, nextTask, currentPlan, context)

      const taskElapsed = Date.now() - taskStartTime
      const taskElapsedTime = formatElapsedTime(taskElapsed)

      if (reviewPassed) {
        logger.info(`✅ Iteration ${iterationCount} completed successfully (${taskElapsedTime})`)
      } else {
        logger.warn(`⚠️  Iteration ${iterationCount} completed with potential issues (${taskElapsedTime})`)
      }

      const updateResult = await step(`update-plan-${iterationCount}`, async () => {
        return await updatePlanAgent(currentPlan, implementationSummary, nextTask ?? '', context)
      })

      currentPlan = updateResult.updatedPlan
      isComplete = updateResult.isComplete
      nextTask = updateResult.nextTask

      await tools.updateMemory({ operation: 'replace', topic: 'epic-plan', content: currentPlan })

      const checkboxCompleted = (currentPlan.match(/- \[x\]/g) || []).length
      const checkboxTotal = (currentPlan.match(/- \[[x ]\]/g) || []).length
      const checkmarkCompleted = (currentPlan.match(/^✅/gm) || []).length

      let progressMessage = ''
      if (checkboxTotal > 0) {
        progressMessage = `${checkboxCompleted}/${checkboxTotal} items completed`
      } else if (checkmarkCompleted > 0) {
        progressMessage = `${checkmarkCompleted} items completed`
      } else {
        progressMessage = `Iteration ${iterationCount} completed`
      }

      logger.info(`\n📊 Progress: ${progressMessage}`)

      if (isComplete) {
        logger.info('✅ All tasks complete!\n')
        break
      }

      if (nextTask) {
        logger.info(`📌 Next task: ${nextTask}\n`)
      }

      logger.info(`${'━'.repeat(80)}\n`)
    }
  } catch (error) {
    logger.error(`\n❌ Epic workflow failed: ${error instanceof Error ? error.message : String(error)}`)
    logger.info(`\nBranch '${branchName}' was created but work is incomplete.`)
    logger.info(`To cleanup: git checkout <previous-branch> && git branch -D ${branchName}\n`)
    await tools.updateMemory({ operation: 'remove', topic: 'epic-context' })
    await tools.updateMemory({ operation: 'remove', topic: 'epic-plan' })
    throw error
  }

  const totalElapsed = Date.now() - workflowStartTime
  const totalElapsedTime = formatElapsedTime(totalElapsed)
  const avgTimePerIteration = iterationCount > 0 ? formatElapsedTime(totalElapsed / iterationCount) : 'N/A'

  logger.info(`\n${'='.repeat(80)}`)
  logger.info('🎉 Epic Workflow Complete!')
  logger.info(`${'='.repeat(80)}`)
  logger.info('\n📊 Summary:')
  logger.info(`   Total iterations: ${iterationCount}`)
  logger.info(`   Total commits: ${commitMessages.length}`)
  logger.info(`   Branch: ${branchName}`)
  logger.info(`   Total time: ${totalElapsedTime}`)
  logger.info(`   Average per iteration: ${avgTimePerIteration}\n`)

  logger.info('📝 Commits created:')
  commitMessages.forEach((msg, idx) => {
    logger.info(`   ${idx + 1}. ${msg}`)
  })

  logger.info(`\n💡 Next steps:`)
  logger.info(`   • Review your changes: git log`)
  logger.info(`   • Push to remote: git push origin ${branchName}`)
  logger.info(`   • Create a pull request on your Git platform\n`)
  logger.info(`${'='.repeat(80)}\n`)

  await tools.updateMemory({ operation: 'remove', topic: 'epic-context' })
  await tools.updateMemory({ operation: 'remove', topic: 'epic-plan' })
}
