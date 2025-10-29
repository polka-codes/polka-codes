import {
  askFollowupQuestion,
  type FullToolInfo,
  fetchUrl,
  getTodoItem,
  listFiles,
  listMemoryTopics,
  listTodoItems,
  readBinaryFile,
  readFile,
  readMemory,
  searchFiles,
  type TodoItem,
  ToolResponseType,
  updateMemory,
  updateTodoItem,
} from '@polka-codes/core'
import { agentWorkflow, type JsonUserContent, type WorkflowContext, type WorkflowFn } from '@polka-codes/workflow'
import type { z } from 'zod'
import { UserCancelledError } from '../errors'
import { gitDiff } from '../tools'
import type { CliToolRegistry } from '../workflow-tools'
import { codeWorkflow, type JsonFilePart, type JsonImagePart } from './code.workflow'
import { type EpicContext, saveEpicContext } from './epic-context'
import {
  CODE_REVIEW_SYSTEM_PROMPT,
  EPIC_ADD_TODO_ITEMS_SYSTEM_PROMPT,
  EPIC_PLANNER_SYSTEM_PROMPT,
  EpicPlanSchema,
  formatReviewToolInput,
  getPlanPrompt,
  type ReviewToolInput,
} from './prompts'
import { formatElapsedTime, getDefaultContext, parseGitDiffNameStatus, type ReviewResult, reviewOutputSchema } from './workflow.utils'

const MAX_REVIEW_RETRIES = 5

export type EpicWorkflowInput = {
  task: string
  epicContext?: EpicContext
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

async function createAndApprovePlan(
  task: string,
  context: WorkflowContext<CliToolRegistry>,
): Promise<{ plan: string; branchName: string } | null> {
  const { logger, step, tools } = context

  logger.info('Phase 2: Creating high-level plan...\n')
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

      logger.info(`Plan:\n${result.plan}`)
      if (result.branchName) {
        logger.info(`Suggested branch name: ${result.branchName}`)
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
    logger.error('Error: No branch name was generated from the plan. Exiting.')
    return null
  }

  logger.info('High-level plan approved.\n')
  return { plan: highLevelPlan, branchName }
}

async function createFeatureBranch(
  branchName: string,
  context: WorkflowContext<CliToolRegistry>,
): Promise<{ success: boolean; branchName: string | null }> {
  const { logger, step, tools } = context

  logger.info('Phase 3: Creating/switching to feature branch...\n')

  const branchExistsResult = await step(
    'checkBranchExists',
    async () => await tools.executeCommand({ command: 'git', args: ['rev-parse', '--verify', branchName] }),
  )

  if (branchExistsResult.exitCode === 0) {
    // Branch exists
    const currentBranchResult = await step('getCurrentBranch', async () =>
      tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
    )
    const currentBranch = currentBranchResult.stdout.trim()

    if (currentBranch !== branchName) {
      logger.info(`Branch '${branchName}' already exists. Switching to it...`)
      const checkoutResult = await step(
        'checkoutBranch',
        async () => await tools.executeCommand({ command: 'git', args: ['checkout', branchName] }),
      )
      if (checkoutResult.exitCode !== 0) {
        logger.error(`Error: Failed to switch to branch '${branchName}'. Git command failed.`)
        return { success: false, branchName: null }
      }
    } else {
      logger.info(`Already on branch '${branchName}'.`)
    }
  } else {
    // Branch does not exist, create it
    logger.info(`Creating new branch '${branchName}'...`)
    const createBranchResult = await step(
      'createBranch',
      async () => await tools.executeCommand({ command: 'git', args: ['checkout', '-b', branchName] }),
    )
    if (createBranchResult.exitCode !== 0) {
      logger.error(`Error: Failed to create branch '${branchName}'. Git command failed.`)
      return { success: false, branchName: null }
    }
  }

  logger.info(`Successfully on branch '${branchName}'.\n`)
  return { success: true, branchName: branchName }
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

    if (epicContext.branchName) {
      const currentBranchResult = await step('getCurrentBranch', async () =>
        tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] }),
      )
      const currentBranch = currentBranchResult.stdout.trim()
      if (currentBranch !== epicContext.branchName) {
        throw new Error(
          `You are on branch '${currentBranch}' but the epic was started on branch '${epicContext.branchName}'. Please switch to the correct branch to resume.`,
        )
      }
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

  logger.info('Pre-flight checks passed.\n')
  return true
}

async function performReviewAndFixCycle(
  iterationCount: number,
  taskItem: string,
  highLevelPlan: string,
  context: WorkflowContext<CliToolRegistry>,
): Promise<{ passed: boolean }> {
  const { logger, step, tools } = context

  for (let i = 0; i < MAX_REVIEW_RETRIES; i++) {
    const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] })
    const changedFiles = parseGitDiffNameStatus(diffResult.stdout)

    if (changedFiles.length === 0) {
      logger.info('No files were changed. Skipping review.\n')
      return { passed: true }
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
      return { passed: true }
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
      await codeWorkflow({ task: fixTask, mode: 'noninteractive' }, context)
    })

    await step(`commit-fix-${iterationCount}-${i}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '--amend', '--no-edit'] })
    })

    if (i === MAX_REVIEW_RETRIES - 1) {
      logger.error(`\nMax retries (${MAX_REVIEW_RETRIES}) reached. Moving to the next task, but issues might remain.\n`)
      return { passed: false }
    }
  }

  return { passed: false }
}

async function runImplementationLoop(context: WorkflowContext<CliToolRegistry>, highLevelPlan: string): Promise<string[]> {
  const { logger, step, tools } = context
  const commitMessages: string[] = []

  logger.info('Phase 5: Iterative Implementation Loop...\n')
  logger.info(`${'='.repeat(80)}\n`)

  let iterationCount = 0
  let isComplete = false
  let nextTask: string | null = null
  let nextTaskId: string | null = null

  const initialTasks = await step('get-initial-tasks', async () => {
    return await tools.listTodoItems({ status: 'open' })
  })

  if (initialTasks.length > 0) {
    const firstTask = initialTasks[0]
    nextTask = firstTask.title
    nextTaskId = firstTask.id
  } else {
    isComplete = true
  }

  while (!isComplete && nextTask && nextTaskId) {
    iterationCount++
    const taskStartTime = Date.now()

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
      return await codeWorkflow({ task: taskWithContext, mode: 'noninteractive' }, context)
    })

    const commitMessage = `feat: ${nextTask}`
    await step(`commit-initial-${iterationCount}`, async () => {
      await tools.executeCommand({ command: 'git', args: ['add', '.'] })
      await tools.executeCommand({ command: 'git', args: ['commit', '-m', commitMessage] })
    })
    commitMessages.push(commitMessage)

    const { passed: reviewPassed } = await performReviewAndFixCycle(iterationCount, nextTask, highLevelPlan, context)

    const taskElapsed = Date.now() - taskStartTime
    const taskElapsedTime = formatElapsedTime(taskElapsed)

    if (reviewPassed) {
      logger.info(`Iteration ${iterationCount} completed successfully (${taskElapsedTime})`)
    } else {
      logger.warn(`Warning: Iteration ${iterationCount} completed with potential issues (${taskElapsedTime})`)
    }

    // Mark the current task as completed
    await step(`update-task-status-${iterationCount}`, async () => {
      if (!nextTaskId) {
        throw new Error('Invariant violation: nextTaskId is null inside the implementation loop.')
      }
      await tools.updateTodoItem({ operation: 'update', id: nextTaskId, status: 'completed' })
    })

    // Find the next open task
    const openTasks = await step(`get-next-task-${iterationCount}`, async () => {
      return await tools.listTodoItems({ status: 'open' })
    })

    // Update state for the next iteration or complete the workflow
    if (openTasks.length > 0) {
      const nextTodo = openTasks[0]
      nextTask = nextTodo.title
      nextTaskId = nextTodo.id
      isComplete = false
    } else {
      nextTask = null
      nextTaskId = null
      isComplete = true
    }

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

    if (isComplete) {
      logger.info('All tasks complete!\n')
      break
    }

    if (nextTask) {
      logger.info(`Next task: ${nextTask}\n`)
    }

    logger.info(`${'-'.repeat(80)}\n`)
  }
  return commitMessages
}

async function performFinalReviewAndFix(context: WorkflowContext<CliToolRegistry>, highLevelPlan: string): Promise<{ passed: boolean }> {
  const { logger, step, tools } = context

  logger.info('\nPhase 6: Final Review and Fixup...\n')

  const ghCheckResult = await tools.executeCommand({ command: 'gh', args: ['--version'] })
  if (ghCheckResult.exitCode !== 0) {
    logger.warn(
      'Warning: GitHub CLI (gh) is not installed. Skipping final review step. Please install it from https://cli.github.com/ to enable final reviews.',
    )
    return { passed: true }
  }

  const defaultBranchResult = await tools.executeCommand({
    command: 'gh',
    args: ['repo', 'view', '--json', 'defaultBranchRef', '--jq', '.defaultBranchRef.name'],
  })
  const defaultBranch = defaultBranchResult.stdout.trim()

  const currentBranchResult = await tools.executeCommand({ command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] })
  const currentBranch = currentBranchResult.stdout.trim()

  if (currentBranch === defaultBranch) {
    logger.info(`You are on the default branch ('${defaultBranch}'). No final review needed.`)
    return { passed: true }
  }

  const commitRange = `${defaultBranch}...${currentBranch}`

  for (let i = 0; i < MAX_REVIEW_RETRIES; i++) {
    const diffResult = await tools.executeCommand({ command: 'git', args: ['diff', '--name-status', commitRange] })
    const changedFiles = parseGitDiffNameStatus(diffResult.stdout)

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
      await codeWorkflow({ task: fixTask, mode: 'noninteractive' }, context)
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

export const epicWorkflow: WorkflowFn<EpicWorkflowInput, void, CliToolRegistry> = async (input, context) => {
  const { logger, tools } = context
  const { task, epicContext = {} } = input

  const workflowStartTime = Date.now()

  if (!task || task.trim() === '') {
    logger.error('Error: Task cannot be empty. Please provide a valid task description.')
    return
  }

  if (!epicContext.task) {
    epicContext.task = task
  }

  try {
    const preflightResult = await runPreflightChecks(epicContext, context)
    if (!preflightResult) {
      return
    }

    if (!epicContext.plan) {
      if (!epicContext.task) {
        // Should not happen based on logic above, but for type safety
        logger.error('Error: Task is missing in epic context. Exiting.')
        return
      }
      const planResult = await createAndApprovePlan(epicContext.task, context)
      if (!planResult) return
      epicContext.plan = planResult.plan
      epicContext.branchName = planResult.branchName
      await saveEpicContext(epicContext)
    }

    if (!epicContext.plan) {
      // This should not happen if plan was created successfully, but as a safeguard:
      logger.error('Error: Plan is missing after planning phase. Exiting.')
      return
    }

    if (!epicContext.branchName) {
      // This should not happen if plan was created successfully, but as a safeguard:
      logger.error('Error: Branch name is missing after planning phase. Exiting.')
      return
    }

    const branchResult = await createFeatureBranch(epicContext.branchName, context)
    if (!branchResult.success || !branchResult.branchName) return
    if (epicContext.branchName !== branchResult.branchName) {
      epicContext.branchName = branchResult.branchName
      await saveEpicContext(epicContext)
    }

    const todos = await tools.listTodoItems({})
    if (todos.length === 0) {
      await addTodoItemsFromPlan(epicContext.plan, context)
    }

    const commitMessages = await runImplementationLoop(context, epicContext.plan)

    await performFinalReviewAndFix(context, epicContext.plan)

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
    logger.info(`   Branch: ${epicContext.branchName}`)
    logger.info(`   Total time: ${totalElapsedTime}`)
    logger.info(`   Total commits: ${commitMessages.length}`)
    logger.info('Commits created:')
    for (const [idx, msg] of commitMessages.entries()) {
      logger.info(`   ${idx + 1}. ${msg}`)
    }
  } catch (error) {
    logger.error(`\nEpic workflow failed: ${error instanceof Error ? error.message : String(error)}`)
    // Avoid cleanup instructions if we don't have a branch name
    if (epicContext?.branchName) {
      logger.info(`\nBranch '${epicContext.branchName}' was created but work is incomplete.`)
      logger.info(`To cleanup: git checkout <previous-branch> && git branch -D ${epicContext.branchName}\n`)
    }
    throw error
  }
}
