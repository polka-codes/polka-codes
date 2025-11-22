import {
  agentWorkflow,
  askFollowupQuestion,
  type FullToolInfo,
  fetchUrl,
  getTodoItem,
  type JsonModelMessage,
  type JsonUserContent,
  type JsonUserModelMessage,
  listFiles,
  listMemoryTopics,
  listTodoItems,
  readBinaryFile,
  readFile,
  readMemory,
  searchFiles,
  type TodoItem,
  ToolResponseType,
  UsageMeter,
  updateMemory,
  updateTodoItem,
  type WorkflowContext,
  type WorkflowFn,
} from '@polka-codes/core'
import type { z } from 'zod'
import type { WorkflowTools } from './../../../core/src/workflow/workflow'
import { UserCancelledError } from '../errors'
import { gitDiff } from '../tools'
import type { CliToolRegistry } from '../workflow-tools'
import { codeWorkflow, type JsonFilePart, type JsonImagePart } from './code.workflow'
import { commitWorkflow } from './commit.workflow'
import type { EpicContext } from './epic-context'
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  EPIC_ADD_TODO_ITEMS_SYSTEM_PROMPT,
  EPIC_PLANNER_SYSTEM_PROMPT,
  EpicPlanSchema,
  formatReviewToolInput,
  getPlanPrompt,
  type ReviewToolInput,
} from './prompts'
import {
  type BaseWorkflowInput,
  formatElapsedTime,
  getDefaultContext,
  parseGitDiffNameStatus,
  type ReviewResult,
  reviewOutputSchema,
} from './workflow.utils'

export type EpicWorkflowInput = EpicContext & {
  saveEpicContext: (context: EpicContext) => Promise<void>
  saveUsageSnapshot: () => Promise<void>
}

const MAX_REVIEW_RETRIES = 5

const TODO_HANDLING_INSTRUCTIONS = `If you discover that a task is larger than you thought, or that a new task is required, you can add a // TODO comment in the code and create a todo item for it. This will allow you to continue with the current task and address the larger issue later.`

async function createPlan(
  input: {
    task: string
    plan?: string
    files?: (JsonFilePart | JsonImagePart)[]
    feedback?: string
    messages?: JsonModelMessage[]
    additionalTools: { search?: FullToolInfo }
  },
  context: WorkflowContext<CliToolRegistry>,
) {
  const { task, plan, files, feedback, messages, additionalTools } = input
  const { tools } = context

  const agentTools = [
    askFollowupQuestion,
    fetchUrl,
    listFiles,
    readFile,
    readBinaryFile,
    searchFiles,
    readMemory,
    updateMemory,
    listMemoryTopics,
  ] as FullToolInfo[]

  if (additionalTools.search) {
    agentTools.push(additionalTools.search)
  }

  if (messages) {
    // Continuing a conversation
    const userMessage: JsonUserModelMessage[] = feedback ? [{ role: 'user', content: feedback }] : []
    return await agentWorkflow(
      {
        messages,
        userMessage,
        tools: agentTools,
        outputSchema: EpicPlanSchema,
      },
      context,
    )
  }

  // Starting a new conversation
  const defaultContext = await getDefaultContext()
  const memoryContext = await tools.getMemoryContext()
  const prompt = `${memoryContext}\n${getPlanPrompt(task, plan)}\n\n${defaultContext}`
  const content: JsonUserContent = [{ type: 'text', text: prompt }]

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
  const userMessage: JsonUserModelMessage[] = [{ role: 'user', content }]

  return await agentWorkflow(
    {
      systemPrompt: EPIC_PLANNER_SYSTEM_PROMPT,
      userMessage,
      tools: agentTools,
      outputSchema: EpicPlanSchema,
    },
    context,
  )
}

async function createAndApprovePlan(
  task: string,
  context: WorkflowContext<CliToolRegistry>,
  saveUsageSnapshot: () => Promise<void>,
  interactive = true,
  additionalTools: { search?: FullToolInfo },
): Promise<{ plan: string; branchName: string } | null> {
  const { logger, step, tools } = context

  logger.info('Phase 2: Creating high-level plan...\n')
  let feedback: string | undefined
  let planAttempt = 1
  let messages: JsonModelMessage[] | undefined

  try {
    while (true) {
      const planAgentResult = await step(`plan-${planAttempt}`, () => createPlan({ task, feedback, messages, additionalTools }, context))
      messages = planAgentResult.messages
      planAttempt++

      if (planAgentResult.type !== ToolResponseType.Exit) {
        logger.error(`Plan creation failed. Agent exited with status: ${planAgentResult.type}`)
        return null
      }

      const result = planAgentResult.object as z.infer<typeof EpicPlanSchema>

      switch (result.type) {
        case 'plan-generated': {
          if (!result.plan || !result.branchName) {
            // This should not happen due to schema validation, but as a safeguard
            logger.error('Invalid plan-generated response. Missing plan or branchName.')
            return null
          }
          logger.info(`Plan:\n${result.plan}`)
          logger.info(`Suggested branch name: ${result.branchName}`)

          if (!interactive) {
            logger.info('Non-interactive mode: Auto-approving plan.')
            await saveUsageSnapshot()
            return { plan: result.plan, branchName: result.branchName }
          }

          feedback = await tools.input({ message: 'Press Enter to approve the plan, or provide feedback to refine it.' })
          if (feedback.trim() === '') {
            logger.info('High-level plan approved.\n')
            await saveUsageSnapshot()
            return { plan: result.plan, branchName: result.branchName }
          }
          break // Continues the while loop for refinement
        }
        case 'question': {
          if (!result.question) {
            logger.error('Invalid question response. Missing question object.')
            return null
          }
          const answer = await tools.input({
            message: result.question.question,
            default: result.question.defaultAnswer || undefined,
          })
          feedback = `The user answered the question "${result.question.question}" with: "${answer}"`
          break // Continues the while loop to re-plan with the answer
        }
        case 'error': {
          logger.info(`Plan creation failed. Reason: ${result.reason || 'Unknown error'}`)
          return null
        }
        default: {
          logger.error(`Unknown response type from planner: ${(result as any).type}`)
          return null
        }
      }
    }
  } catch (e) {
    if (e instanceof UserCancelledError) {
      logger.info('Plan creation cancelled by user.')
      return null
    }
    throw e
  }
}

async function createFeatureBranch(
  branchName: string,
  baseBranch: string | undefined,
  context: WorkflowContext<CliToolRegistry>,
): Promise<{ success: boolean; branchName: string | null }> {
  const { logger, step, tools } = context
  const MAX_ATTEMPTS = 10
  let currentBranchName = branchName

  logger.info('Phase 3: Creating/switching to feature branch...\n')

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      currentBranchName = `${branchName}-${attempt}`
    }
    logger.info(`Attempting to use branch name: '${currentBranchName}' (Attempt ${attempt + 1}/${MAX_ATTEMPTS})`)

    // 1. Check if we are already on the target branch
    const currentBranchResult = await step(`getCurrentBranch-${attempt}`, async () =>
      tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
    )
    const onBranch = currentBranchResult.stdout.trim()
    if (onBranch === currentBranchName) {
      logger.info(`Already on branch '${currentBranchName}'.`)
      logger.info(`Successfully on branch '${currentBranchName}'.\n`)
      return { success: true, branchName: currentBranchName }
    }

    // 2. Check if the target branch exists locally
    const branchExistsResult = await step(
      `checkBranchExists-${attempt}`,
      async () => await tools.executeCommand({ command: 'git', args: ['rev-parse', '--verify', currentBranchName] }),
    )

    if (branchExistsResult.exitCode === 0) {
      // Branch exists, try to check it out
      logger.info(`Branch '${currentBranchName}' already exists. Switching to it...`)
      const checkoutResult = await step(
        `checkoutBranch-${attempt}`,
        async () => await tools.executeCommand({ command: 'git', args: ['checkout', currentBranchName] }),
      )
      if (checkoutResult.exitCode === 0) {
        logger.info(`Successfully switched to branch '${currentBranchName}'.\n`)
        return { success: true, branchName: currentBranchName }
      }
      // Checkout failed, log and retry with a new name in the next iteration
      logger.warn(`Warning: Failed to switch to existing branch '${currentBranchName}'. Git command failed.`)
    } else {
      // Branch does not exist, try to create it
      logger.info(`Creating new branch '${currentBranchName}'...`)
      const createBranchResult = await step(
        `createBranch-${attempt}`,
        async () =>
          await tools.executeCommand({
            command: 'git',
            args: baseBranch ? ['checkout', '-b', currentBranchName, baseBranch] : ['checkout', '-b', currentBranchName],
          }),
      )
      if (createBranchResult.exitCode === 0) {
        logger.info(`Successfully created and switched to branch '${currentBranchName}'.\n`)
        return { success: true, branchName: currentBranchName }
      }
      // Creation failed, log and retry with a new name in the next iteration
      logger.warn(`Warning: Failed to create branch '${currentBranchName}'. Git command failed.`)
    }
  }

  logger.error(`Error: Failed to create or switch to a feature branch after ${MAX_ATTEMPTS} attempts.`)
  return { success: false, branchName: null }
}

async function addTodoItemsFromPlan(plan: string, context: WorkflowContext<CliToolRegistry>): Promise<void> {
  const { logger, step, tools } = context

  logger.info('Phase 4: Creating todo items from plan...\n')

  await step('add-todo-items', async () => {
    await agentWorkflow(
      {
        systemPrompt: EPIC_ADD_TODO_ITEMS_SYSTEM_PROMPT,
        userMessage: [{ role: 'user', content: `Please create the todo items based on the plan\n<plan>\n${plan}</plan>` }],
        tools: [readFile, searchFiles, listFiles, readMemory, getTodoItem, listTodoItems, updateTodoItem, updateMemory, listMemoryTopics],
      },
      context,
    )
  })

  const todos = await tools.listTodoItems({})
  logger.info(`Created ${todos.length} todo items.\n`)
}

async function runPreflightChecks(epicContext: EpicContext, context: WorkflowContext<CliToolRegistry>) {
  const { logger, step, tools } = context

  logger.info('Phase 1: Running pre-flight checks...\n')

  const gitCheckResult = await step('gitCheck', async () => tools.executeCommand({ command: 'git', args: ['rev-parse', '--git-dir'] }))

  if (gitCheckResult.exitCode !== 0) {
    logger.error('Error: Git is not initialized in this directory. Please run `git init` first.')
    logger.info('Suggestion: Run `git init` to initialize a git repository.\n')
    return false
  }

  if (epicContext.plan) {
    logger.info('Found an existing `.epic.yml` file.')

    if (!epicContext.branchName) {
      throw new Error('Invalid epic context loaded from .epic.yml: branchName is required.')
    }

    const currentBranchResult = await step('getCurrentBranch', async () =>
      tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
    )
    const currentBranch = currentBranchResult.stdout.trim()
    if (currentBranch !== epicContext.branchName) {
      throw new Error(
        `You are on branch '${currentBranch}' but the epic was started on branch '${epicContext.branchName}'. Please switch to the correct branch to resume.`,
      )
    }

    logger.info('Resuming previous epic session.')
    return true
  }

  const gitStatusResult = await step('gitStatus', async () => tools.executeCommand({ command: 'git status --porcelain', shell: true }))

  if (gitStatusResult.stdout.trim() !== '') {
    logger.error('Error: Your working directory is not clean. Please stash or commit your changes before running the epic workflow.')
    logger.info(
      'Suggestion: Run `git add .` and `git commit` to clean your working directory, or `git stash` to temporarily save changes.\n',
    )
    return false
  }

  const baseBranchResult = await step('getBaseBranch', async () =>
    tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
  )
  if (baseBranchResult.exitCode === 0 && baseBranchResult.stdout.trim()) {
    epicContext.baseBranch = baseBranchResult.stdout.trim()
    logger.info(`Using current branch '${epicContext.baseBranch}' as the base for this epic.`)
  }

  logger.info('Pre-flight checks passed.\n')
  return true
}

async function performReviewAndFixCycle(
  iterationCount: number,
  taskItem: string,
  highLevelPlan: string,
  context: WorkflowContext<CliToolRegistry>,
  additionalTools: { search?: FullToolInfo },
): Promise<{ passed: boolean; commitMessages: string[] }> {
  const { logger, step, tools } = context
  const commitMessages: string[] = []

  for (let i = 0; i < MAX_REVIEW_RETRIES; i++) {
    const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] })
    const changedFiles = parseGitDiffNameStatus(diffResult.stdout).filter(({ path }) => path !== '.epic.yml')

    if (changedFiles.length === 0) {
      logger.info('No files were changed. Skipping review.\n')
      return { passed: true, commitMessages: [] }
    }

    logger.info(`\nReview iteration ${i + 1}/${MAX_REVIEW_RETRIES}`)
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
      logger.error(`Review agent failed with status: ${reviewAgentResult.type}.`)
      break
    }

    const reviewResult = reviewAgentResult.object as ReviewResult

    if (!reviewResult || !reviewResult.specificReviews || reviewResult.specificReviews.length === 0) {
      logger.info('Review passed. No issues found.\n')
      return { passed: true, commitMessages }
    }

    logger.warn(`Warning: Review found ${reviewResult.specificReviews.length} issue(s). Attempting to fix...\n`)
    for (const [idx, review] of reviewResult.specificReviews.entries()) {
      logger.warn(`   ${idx + 1}. ${review.file}:${review.lines}`)
    }
    logger.warn('')

    const reviewSummary = reviewResult.specificReviews.map((r) => `File: ${r.file} (lines: ${r.lines})\nReview: ${r.review}`).join('\n\n')

    const fixTask = `You are working on an epic. The original task was: "${taskItem}".

Here is the full plan for context:
<plan>
${highLevelPlan}
</plan>

After an initial implementation, a review found the following issues. Please fix them:

${reviewSummary}`

    await step(`fix-${iterationCount}-${i}`, async () => {
      await codeWorkflow(
        {
          task: fixTask,
          mode: 'noninteractive',
          additionalInstructions: TODO_HANDLING_INSTRUCTIONS,
          customTools: [getTodoItem, listTodoItems, updateTodoItem],
          interactive: false,
          additionalTools,
        },
        context,
      )
    })

    await step(`commit-fix-${iterationCount}-${i}`, async () => {
      const commitMessage = await commitWorkflow(
        {
          all: true,
          context: reviewSummary,
          interactive: false,
          additionalTools,
        },
        context,
      )
      if (commitMessage) {
        commitMessages.push(commitMessage)
      }
    })

    if (i === MAX_REVIEW_RETRIES - 1) {
      logger.error(`\nMax retries (${MAX_REVIEW_RETRIES}) reached. Moving to the next task, but issues might remain.\n`)
      return { passed: false, commitMessages }
    }
  }

  return { passed: false, commitMessages }
}

async function findNextTask(tools: WorkflowTools<CliToolRegistry>): Promise<TodoItem | null> {
  const openRootTasks = await tools.listTodoItems({ status: 'open' })

  if (openRootTasks.length === 0) {
    return null
  }

  let currentTask = openRootTasks[0]

  while (true) {
    const subTasks = await tools.listTodoItems({ status: 'open', id: currentTask.id })
    if (subTasks.length === 0) {
      // This is the innermost open task
      return currentTask
    }
    // Go one level deeper
    currentTask = subTasks[0]
  }
}

async function runImplementationLoop(
  context: WorkflowContext<CliToolRegistry>,
  highLevelPlan: string,
  saveUsageSnapshot: () => Promise<void>,
  additionalTools: { search?: FullToolInfo },
): Promise<string[]> {
  const { logger, step, tools } = context
  const commitMessages: string[] = []

  logger.info('Phase 5: Iterative Implementation Loop...\n')
  logger.info(`${'='.repeat(80)}\n`)

  let iterationCount = 0
  let nextTaskItem = await step('get-initial-task', () => findNextTask(tools))

  while (nextTaskItem) {
    iterationCount++
    const taskStartTime = Date.now()
    const { title: nextTask, id: nextTaskId } = nextTaskItem

    logger.info(`\n${'-'.repeat(80)}`)
    logger.info(`Iteration ${iterationCount}`)
    logger.info(`${'-'.repeat(80)}`)
    logger.info(`${nextTask}\n`)

    await step(`task-${iterationCount}`, async () => {
      const taskWithContext = `You are working on an epic. Here is the full plan:

<plan>
${highLevelPlan}
</plan>

Your current task is to implement this specific item:
${nextTask}

Focus only on this item, but use the plan for context.`
      return await codeWorkflow(
        {
          task: taskWithContext,
          mode: 'noninteractive',
          additionalInstructions: TODO_HANDLING_INSTRUCTIONS,
          customTools: [getTodoItem, listTodoItems, updateTodoItem],
          interactive: false,
          additionalTools,
        },
        context,
      )
    })

    const commitMessage = `feat: ${nextTask}`
    await step(`commit-initial-${iterationCount}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', commitMessage] })
    })
    commitMessages.push(commitMessage)

    const { passed: reviewPassed, commitMessages: fixCommitMessages } = await performReviewAndFixCycle(
      iterationCount,
      nextTask,
      highLevelPlan,
      context,
      additionalTools,
    )
    commitMessages.push(...fixCommitMessages)

    const taskElapsed = Date.now() - taskStartTime
    const taskElapsedTime = formatElapsedTime(taskElapsed)

    if (reviewPassed) {
      logger.info(`Iteration ${iterationCount} completed successfully (${taskElapsedTime})`)
    } else {
      logger.warn(`Warning: Iteration ${iterationCount} completed with potential issues (${taskElapsedTime})`)
    }

    // Mark the current task as completed
    await step(`update-task-status-${iterationCount}`, async () => {
      await tools.updateTodoItem({ operation: 'update', id: nextTaskId, status: 'completed' })
    })

    // Find the next open task
    nextTaskItem = await step(`get-next-task-${iterationCount}`, () => findNextTask(tools))

    const allTodos = await tools.listTodoItems({})
    const completedTodos = allTodos.filter((t: TodoItem) => t.status === 'completed').length
    const totalTodos = allTodos.length

    let progressMessage = ''
    if (totalTodos > 0) {
      progressMessage = `${completedTodos}/${totalTodos} items completed`
    } else {
      progressMessage = `Iteration ${iterationCount} completed`
    }

    logger.info(`\nProgress: ${progressMessage}`)

    await saveUsageSnapshot()

    if (!nextTaskItem) {
      logger.info('All tasks complete!\n')
      break
    }

    if (nextTaskItem) {
      logger.info(`Next task: ${nextTaskItem.title}\n`)
    }

    logger.info(`${'-'.repeat(80)}\n`)
  }
  return commitMessages
}

async function performFinalReviewAndFix(
  context: WorkflowContext<CliToolRegistry>,
  highLevelPlan: string,
  baseBranch: string | undefined,
  additionalTools: { search?: FullToolInfo },
): Promise<{ passed: boolean }> {
  const { logger, step, tools } = context

  logger.info('\nPhase 6: Final Review and Fixup...\n')

  if (!baseBranch) {
    logger.warn('Warning: Base branch is not defined. Skipping final review step.')
    return { passed: true }
  }

  const currentBranchResult = await tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] })
  const currentBranch = currentBranchResult.stdout.trim()

  if (currentBranch === baseBranch) {
    logger.info(`You are on the base branch ('${baseBranch}'). No final review needed.`)
    return { passed: true }
  }

  const commitRange = `${baseBranch}...${currentBranch}`

  for (let i = 0; i < MAX_REVIEW_RETRIES; i++) {
    const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', commitRange] })
    const changedFiles = parseGitDiffNameStatus(diffResult.stdout).filter(({ path }) => path !== '.epic.yml')

    if (changedFiles.length === 0) {
      logger.info('No files have been changed in this branch. Skipping final review.\n')
      return { passed: true }
    }

    logger.info(`\nFinal review iteration ${i + 1}/${MAX_REVIEW_RETRIES}`)
    logger.info(`   Changed files: ${changedFiles.length}`)

    const changeInfo: ReviewToolInput = {
      commitRange,
      changedFiles,
    }

    const reviewAgentResult = await step(`final-review-${i}`, async () => {
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
      logger.error(`Review agent failed with status: ${reviewAgentResult.type}.`)
      break
    }

    const reviewResult = reviewAgentResult.object as ReviewResult

    if (!reviewResult || !reviewResult.specificReviews || reviewResult.specificReviews.length === 0) {
      logger.info('Final review passed. No issues found.\n')
      return { passed: true }
    }

    logger.warn(`Warning: Final review found ${reviewResult.specificReviews.length} issue(s). Attempting to fix...\n`)
    for (const [idx, review] of reviewResult.specificReviews.entries()) {
      logger.warn(`   ${idx + 1}. ${review.file}:${review.lines}`)
    }
    logger.warn('')

    const reviewSummary = reviewResult.specificReviews.map((r) => `File: ${r.file} (lines: ${r.lines})\nReview: ${r.review}`).join('\n\n')

    const fixTask = `You are working on an epic. The original task was to implement a feature based on this plan:\n\n<plan>\n${highLevelPlan}\n</plan>\n\nA final review of all the changes in the branch found the following issues. Please fix them:\n\n${reviewSummary}`

    await step(`final-fix-${i}`, async () => {
      await codeWorkflow(
        {
          task: fixTask,
          mode: 'noninteractive',
          additionalInstructions: TODO_HANDLING_INSTRUCTIONS,
          customTools: [getTodoItem, listTodoItems, updateTodoItem],
          interactive: false,
          additionalTools,
        },
        context,
      )
    })

    await step(`commit-final-fix-${i}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', 'chore: apply automated review feedback'] })
    })

    if (i === MAX_REVIEW_RETRIES - 1) {
      logger.error(`\nMax retries (${MAX_REVIEW_RETRIES}) reached for final review. Issues might remain.\n`)
      return { passed: false }
    }
  }

  return { passed: false }
}

export const epicWorkflow: WorkflowFn<EpicWorkflowInput & BaseWorkflowInput, void, CliToolRegistry> = async (input, context) => {
  const { logger, tools } = context
  const { task, saveEpicContext, saveUsageSnapshot, additionalTools } = input

  const workflowStartTime = Date.now()

  if (!task || task.trim() === '') {
    logger.error('Error: Task cannot be empty. Please provide a valid task description.')
    return
  }

  if (!input.task) {
    input.task = task
  }

  try {
    const preflightResult = await runPreflightChecks(input, context)
    if (!preflightResult) {
      return
    }

    if (!input.plan) {
      if (!input.task) {
        // Should not happen based on logic above, but for type safety
        logger.error('Error: Task is missing in epic context. Exiting.')
        return
      }
      const planResult = await createAndApprovePlan(input.task, context, saveUsageSnapshot, input.interactive, additionalTools)
      if (!planResult) return
      input.plan = planResult.plan
      input.branchName = planResult.branchName
      await saveEpicContext(input)
    }

    if (!input.plan) {
      // This should not happen if plan was created successfully, but as a safeguard:
      logger.error('Error: Plan is missing after planning phase. Exiting.')
      return
    }

    if (!input.branchName) {
      // This should not happen if plan was created successfully, but as a safeguard:
      logger.error('Error: Branch name is missing after planning phase. Exiting.')
      return
    }

    const branchResult = await createFeatureBranch(input.branchName, input.baseBranch ?? undefined, context)
    if (!branchResult.success || !branchResult.branchName) return
    if (input.branchName !== branchResult.branchName) {
      input.branchName = branchResult.branchName
      await saveEpicContext(input)
    }

    const todos = await tools.listTodoItems({})
    if (todos.length === 0) {
      await addTodoItemsFromPlan(input.plan, context)
    }

    const commitMessages = await runImplementationLoop(context, input.plan, saveUsageSnapshot, additionalTools)

    await performFinalReviewAndFix(context, input.plan, input.baseBranch ?? undefined, additionalTools)

    await saveUsageSnapshot()

    // Cleanup .epic.yml
    await tools.executeCommand({ command: 'git', args: ['rm', '-f', '.epic.yml'] })
    const statusResult = await tools.executeCommand({
      command: 'git',
      args: ['status', '--porcelain', '--', '.epic.yml'],
    })
    if (statusResult.stdout.trim() !== '') {
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', 'chore: remove .epic.yml', '--', '.epic.yml'] })
      logger.info('Cleaned up .epic.yml file.')
    }

    const totalElapsed = Date.now() - workflowStartTime
    const totalElapsedTime = formatElapsedTime(totalElapsed)

    logger.info(`\n${'='.repeat(80)}`)
    logger.info('Epic Workflow Complete!')
    logger.info(`${'='.repeat(80)}`)
    logger.info('\nSummary:')
    logger.info(`   Branch: ${input.branchName}`)
    logger.info(`   Total time: ${totalElapsedTime}`)
    logger.info(`   Total commits: ${commitMessages.length}`)
    logger.info('Commits created:')
    for (const [idx, msg] of commitMessages.entries()) {
      logger.info(`   ${idx + 1}. ${msg}`)
    }

    if (input.usages && input.usages.length > 0) {
      const sortedUsages = [...input.usages].sort((a, b) => a.timestamp - b.timestamp)
      let lastUsage = {
        input: 0,
        output: 0,
        cachedRead: 0,
        cost: 0,
        messageCount: 0,
      }
      logger.info('\nUsage Breakdown:')
      sortedUsages.forEach((usage, index) => {
        const delta = {
          input: usage.input - lastUsage.input,
          output: usage.output - lastUsage.output,
          cachedRead: usage.cachedRead - lastUsage.cachedRead,
          cost: usage.cost - lastUsage.cost,
          messageCount: usage.messageCount - lastUsage.messageCount,
        }
        const tempMeter = new UsageMeter()
        tempMeter.setUsage(delta)
        logger.info(`   Step ${index + 1}: ${tempMeter.getUsageText()}`)
        lastUsage = usage
      })

      const last = sortedUsages.at(-1)
      if (last) {
        const totalMeter = new UsageMeter()
        totalMeter.setUsage(last)
        logger.info(`   Total: ${totalMeter.getUsageText()}`)
      }
    }
  } catch (error) {
    logger.error(`\nEpic workflow failed: ${error instanceof Error ? error.message : String(error)}`)
    // Avoid cleanup instructions if we don't have a branch name
    if (input?.branchName) {
      logger.info(`\nBranch '${input.branchName}' was created but work is incomplete.`)
      logger.info(`To cleanup: git checkout <previous-branch> && git branch -D ${input.branchName}\n`)
    }
    throw error
  }
}
