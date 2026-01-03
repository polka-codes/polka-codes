import { WorkflowInvocationError } from './errors'
import type { WorkflowContext, WorkflowExecutionResult } from './types'

/**
 * Adapts existing workflow outputs to WorkflowExecutionResult format
 *
 * This layer bridges the gap between existing workflows (which have varying
 * return types) and the unified WorkflowExecutionResult format expected by
 * the agent orchestrator.
 */
export class WorkflowAdapter {
  /**
   * Adapt code workflow result
   */
  static async adaptCodeWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
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
  static async adaptFixWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
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
  static async adaptPlanWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
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
  static async adaptReviewWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
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
  static async adaptCommitWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
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

  /**
   * Adapt epic workflow result (if exists)
   */
  static async adaptEpicWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
    try {
      const { epicWorkflow } = await import('../workflows/epic.workflow')

      const _result = await epicWorkflow(input, context)

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
  static async invokeWorkflow(
    workflowName: string,
    input: unknown,
    context: WorkflowContext,
    signal?: AbortSignal,
  ): Promise<WorkflowExecutionResult> {
    // Check if operation was aborted before starting
    if (signal?.aborted) {
      throw new WorkflowInvocationError(workflowName, 'Workflow was cancelled before execution')
    }

    // Create a wrapped context that can check abort status
    const wrappedContext = signal
      ? {
          ...context,
          checkAbort: () => {
            if (signal.aborted) {
              throw new WorkflowInvocationError(workflowName, 'Workflow was cancelled')
            }
          },
        }
      : context

    switch (workflowName) {
      case 'code':
        return WorkflowAdapter.adaptCodeWorkflow(input, wrappedContext)
      case 'fix':
        return WorkflowAdapter.adaptFixWorkflow(input, wrappedContext)
      case 'plan':
        return WorkflowAdapter.adaptPlanWorkflow(input, wrappedContext)
      case 'review':
        return WorkflowAdapter.adaptReviewWorkflow(input, wrappedContext)
      case 'commit':
        return WorkflowAdapter.adaptCommitWorkflow(input, wrappedContext)
      case 'epic':
        return WorkflowAdapter.adaptEpicWorkflow(input, wrappedContext)
      default:
        throw new WorkflowInvocationError(workflowName, `Unknown workflow: ${workflowName}`)
    }
  }

  /**
   * Execute workflow with timeout
   * Wraps workflow execution with timeout protection
   */
  static async invokeWorkflowWithTimeout(
    workflowName: string,
    input: any,
    context: any,
    timeoutMs: number,
  ): Promise<WorkflowExecutionResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Workflow ${workflowName} timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      return await Promise.race([WorkflowAdapter.invokeWorkflow(workflowName, input, context), timeoutPromise])
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
}
