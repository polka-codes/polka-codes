/**
 * Polka Codes Scripting API
 *
 * This module provides a high-level TypeScript API for programmatic access to
 * polka-codes workflows. All functions support both interactive and non-interactive modes.
 *
 * @example
 * ```typescript
 * import { commit, code, review } from '@polka-codes/cli'
 *
 * // Non-interactive scripting
 * await commit({ all: true, context: 'Fix login bug', interactive: false })
 *
 * // Interactive use (default)
 * await code({ task: 'Add user authentication' })
 * ```
 */

import type { ExitReason, UsageMeter } from '@polka-codes/core'
import { createLogger } from './logger'
import type { ExecutionContext, StructuredWorkflowFailure } from './runWorkflow'
import { runWorkflow } from './runWorkflow'
import type { ScriptContext } from './script/runner'
import type { CodeWorkflowEvent, WorkflowProgressCallback, WorkflowProgressEvent } from './workflow-events'
import {
  type CodeWorkflowInput,
  codeWorkflow,
  commitWorkflow,
  type FixWorkflowInput,
  fixWorkflow,
  type JsonFilePart,
  type JsonImagePart,
  type PlanWorkflowInput,
  type PlanWorkflowOutput,
  type PrWorkflowInput,
  planWorkflow,
  prWorkflow,
  type ReviewResult,
  type ReviewWorkflowInput,
  reviewWorkflow,
  type TaskWorkflowInput,
  taskWorkflow,
} from './workflows'

type WorkflowRunner = typeof runWorkflow

export type ScriptingApiDependencies = {
  runWorkflow?: WorkflowRunner
}

/**
 * Reusable execution context for CLI options.
 * This interface extends the ExecutionContext from runWorkflow.ts
 * and can be used both from CLI and as a scripting API.
 */
export interface BaseOptions extends Partial<ExecutionContext> {
  /**
   * Callback invoked when usage meter is created, allowing tracking of API costs
   */
  onUsage?: (meter: UsageMeter) => void

  /**
   * Callback invoked with small structured workflow progress events.
   */
  onEvent?: WorkflowProgressCallback
}

export type { CodeWorkflowEvent, WorkflowProgressCallback, WorkflowProgressEvent }

/**
 * Options for commit function
 */
export interface CommitOptions extends BaseOptions {
  /**
   * Stage all files before committing
   * @default false
   */
  all?: boolean

  /**
   * Specific files to stage before committing
   * If provided, only these files will be staged
   */
  files?: string[]

  /**
   * Additional context for commit message generation
   */
  context?: string

  /**
   * Whether to prompt for confirmation (non-interactive commits will auto-confirm)
   * @default true
   */
  interactive?: boolean
}

/**
 * Creates a commit with an AI-generated message
 *
 * @param options - Commit options
 * @returns The generated commit message, or undefined if cancelled
 *
 * @example
 * ```typescript
 * // Commit all changes with context
 * const message = await commit({
 *   all: true,
 *   context: 'Fix authentication bug'
 * })
 *
 * // Non-interactive commit
 * await commit({ all: true, interactive: false })
 * ```
 */
async function commitWithRunner(options: CommitOptions = {}, executeWorkflow: WorkflowRunner): Promise<string | undefined> {
  const { all, files, context: messageContext, interactive, onUsage, onEvent, ...context } = options

  // Create logger from options
  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  // Build workflow input
  const workflowInput = {
    ...(all && { all: true }),
    ...(files && { files }),
    ...(messageContext && { context: messageContext }),
    interactive: interactive !== false,
  }

  // Execute workflow
  const result = await executeWorkflow(commitWorkflow, workflowInput, {
    commandName: 'commit',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent,
  })

  // Handle both string and void returns
  return result ?? undefined
}

export async function commit(options: CommitOptions = {}): Promise<string | undefined> {
  return commitWithRunner(options, runWorkflow)
}

/**
 * Options for createPr function
 */
export interface CreatePrOptions extends BaseOptions {
  /**
   * Additional context for PR description generation
   */
  context?: string

  /**
   * Whether to prompt for confirmation
   * @default true
   */
  interactive?: boolean
}

/**
 * Creates a GitHub pull request with AI-generated title and description
 *
 * @param options - PR creation options
 * @returns The PR URL and details, or undefined if cancelled
 *
 * @example
 * ```typescript
 * // Create PR with context
 * const pr = await createPr({
 *   context: 'Implements user authentication flow'
 * })
 *
 * // Non-interactive PR creation
 * await createPr({ interactive: false })
 * ```
 */
async function createPrWithRunner(
  options: CreatePrOptions = {},
  executeWorkflow: WorkflowRunner,
): Promise<{ title: string; description: string } | undefined> {
  const { context: prContext, interactive, onUsage, onEvent, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: PrWorkflowInput = {
    ...(prContext && { context: prContext }),
  }

  return executeWorkflow(prWorkflow, workflowInput, {
    commandName: 'pr',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent,
  })
}

export async function createPr(options: CreatePrOptions = {}): Promise<{ title: string; description: string } | undefined> {
  return createPrWithRunner(options, runWorkflow)
}

/**
 * Options for code function
 */
export interface CodeOptions extends BaseOptions {
  /**
   * The task to implement
   */
  task: string

  /**
   * Files to include as context (images or attachments)
   */
  files?: Array<JsonFilePart | JsonImagePart>

  /**
   * Execution mode
   * @default 'interactive'
   */
  mode?: 'interactive' | 'noninteractive' | 'direct'

  /**
   * Additional instructions for the AI agent
   */
  additionalInstructions?: string

  /**
   * Skip the post-implementation fix/check workflow
   * @default false
   */
  skipFix?: boolean

  /**
   * Command to run for the post-implementation fix/check workflow.
   * @default Uses check and test scripts from config
   */
  fixCommand?: string

  /**
   * Best-effort guardrail for filesystem write tools. This restricts direct file
   * write/delete/rename tools, but it is not a security sandbox for shell
   * commands or custom tools.
   */
  allowedWritePaths?: string[]

  /**
   * Run without persistent memory or broad default project context.
   * Intended for deterministic non-interactive automation clients.
   * @default false
   */
  stateless?: boolean

  /**
   * Whether to prompt for confirmations
   * @default true
   */
  interactive?: boolean
}

export type CodeWriteOutcome = 'attempted' | 'completed' | 'rejected'

export type CodeWriteAttempt = {
  path: string
  outcome: CodeWriteOutcome
  reason?: string
}

export type CodeFixDetails = {
  command: string
  status: 'started' | 'succeeded' | 'failed'
  exitCode?: number
  outputExcerpt?: string
}

export type CodeExecutionDetails = {
  writeAttempts: CodeWriteAttempt[]
  changedFiles: string[]
  fix?: CodeFixDetails
}

export type CodeErrorType = StructuredWorkflowFailure['errorType'] | 'needs_context'

export type CodeResult =
  | { success: true; summaries: string[]; details?: CodeExecutionDetails }
  | {
      success: false
      reason: string
      summaries: string[]
      errorType?: CodeErrorType
      details?: CodeExecutionDetails
    }

function shouldCollectCodeExecutionDetails(options: Pick<CodeOptions, 'mode' | 'interactive'>): boolean {
  return options.mode === 'direct' && options.interactive === false
}

function findPendingWriteAttempt(details: CodeExecutionDetails, path: string): CodeWriteAttempt | undefined {
  for (let i = details.writeAttempts.length - 1; i >= 0; i--) {
    const attempt = details.writeAttempts[i]
    if (attempt.path === path && attempt.outcome === 'attempted') {
      return attempt
    }
  }
  return undefined
}

function addChangedFile(details: CodeExecutionDetails, path: string): void {
  if (!details.changedFiles.includes(path)) {
    details.changedFiles.push(path)
  }
}

function recordCodeExecutionEvent(details: CodeExecutionDetails, event: WorkflowProgressEvent): void {
  switch (event.kind) {
    case 'write-attempted':
      details.writeAttempts.push({ path: event.path, outcome: 'attempted' })
      break
    case 'write-finished': {
      const attempt = findPendingWriteAttempt(details, event.path)
      if (attempt) {
        attempt.outcome = 'completed'
      } else {
        details.writeAttempts.push({ path: event.path, outcome: 'completed' })
      }
      addChangedFile(details, event.path)
      break
    }
    case 'write-rejected': {
      const attempt = findPendingWriteAttempt(details, event.path)
      if (attempt) {
        attempt.outcome = 'rejected'
        attempt.reason = event.reason
      } else {
        details.writeAttempts.push({ path: event.path, outcome: 'rejected', reason: event.reason })
      }
      break
    }
    case 'fix-started':
      details.fix = { command: event.command, status: 'started' }
      break
    case 'fix-succeeded':
      details.fix = { command: event.command, status: 'succeeded', exitCode: 0 }
      break
    case 'fix-failed':
      details.fix = {
        command: event.command,
        status: 'failed',
        exitCode: event.exitCode,
        ...(event.outputExcerpt ? { outputExcerpt: event.outputExcerpt } : {}),
      }
      break
  }
}

/**
 * Plans and implements a feature or task using AI agents
 *
 * @param options - Code generation options
 * @returns Implementation result with summaries
 *
 * @example
 * ```typescript
 * // Implement a feature
 * const result = await code({
 *   task: 'Add OAuth2 login with Google'
 * })
 *
 * // With custom files
 * await code({
 *   task: 'Implement this design',
 *   files: [{ type: 'image', mediaType: 'image/png', image: 'base64...' }]
 * })
 * ```
 */
async function codeWithRunner(options: CodeOptions, executeWorkflow: WorkflowRunner): Promise<CodeResult> {
  const {
    task,
    files,
    mode,
    additionalInstructions,
    skipFix,
    fixCommand,
    allowedWritePaths,
    stateless,
    interactive,
    onUsage,
    onEvent,
    ...context
  } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: CodeWorkflowInput = {
    task,
    files,
    mode,
    additionalInstructions,
    skipFix,
    fixCommand,
    allowedWritePaths,
    stateless,
  }

  const details: CodeExecutionDetails | undefined = shouldCollectCodeExecutionDetails(options)
    ? { writeAttempts: [], changedFiles: [] }
    : undefined
  const progressCallback: WorkflowProgressCallback | undefined = details
    ? async (event) => {
        recordCodeExecutionEvent(details, event)
        await onEvent?.(event)
      }
    : onEvent

  const result = await executeWorkflow(codeWorkflow, workflowInput, {
    commandName: 'code',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent: progressCallback,
    errorResult: 'structured',
  })

  if (!details) {
    return result
  }

  return { ...result, details }
}

export async function code(options: CodeOptions): Promise<CodeResult> {
  return codeWithRunner(options, runWorkflow)
}

/**
 * Options for reviewCode function
 */
export interface ReviewCodeOptions extends BaseOptions {
  /**
   * Pull request number to review (if not provided, reviews local changes)
   */
  pr?: number

  /**
   * Git range to review (e.g., "HEAD~3..HEAD", "origin/main..HEAD")
   */
  range?: string

  /**
   * Specific files to review (if not provided, reviews all changes)
   */
  files?: string[]

  /**
   * Additional context for the review
   */
  context?: string

  /**
   * Whether to prompt for confirmations
   * @default true
   */
  interactive?: boolean
}

/**
 * Reviews code changes (PR or local)
 *
 * @param options - Review options
 * @returns Review result with overview and specific feedback
 *
 * @example
 * ```typescript
 * // Review local changes
 * const review = await reviewCode({})
 *
 * // Review specific PR
 * const review = await reviewCode({ pr: 123 })
 * ```
 */
async function reviewCodeWithRunner(options: ReviewCodeOptions = {}, executeWorkflow: WorkflowRunner): Promise<ReviewResult | undefined> {
  const { pr, range, files, context: reviewContext, interactive, onUsage, onEvent, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: ReviewWorkflowInput = {
    pr,
    range,
    files,
    context: reviewContext,
  }

  return executeWorkflow(reviewWorkflow, workflowInput, {
    commandName: 'review',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent,
  })
}

export async function reviewCode(options: ReviewCodeOptions = {}): Promise<ReviewResult | undefined> {
  return reviewCodeWithRunner(options, runWorkflow)
}

/**
 * Options for fix function
 */
export interface FixOptions extends BaseOptions {
  /**
   * Command to run to detect issues
   * @default Uses check and test scripts from config
   */
  command?: string

  /**
   * Task description for fixing
   */
  task?: string

  /**
   * Additional prompt for the agent
   */
  prompt?: string

  /**
   * Whether to prompt for confirmations
   * @default true
   */
  interactive?: boolean
}

/**
 * Fixes issues by running a command and letting AI fix errors
 *
 * @param options - Fix options
 * @returns Fix result with summaries
 *
 * @example
 * ```typescript
 * // Fix test failures
 * const result = await fix({
 *   command: 'npm test',
 *   task: 'Fix failing unit tests'
 * })
 *
 * // Use default check/test scripts from config
 * await fix({})
 * ```
 */
async function fixWithRunner(
  options: FixOptions = {},
  executeWorkflow: WorkflowRunner,
): Promise<{ success: boolean; summaries?: string[]; reason?: string } | undefined> {
  const { command, task, prompt, interactive, onUsage, onEvent, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: FixWorkflowInput = {
    command,
    task,
    prompt,
  }

  return executeWorkflow(fixWorkflow, workflowInput, {
    commandName: 'fix',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent,
  })
}

export async function fix(options: FixOptions = {}): Promise<{ success: boolean; summaries?: string[]; reason?: string } | undefined> {
  return fixWithRunner(options, runWorkflow)
}

/**
 * Options for task function
 */
export interface TaskOptions extends BaseOptions {
  /**
   * The task to perform
   */
  task: string

  /**
   * Whether to output JSON
   * @default false
   */
  jsonMode?: boolean

  /**
   * Whether to run in read-only mode (no file modifications or command execution)
   * @default false
   */
  readonly?: boolean

  /**
   * Custom system prompt to override the default
   */
  systemPrompt?: string

  /**
   * Whether to prompt for confirmations
   * @default true
   */
  interactive?: boolean
}

/**
 * Performs a generic task using an AI agent
 *
 * @param options - Task options
 * @returns Task completion result (ExitReason with agent output)
 *
 * @example
 * ```typescript
 * // Run a simple task
 * const result = await task({
 *   task: 'Refactor the auth module'
 * })
 *
 * // Non-interactive mode with JSON output
 * const result = await task({
 *   task: 'Update dependencies',
 *   jsonMode: true,
 *   interactive: false
 * })
 * ```
 */
async function taskWithRunner(options: TaskOptions, executeWorkflow: WorkflowRunner): Promise<ExitReason> {
  const { task: taskInput, jsonMode, readonly, systemPrompt, interactive, onUsage, onEvent, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: TaskWorkflowInput = {
    task: taskInput,
    jsonMode,
    readonly,
    systemPrompt,
  }

  return executeWorkflow(taskWorkflow, workflowInput, {
    commandName: 'task',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent,
    errorResult: 'exitReason',
  })
}

export async function task(options: TaskOptions): Promise<ExitReason> {
  return taskWithRunner(options, runWorkflow)
}

/**
 * Options for plan function
 */
export interface PlanOptions extends BaseOptions {
  /**
   * The task to plan
   */
  task?: string

  /**
   * Existing plan file content to update
   */
  fileContent?: string

  /**
   * Path to save/load the plan file
   */
  planFile?: string

  /**
   * Files to include as context
   */
  files?: Array<JsonFilePart | JsonImagePart>

  /**
   * Planning mode
   * @default 'interactive'
   */
  mode?: 'interactive' | 'confirm' | 'noninteractive'

  /**
   * Whether to prompt for confirmations
   * @default true
   */
  interactive?: boolean
}

/**
 * Creates or updates an implementation plan
 *
 * @param options - Planning options
 * @returns The generated plan and related files
 *
 * @example
 * ```typescript
 * // Create a new plan
 * const plan = await plan({
 *   task: 'Design and implement user dashboard'
 * })
 *
 * // Update existing plan
 * await plan({
 *   task: 'Add dark mode',
 *   fileContent: existingPlan,
 *   planFile: '.plans/dashboard.md'
 * })
 * ```
 */
async function planWithRunner(options: PlanOptions = {}, executeWorkflow: WorkflowRunner): Promise<PlanWorkflowOutput | undefined> {
  const { task, fileContent, planFile, files, mode, interactive, onUsage, onEvent, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: PlanWorkflowInput = {
    task,
    fileContent,
    filePath: planFile,
    files,
    mode,
  }

  return executeWorkflow(planWorkflow, workflowInput, {
    commandName: 'plan',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
    onEvent,
  })
}

export async function plan(options: PlanOptions = {}): Promise<PlanWorkflowOutput | undefined> {
  return planWithRunner(options, runWorkflow)
}

export type ScriptingApi = {
  commit(options?: CommitOptions): Promise<string | undefined>
  createPr(options?: CreatePrOptions): Promise<{ title: string; description: string } | undefined>
  code(options: CodeOptions): Promise<CodeResult>
  reviewCode(options?: ReviewCodeOptions): Promise<ReviewResult | undefined>
  fix(options?: FixOptions): Promise<{ success: boolean; summaries?: string[]; reason?: string } | undefined>
  task(options: TaskOptions): Promise<ExitReason>
  plan(options?: PlanOptions): Promise<PlanWorkflowOutput | undefined>
}

export function createScriptingApi(dependencies: ScriptingApiDependencies = {}): ScriptingApi {
  const executeWorkflow = dependencies.runWorkflow ?? runWorkflow

  return {
    commit: (options) => commitWithRunner(options, executeWorkflow),
    createPr: (options) => createPrWithRunner(options, executeWorkflow),
    code: (options) => codeWithRunner(options, executeWorkflow),
    reviewCode: (options) => reviewCodeWithRunner(options, executeWorkflow),
    fix: (options) => fixWithRunner(options, executeWorkflow),
    task: (options) => taskWithRunner(options, executeWorkflow),
    plan: (options) => planWithRunner(options, executeWorkflow),
  }
}

/**
 * Export ScriptContext for use in user scripts
 */
export type { ScriptContext }
