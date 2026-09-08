import type { StepFn, StepOptions } from '@polka-codes/core'
import type { CliToolRegistry } from '../workflow-tools'
import type { BaseWorkflowInput } from '../workflows'
import type { CodeWorkflowInput } from '../workflows/code.workflow'
import type { CommitWorkflowInput } from '../workflows/commit.workflow'
import type { FixWorkflowInput } from '../workflows/fix.workflow'
import type { PlanWorkflowInput } from '../workflows/plan.workflow'
import type { ReviewWorkflowInput } from '../workflows/review.workflow'
import { WorkflowInvocationError } from './errors'
import type { CliWorkflowContext, ToolRegistry, WorkflowExecutionResult } from './types'

/**
 * Adapts existing workflow outputs to WorkflowExecutionResult format
 *
 * This layer bridges the gap between existing workflows (which have varying
 * return types) and the unified WorkflowExecutionResult format expected by
 * the agent orchestrator.
 */

/**
 * Adapt code workflow result
 */
export async function adaptCodeWorkflow(
  input: CodeWorkflowInput & BaseWorkflowInput,
  context: CliWorkflowContext<CliToolRegistry>,
): Promise<WorkflowExecutionResult> {
  try {
    // Dynamic import to avoid circular dependencies
    const { codeWorkflow } = await import('../workflows/code.workflow')

    const result = await codeWorkflow(input, context)

    if (result.success) {
      return {
        success: true,
        data: result,
        output: result.summaries.join('\n'),
      }
    } else {
      return {
        success: false,
        error: new Error(result.reason || 'Code workflow failed'),
      }
    }
  } catch (error) {
    throw new WorkflowInvocationError(
      'code',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    )
  }
}

/**
 * Adapt fix workflow result
 */
export async function adaptFixWorkflow(
  input: FixWorkflowInput & BaseWorkflowInput,
  context: CliWorkflowContext<CliToolRegistry>,
): Promise<WorkflowExecutionResult> {
  try {
    const { fixWorkflow } = await import('../workflows/fix.workflow')

    const result = await fixWorkflow(input, context)

    if (result.success) {
      return {
        success: true,
        data: result,
        output: result.summaries.join('\n') || 'Fix applied',
      }
    } else {
      return {
        success: false,
        error: new Error(result.reason || 'Fix workflow failed'),
      }
    }
  } catch (error) {
    throw new WorkflowInvocationError(
      'fix',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    )
  }
}

/**
 * Adapt plan workflow result
 */
export async function adaptPlanWorkflow(
  input: PlanWorkflowInput & BaseWorkflowInput,
  context: CliWorkflowContext<CliToolRegistry>,
): Promise<WorkflowExecutionResult> {
  try {
    const { planWorkflow } = await import('../workflows/plan.workflow')

    const result = await planWorkflow(input, context)

    if (!result) {
      return {
        success: false,
        error: new Error('Plan not approved'),
      }
    }

    return {
      success: true,
      data: result,
      output: result.plan || 'Plan created',
      filesModified: result.files.map((f) => f.path),
    }
  } catch (error) {
    throw new WorkflowInvocationError(
      'plan',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    )
  }
}

/**
 * Adapt review workflow result
 */
export async function adaptReviewWorkflow(
  input: ReviewWorkflowInput & BaseWorkflowInput,
  context: CliWorkflowContext<CliToolRegistry>,
): Promise<WorkflowExecutionResult> {
  try {
    const { reviewWorkflow } = await import('../workflows/review.workflow')

    const result = await reviewWorkflow(input, context)

    // Review workflow always returns successfully
    return {
      success: true,
      data: result,
      output: result.overview || 'Review complete',
    }
  } catch (error) {
    throw new WorkflowInvocationError(
      'review',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    )
  }
}

/**
 * Adapt commit workflow result
 */
export async function adaptCommitWorkflow(
  input: CommitWorkflowInput & BaseWorkflowInput,
  context: CliWorkflowContext<CliToolRegistry>,
): Promise<WorkflowExecutionResult> {
  try {
    const { commitWorkflow } = await import('../workflows/commit.workflow')

    const result = await commitWorkflow(input, context)

    // Commit workflow returns string | void
    if (typeof result === 'string') {
      return {
        success: true,
        data: result,
        output: `Committed: ${result}`,
      }
    } else {
      return {
        success: true,
        data: null,
        output: 'Commit workflow completed',
      }
    }
  } catch (error) {
    throw new WorkflowInvocationError(
      'commit',
      error instanceof Error ? error.message : String(error),
      error instanceof Error ? error : undefined,
    )
  }
}

function withCancellation<TTools extends ToolRegistry>(
  context: CliWorkflowContext<TTools>,
  signal: AbortSignal,
): CliWorkflowContext<TTools> {
  const step: StepFn = async <T>(name: string, ...args: [() => Promise<T>] | [StepOptions, () => Promise<T>]) => {
    signal.throwIfAborted()
    const run = args.length === 1 ? args[0] : args[1]
    const checked = async () => {
      signal.throwIfAborted()
      const result = await run()
      signal.throwIfAborted()
      return result
    }
    const result = args.length === 1 ? await context.step(name, checked) : await context.step(name, args[0], checked)
    signal.throwIfAborted()
    return result
  }
  const tools = new Proxy(context.tools, {
    get(target, name, receiver) {
      const tool: unknown = Reflect.get(target, name, receiver)
      if (typeof tool !== 'function') return tool
      return async (input: unknown) => {
        signal.throwIfAborted()
        const cancellable = name === 'generateText' || name === 'invokeTool' || name === 'executeCommand'
        const argument = cancellable && input !== null && typeof input === 'object' ? { ...input, signal } : input
        const result: unknown = await tool.call(target, argument)
        signal.throwIfAborted()
        return result
      }
    },
  })
  return { ...context, signal, step, tools }
}

/**
 * Generic workflow invoker
 * Routes to the appropriate adapter based on workflow name
 *
 * @param workflowName - The name of the workflow to invoke
 * @param input - Input data for the workflow
 * @param context - Workflow context (logger, tools, etc.)
 * @param signal - Optional AbortSignal for cancellation
 */
export async function invokeWorkflow<TTools extends ToolRegistry = CliToolRegistry>(
  workflowName: string,
  input: unknown,
  context: CliWorkflowContext<TTools>,
  signal?: AbortSignal,
): Promise<WorkflowExecutionResult> {
  signal?.throwIfAborted()
  const cancellation = signal && context.signal ? AbortSignal.any([signal, context.signal]) : (signal ?? context.signal)
  const wrappedContext = cancellation ? withCancellation(context, cancellation) : context

  // Cast input to proper workflow input type based on workflow name
  // The caller is responsible for passing the correct input structure
  const workflowInput = { ...context.workflowInput, ...(input as Record<string, unknown>) } as Record<string, unknown> & BaseWorkflowInput

  const cliContext = wrappedContext as CliWorkflowContext<CliToolRegistry>

  switch (workflowName) {
    case 'code':
      return adaptCodeWorkflow(workflowInput as CodeWorkflowInput & BaseWorkflowInput, cliContext)
    case 'fix':
      return adaptFixWorkflow(workflowInput as FixWorkflowInput & BaseWorkflowInput, cliContext)
    case 'plan':
      return adaptPlanWorkflow(workflowInput as PlanWorkflowInput & BaseWorkflowInput, cliContext)
    case 'review':
      return adaptReviewWorkflow(workflowInput as ReviewWorkflowInput & BaseWorkflowInput, cliContext)
    case 'commit':
      return adaptCommitWorkflow(workflowInput as CommitWorkflowInput & BaseWorkflowInput, cliContext)
    default:
      throw new WorkflowInvocationError(workflowName, `Unknown workflow: ${workflowName}`)
  }
}

/**
 * Execute workflow with timeout
 * Wraps workflow execution with timeout protection
 */
export async function invokeWorkflowWithTimeout<TTools extends ToolRegistry = CliToolRegistry>(
  workflowName: string,
  input: unknown,
  context: CliWorkflowContext<TTools>,
  timeoutMs: number,
): Promise<WorkflowExecutionResult> {
  const controller = new AbortController()
  const error = new Error(`Workflow ${workflowName} timed out after ${timeoutMs}ms`)
  const timeout = Promise.withResolvers<never>()
  const timer = setTimeout(() => {
    controller.abort(error)
    timeout.reject(error)
  }, timeoutMs)
  try {
    return await Promise.race([invokeWorkflow(workflowName, input, context, controller.signal), timeout.promise])
  } catch (failure) {
    if (controller.signal.aborted) return { success: false, error }
    throw failure
  } finally {
    clearTimeout(timer)
  }
}

/**
 * @deprecated Use invokeWorkflow instead
 */
export const WorkflowAdapter = {
  adaptCodeWorkflow,
  adaptFixWorkflow,
  adaptPlanWorkflow,
  adaptReviewWorkflow,
  adaptCommitWorkflow,
  invokeWorkflow,
  invokeWorkflowWithTimeout,
}
