import { type Logger, makeStepFn } from '@polka-codes/core'
import type { CliToolRegistry } from '../workflow-tools'
import { TaskExecutionError } from './errors'
import type { AgentState, CliWorkflowContext, Task, ToolRegistry, WorkflowExecutionResult } from './types'
import { invokeWorkflow } from './workflow-adapter'

/**
 * Executes tasks by invoking appropriate workflows
 *
 * Features:
 * - Timeout protection with AbortController
 * - Proper workflow cancellation on timeout
 * - Manual task cancellation support
 */
export class TaskExecutor<TTools extends ToolRegistry = CliToolRegistry> {
  #abortControllers: Map<string, AbortController> = new Map()
  #context: CliWorkflowContext<TTools>
  #logger: Logger
  #defaultTimeoutMs: number

  constructor(
    context: CliWorkflowContext<TTools>,
    logger: Logger,
    defaultTimeoutMs: number = 60 * 60 * 1000, // 60 minutes default
  ) {
    this.#context = context
    this.#logger = logger
    this.#defaultTimeoutMs = defaultTimeoutMs
  }

  /**
   * Execute a task with timeout protection
   *
   * Uses AbortController to properly cancel the workflow if timeout occurs
   */
  async execute(task: Task, _state?: AgentState, timeoutMs?: number): Promise<WorkflowExecutionResult> {
    this.#logger.info(`[Executor] Executing task ${task.id}: ${task.title}`)

    // Use provided timeout or default
    const effectiveTimeout = timeoutMs ?? this.#defaultTimeoutMs

    try {
      // Execute with timeout and cancellation support
      const result = await this.#executeTask(task, effectiveTimeout)

      this.#logger.info(`[Executor] Task ${task.id} completed`)
      return result
    } catch (error) {
      // Enhanced error logging with context
      if (error instanceof TaskExecutionError) {
        this.#logger.error(`\n${error.getFormattedMessage()}`)
      } else {
        this.#logger.error(`[Executor] Task ${task.id} failed`, error as Error)
      }

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  async #executeTask(task: Task, timeoutMs: number): Promise<WorkflowExecutionResult> {
    if (this.#abortControllers.has(task.id)) throw new TaskExecutionError(task.id, 'Task is already running')
    const controller = new AbortController()
    this.#abortControllers.set(task.id, controller)
    const { signal } = controller
    const cancelled = Promise.withResolvers<never>()
    const onAbort = () => cancelled.reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
    const timer = setTimeout(() => controller.abort(new TaskExecutionError(task.id, `Task timed out after ${timeoutMs}ms`)), timeoutMs)
    try {
      const result = await Promise.race([
        invokeWorkflow(task.workflow, task.workflowInput, { ...this.#context, step: makeStepFn() }, signal),
        cancelled.promise,
      ])
      signal.throwIfAborted()
      return result
    } finally {
      clearTimeout(timer)
      signal.removeEventListener('abort', onAbort)
      this.#abortControllers.delete(task.id)
    }
  }

  cancel(taskId: string): boolean {
    const controller = this.#abortControllers.get(taskId)
    if (!controller || controller.signal.aborted) return false
    controller.abort(new TaskExecutionError(taskId, 'Task cancelled manually'))
    this.#logger.info(`[Executor] Task ${taskId} cancelled`)
    return true
  }

  cancelAll(): void {
    for (const taskId of this.#abortControllers.keys()) this.cancel(taskId)
  }

  /**
   * Check if a task is currently running
   */
  isRunning(taskId: string): boolean {
    return this.#abortControllers.get(taskId)?.signal.aborted === false
  }

  /**
   * Get number of currently running tasks
   */
  getRunningCount(): number {
    return [...this.#abortControllers.values()].filter((controller) => !controller.signal.aborted).length
  }
}
