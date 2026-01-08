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

import type { UsageMeter } from '@polka-codes/core'
import { createLogger } from './logger'
import type { ExecutionContext } from './runWorkflow'
import { runWorkflow } from './runWorkflow'
import type { ScriptContext } from './script/runner'
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
} from './workflows'

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
}

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
export async function commit(options: CommitOptions = {}): Promise<string | undefined> {
  const { all, files, context: messageContext, interactive, onUsage, ...context } = options

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
  const result = await runWorkflow(commitWorkflow, workflowInput, {
    commandName: 'commit',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
  })

  // Handle both string and void returns
  return result ?? undefined
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
export async function createPr(options: CreatePrOptions = {}): Promise<{ title: string; description: string } | undefined> {
  const { context: prContext, interactive, onUsage, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: PrWorkflowInput = {
    ...(prContext && { context: prContext }),
  }

  return runWorkflow(prWorkflow, workflowInput, {
    commandName: 'pr',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
  })
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
  mode?: 'interactive' | 'noninteractive'

  /**
   * Additional instructions for the AI agent
   */
  additionalInstructions?: string

  /**
   * Whether to prompt for confirmations
   * @default true
   */
  interactive?: boolean
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
export async function code(options: CodeOptions): Promise<{ success: boolean; summaries?: string[]; reason?: string } | undefined> {
  const { task, files, mode, additionalInstructions, interactive, onUsage, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: CodeWorkflowInput = {
    task,
    files,
    mode,
    additionalInstructions,
  }

  return runWorkflow(codeWorkflow, workflowInput, {
    commandName: 'code',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
  })
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
export async function reviewCode(options: ReviewCodeOptions = {}): Promise<ReviewResult | undefined> {
  const { pr, range, files, context: reviewContext, interactive, onUsage, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: ReviewWorkflowInput = {
    pr,
    range,
    files,
    context: reviewContext,
  }

  return runWorkflow(reviewWorkflow, workflowInput, {
    commandName: 'review',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
  })
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
export async function fix(options: FixOptions = {}): Promise<{ success: boolean; summaries?: string[]; reason?: string } | undefined> {
  const { command, task, prompt, interactive, onUsage, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: FixWorkflowInput = {
    command,
    task,
    prompt,
  }

  return runWorkflow(fixWorkflow, workflowInput, {
    commandName: 'fix',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
  })
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
export async function plan(options: PlanOptions = {}): Promise<PlanWorkflowOutput | undefined> {
  const { task, fileContent, planFile, files, mode, interactive, onUsage, ...context } = options

  const verbose = context.silent ? -1 : (context.verbose ?? 0)
  const logger = createLogger({ verbose })

  const workflowInput: PlanWorkflowInput = {
    task,
    fileContent,
    filePath: planFile,
    files,
    mode,
  }

  return runWorkflow(planWorkflow, workflowInput, {
    commandName: 'plan',
    context,
    logger,
    interactive: interactive !== false,
    onUsageMeterCreated: onUsage,
  })
}

/**
 * Export ScriptContext for use in user scripts
 */
export type { ScriptContext }
