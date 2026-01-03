import type { Logger } from '@polka-codes/core'
import { TaskExecutionError } from './errors'
import type { AgentState, Task, WorkflowContext, WorkflowExecutionResult } from './types'
import { WorkflowAdapter } from './workflow-adapter'

/**
 * Executes tasks by invoking appropriate workflows
 *
 * Features:
 * - Timeout protection with AbortController
 * - Proper workflow cancellation on timeout
 * - Manual task cancellation support
 */
export class TaskExecutor {
  private abortControllers: Map<string, AbortController> = new Map()
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private context: WorkflowContext,
    private logger: Logger,
  ) {}

  /**
   * Execute a task with timeout protection
   *
   * Uses AbortController to properly cancel the workflow if timeout occurs
   */
  async execute(task: Task, state: AgentState): Promise<WorkflowExecutionResult> {
    this.logger.info(`[Executor] Executing task ${task.id}: ${task.title}`)

    // Get timeout from config
    const timeoutMs = state.config.resourceLimits.maxTaskExecutionTime * 60 * 1000

    try {
      // Execute with timeout and cancellation support
      const result = await this.executeTaskInternal(task, timeoutMs)

      this.logger.info(`[Executor] Task ${task.id} completed`)
      return result
    } catch (error) {
      // Enhanced error logging with context
      if (error instanceof TaskExecutionError) {
        this.logger.error(`\n${error.getFormattedMessage()}`)
      } else {
        this.logger.error(`[Executor] Task ${task.id} failed`, error as Error)
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Execute task with timeout wrapper and proper cancellation
   *
   * This implementation uses AbortController to properly cancel the workflow
   * when a timeout occurs or manual cancellation is requested.
   */
  private async executeTaskInternal(task: Task, timeoutMs: number): Promise<WorkflowExecutionResult> {
    // Create AbortController for this task
    const abortController = new AbortController()
    this.abortControllers.set(task.id, abortController)

    // Set up timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        // Abort the workflow before rejecting
        abortController.abort()
        reject(new TaskExecutionError(task.id, `Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.taskTimeouts.set(task.id, timeoutId)
    })

    try {
      // Race between workflow execution and timeout
      // The AbortSignal is passed through the workflow chain:
      // 1. TaskExecutor.invokeWorkflow() receives the signal
      // 2. WorkflowAdapter.invokeWorkflow() checks signal.aborted
      // 3. Context is wrapped with checkAbort() function
      // 4. Workflows can call context.checkAbort() periodically
      //
      // This ensures that when timeout occurs, the workflow will be
      // properly cancelled at the next checkpoint, not just abandoned.
      const result = await Promise.race([this.invokeWorkflow(task, abortController.signal), timeoutPromise])

      return result
    } finally {
      // Cleanup
      const timeoutId = this.taskTimeouts.get(task.id)
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.taskTimeouts.delete(task.id)
      }

      // Only abort if not already aborted
      if (!abortController.signal.aborted) {
        abortController.abort()
      }
      this.abortControllers.delete(task.id)
    }
  }

  /**
   * Invoke workflow for task with AbortSignal
   *
   * The AbortSignal is passed to the workflow adapter, which propagates
   * it through the workflow execution chain for proper cancellation support.
   */
  private async invokeWorkflow(task: Task, signal: AbortSignal): Promise<WorkflowExecutionResult> {
    try {
      // Check if already aborted before starting
      if (signal.aborted) {
        throw new TaskExecutionError(task.id, 'Task was cancelled before execution')
      }

      // Use workflow adapter to invoke appropriate workflow with abort signal
      const result = await WorkflowAdapter.invokeWorkflow(task.workflow, task.workflowInput, this.context, signal)

      return result
    } catch (error) {
      // Check if error is due to abort
      if (signal.aborted) {
        throw new TaskExecutionError(task.id, 'Task was cancelled')
      }

      throw new TaskExecutionError(
        task.id,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Cancel running task
   *
   * Aborts the task's workflow and clears its timeout
   */
  cancel(taskId: string): boolean {
    const abortController = this.abortControllers.get(taskId)
    const timeoutId = this.taskTimeouts.get(taskId)

    if (abortController) {
      // Abort the workflow
      abortController.abort()
      this.abortControllers.delete(taskId)

      // Clear the timeout
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.taskTimeouts.delete(taskId)
      }

      this.logger.info(`[Executor] Task ${taskId} cancelled`)
      return true
    }

    return false
  }

  /**
   * Cancel all tasks
   *
   * Aborts all running workflows and clears all timeouts
   */
  cancelAll(): void {
    this.logger.info(`[Executor] Cancelling all tasks (${this.abortControllers.size} running)`)

    // Abort all controllers
    for (const [, controller] of this.abortControllers) {
      controller.abort()
    }
    this.abortControllers.clear()

    // Clear all timeouts
    for (const timeoutId of this.taskTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.taskTimeouts.clear()
  }

  /**
   * Check if a task is currently running
   */
  isRunning(taskId: string): boolean {
    return this.abortControllers.has(taskId)
  }

  /**
   * Get number of currently running tasks
   */
  getRunningCount(): number {
    return this.abortControllers.size
  }
}
