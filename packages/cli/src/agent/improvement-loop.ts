import { TaskExecutor } from './executor'
import { TaskPlanner } from './planner'
import type { AgentStateManager } from './state-manager'
import { TaskDiscoveryEngine } from './task-discovery'
import type { Plan, WorkflowContext } from './types'

/**
 * Continuous improvement loop
 *
 * Runs autonomously to:
 * 1. Discover issues in codebase
 * 2. Create execution plan
 * 3. Execute tasks
 * 4. Wait with exponential backoff
 * 5. Repeat until interrupted
 *
 * CRITICAL v2.1 fix: Does NOT exit when no tasks found
 */
export class ContinuousImprovementLoop {
  private discovery: TaskDiscoveryEngine
  private planner: TaskPlanner
  private executor: TaskExecutor
  private running: boolean = false
  private iterationCount: number = 0

  constructor(
    private context: WorkflowContext,
    private stateManager: AgentStateManager,
    _sessionId: string,
  ) {
    this.discovery = new TaskDiscoveryEngine(context)
    this.planner = new TaskPlanner(context)
    this.executor = new TaskExecutor(context, context.logger)
  }

  /**
   * Start continuous improvement loop
   */
  async start(): Promise<void> {
    if (this.running) {
      throw new Error('Loop already running')
    }

    this.running = true
    this.iterationCount = 0

    this.context.logger.info('[Continuous] Starting continuous improvement loop...')
    this.context.logger.info('[Continuous] Press Ctrl+C to stop')

    // Main loop
    while (this.running) {
      await this.iteration()

      // Check if should stop
      if (!this.running) {
        break
      }

      // Wait before next iteration (with exponential backoff)
      await this.waitBetweenIterations()
    }

    this.context.logger.info('[Continuous] Loop stopped')
  }

  /**
   * Stop the loop
   */
  async stop(): Promise<void> {
    this.context.logger.info('[Continuous] Stopping loop...')
    this.running = false
    this.executor.cancelAll()
  }

  /**
   * Single iteration of continuous improvement
   */
  private async iteration(): Promise<void> {
    this.iterationCount++
    this.context.logger.info(`[Continuous] Iteration #${this.iterationCount}`)

    try {
      // 1. Discover tasks
      const tasks = await this.discovery.discover({ useCache: true })

      if (tasks.length === 0) {
        this.context.logger.info('[Continuous] No tasks discovered')

        // CRITICAL v2.1: Don't exit, increase backoff and continue
        this.discovery.increaseBackoff()
        return
      }

      // Tasks found - reset backoff
      this.discovery.resetBackoff()

      this.context.logger.info(`[Continuous] Discovered ${tasks.length} task(s)`)

      // 2. Create plan
      const plan = this.planner.createPlan('Continuous improvement', tasks)

      this.context.logger.info(`[Continuous] Plan created with ${plan.executionOrder.length} phase(s)`)

      // 3. Execute plan
      await this.executePlan(plan)

      this.context.logger.info(`[Continuous] Iteration #${this.iterationCount} complete`)
    } catch (error) {
      this.context.logger.error('[Continuous] Iteration failed', error as Error)

      // Continue running even on error (with backoff)
      this.discovery.increaseBackoff()
    }
  }

  /**
   * Execute a plan phase by phase
   */
  private async executePlan(plan: Plan): Promise<void> {
    this.context.logger.info(`[Continuous] Executing plan: ${plan.highLevelPlan}`)

    let completedTasks = 0

    // Add all tasks to the queue first
    await this.stateManager.updateState({
      taskQueue: plan.tasks,
    })

    // Execute each phase
    for (let i = 0; i < plan.executionOrder.length; i++) {
      const phase = plan.executionOrder[i]

      this.context.logger.info(`[Continuous] Phase ${i + 1}/${plan.executionOrder.length} (${phase.length} task(s))`)

      // Execute tasks in phase (could be parallel in future)
      for (const taskId of phase) {
        if (!this.running) {
          this.context.logger.info('[Continuous] Stopping mid-phase')
          return
        }

        const task = plan.tasks.find((t) => t.id === taskId)
        if (!task) {
          this.context.logger.warn(`[Continuous] Task not found: ${taskId}`)
          continue
        }

        try {
          // Get current state
          const state = await this.stateManager.getState()

          // Execute task
          const result = await this.executor.execute(task, state)

          if (result.success) {
            this.context.logger.info(`[Continuous] ✅ ${task.title}`)

            // Move task from queue to completed
            await this.stateManager.moveTask(task.id, 'queue', 'completed')

            completedTasks++
          } else {
            this.context.logger.error(`[Continuous] ❌ ${task.title}`, result.error)

            // Move task from queue to failed
            await this.stateManager.moveTask(task.id, 'queue', 'failed')
          }
        } catch (error) {
          this.context.logger.error(`[Continuous] ❌ ${task.title}`, error as Error)

          // Move task from queue to failed
          await this.stateManager.moveTask(task.id, 'queue', 'failed')
        }
      }
    }

    this.context.logger.info(`[Continuous] Plan execution complete: ${completedTasks}/${plan.tasks.length} task(s) succeeded`)
  }

  /**
   * Wait between iterations with exponential backoff
   */
  private async waitBetweenIterations(): Promise<void> {
    const seconds = this.discovery.getBackoffSeconds()

    this.context.logger.info(`[Continuous] Waiting ${seconds}s before next iteration...`)

    // Wait in 1-second increments to check for interrupts
    for (let i = 0; i < seconds; i++) {
      if (!this.running) {
        this.context.logger.info('[Continuous] Wait interrupted')
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  /**
   * Get iteration count
   */
  getIterationCount(): number {
    return this.iterationCount
  }

  /**
   * Check if currently running
   */
  isRunning(): boolean {
    return this.running
  }
}
