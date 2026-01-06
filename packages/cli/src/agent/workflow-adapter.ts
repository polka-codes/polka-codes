import { WorkflowInvocationError } from './errors'
import type { ToolRegistry, WorkflowContext, WorkflowExecutionResult } from './types'

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
export async function adaptCodeWorkflow<TTools extends ToolRegistry = ToolRegistry>(
  input: Record<string, unknown>,
  context: WorkflowContext<TTools>,
): Promise<WorkflowExecutionResult> {
  try {
    // Dynamic import to avoid circular dependencies
    const { codeWorkflow } = await import('../workflows/code.workflow')

    const result = await codeWorkflow(input as any, context as any)

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
export async function adaptFixWorkflow<TTools extends ToolRegistry = ToolRegistry>(
  input: Record<string, unknown>,
  context: WorkflowContext<TTools>,
): Promise<WorkflowExecutionResult> {
  try {
    const { fixWorkflow } = await import('../workflows/fix.workflow')

    const result = await fixWorkflow(input as any, context as any)

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
export async function adaptPlanWorkflow<TTools extends ToolRegistry = ToolRegistry>(
  input: Record<string, unknown>,
  context: WorkflowContext<TTools>,
): Promise<WorkflowExecutionResult> {
  try {
    const { planWorkflow } = await import('../workflows/plan.workflow')

    const result = await planWorkflow(input as any, context as any)

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
export async function adaptReviewWorkflow<TTools extends ToolRegistry = ToolRegistry>(
  input: Record<string, unknown>,
  context: WorkflowContext<TTools>,
): Promise<WorkflowExecutionResult> {
  try {
    const { reviewWorkflow } = await import('../workflows/review.workflow')

    const result = await reviewWorkflow(input as any, context as any)

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
export async function adaptCommitWorkflow<TTools extends ToolRegistry = ToolRegistry>(
  input: Record<string, unknown>,
  context: WorkflowContext<TTools>,
): Promise<WorkflowExecutionResult> {
  try {
    const { commitWorkflow } = await import('../workflows/commit.workflow')

    const result = await commitWorkflow(input as any, context as any)

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

/**
 * Adapt epic workflow result (if exists)
 */
export async function adaptEpicWorkflow<TTools extends ToolRegistry = ToolRegistry>(
  input: Record<string, unknown>,
  context: WorkflowContext<TTools>,
): Promise<WorkflowExecutionResult> {
  try {
    const { epicWorkflow } = await import('../workflows/epic.workflow')

    const _result = await epicWorkflow(input as any, context as any)

    // Epic workflow returns void
    return {
      success: true,
      data: null,
      output: 'Epic workflow completed',
    }
  } catch (error) {
    // Epic workflow might not exist
    throw new WorkflowInvocationError('epic', 'Epic workflow not available', error instanceof Error ? error : undefined)
  }
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
export async function invokeWorkflow(
  workflowName: string,
  input: unknown,
  context: WorkflowContext,
  signal?: AbortSignal,
): Promise<WorkflowExecutionResult> {
  // Check if operation was aborted before starting
  if (signal?.aborted) {
    const abortReason = signal.reason ? String(signal.reason) : 'Workflow was cancelled before execution'
    throw new WorkflowInvocationError(workflowName, abortReason)
  }

  // Create a wrapped context that can check abort status
  const wrappedContext = signal
    ? {
        ...context,
        checkAbort: () => {
          if (signal.aborted) {
            const reason = signal.reason ? String(signal.reason) : 'Workflow was cancelled'
            throw new WorkflowInvocationError(workflowName, reason)
          }
        },
      }
    : context

  // Cast input to Record<string, unknown> for compatibility
  const workflowInput = input as Record<string, unknown>

  switch (workflowName) {
    case 'code':
      return adaptCodeWorkflow(workflowInput, wrappedContext)
    case 'fix':
      return adaptFixWorkflow(workflowInput, wrappedContext)
    case 'plan':
      return adaptPlanWorkflow(workflowInput, wrappedContext)
    case 'review':
      return adaptReviewWorkflow(workflowInput, wrappedContext)
    case 'commit':
      return adaptCommitWorkflow(workflowInput, wrappedContext)
    case 'epic':
      return adaptEpicWorkflow(workflowInput, wrappedContext)
    default:
      throw new WorkflowInvocationError(workflowName, `Unknown workflow: ${workflowName}`)
  }
}

/**
 * Execute workflow with timeout
 * Wraps workflow execution with timeout protection
 */
export async function invokeWorkflowWithTimeout(
  workflowName: string,
  input: unknown,
  context: WorkflowContext,
  timeoutMs: number,
): Promise<WorkflowExecutionResult> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Workflow ${workflowName} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([invokeWorkflow(workflowName, input as Record<string, unknown>, context), timeoutPromise])
  } catch (error) {
    if (error instanceof Error && error.message.includes('timed out')) {
      return {
        success: false,
        error,
      }
    }
    throw error
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
  adaptEpicWorkflow,
  invokeWorkflow,
  invokeWorkflowWithTimeout,
}
