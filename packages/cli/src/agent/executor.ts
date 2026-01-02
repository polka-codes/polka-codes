import { TaskExecutionError } from './errors'
import type { AgentState, Task, WorkflowExecutionResult } from './types'
import { WorkflowAdapter } from './workflow-adapter'

/**
 * Executes tasks by invoking appropriate workflows
 */
export class TaskExecutor {
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private context: any,
    private logger: any,
  ) {}

  /**
   * Execute a task with timeout protection
   */
  async execute(task: Task, state: AgentState): Promise<WorkflowExecutionResult> {
    this.logger.info(`[Executor] Executing task ${task.id}: ${task.title}`)

    // Get timeout from config
    const timeoutMs = state.config.resourceLimits.maxTaskExecutionTime * 60 * 1000

    try {
      // Execute with timeout
      const result = await this.executeTaskInternal(task, timeoutMs)

      this.logger.info(`[Executor] Task ${task.id} completed`)
      return result
    } catch (error) {
      this.logger.error(`[Executor] Task ${task.id} failed`, error as Error)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  }

  /**
   * Execute task with timeout wrapper
   */
  private async executeTaskInternal(task: Task, timeoutMs: number): Promise<WorkflowExecutionResult> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TaskExecutionError(task.id, `Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.taskTimeouts.set(task.id, timeoutId)
    })

    try {
      const result = (await Promise.race([this.invokeWorkflow(task), timeoutPromise])) as Promise<WorkflowExecutionResult>

      return result
    } finally {
      const timeoutId = this.taskTimeouts.get(task.id)
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.taskTimeouts.delete(task.id)
      }
    }
  }

  /**
   * Invoke workflow for task
   */
  private async invokeWorkflow(task: Task): Promise<WorkflowExecutionResult> {
    try {
      // Use workflow adapter to invoke appropriate workflow
      const result = await WorkflowAdapter.invokeWorkflow(task.workflow, task.workflowInput, this.context)

      return result
    } catch (error) {
      throw new TaskExecutionError(
        task.id,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined,
      )
    }
  }

  /**
   * Cancel running task
   */
  cancel(taskId: string): boolean {
    const timeoutId = this.taskTimeouts.get(taskId)
    if (timeoutId) {
      clearTimeout(timeoutId)
      this.taskTimeouts.delete(taskId)
      return true
    }
    return false
  }

  /**
   * Cancel all tasks
   */
  cancelAll(): void {
    for (const timeoutId of this.taskTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.taskTimeouts.clear()
  }
}
