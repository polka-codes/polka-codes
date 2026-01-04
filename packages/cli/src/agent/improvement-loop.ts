import { TaskExecutor } from './executor'
import { createTaskPlanner } from './planner'
import type { AgentStateManager } from './state-manager'
import { createTaskDiscoveryEngine } from './task-discovery'
import { TaskPrioritizer } from './task-prioritizer'
import type { Plan, Task, WorkflowContext } from './types'

/**
 * Continuous improvement loop state
 */
interface ContinuousImprovementLoopState {
  discovery: any
  planner: any
  executor: TaskExecutor
  prioritizer: TaskPrioritizer
  running: boolean
  iterationCount: number
}

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
export interface ContinuousImprovementLoop {
  start(): Promise<void>
  stop(): Promise<void>
  getIterationCount(): number
  isRunning(): boolean
}

export function createContinuousImprovementLoop(
  context: WorkflowContext,
  stateManager: AgentStateManager,
  _sessionId: string,
): ContinuousImprovementLoop {
  const state: ContinuousImprovementLoopState = {
    discovery: createTaskDiscoveryEngine(context),
    planner: createTaskPlanner(context),
    executor: new TaskExecutor(context, context.logger),
    prioritizer: new TaskPrioritizer(),
    running: false,
    iterationCount: 0,
  }

  /**
   * Execute a plan phase by phase
   */
  async function executePlan(plan: Plan): Promise<void> {
    context.logger.info(`[Continuous] Executing plan: ${plan.highLevelPlan}`)

    let completedTasks = 0

    // Add all tasks to the queue first
    await stateManager.updateState({
      taskQueue: plan.tasks,
    })

    // Execute each phase
    for (let i = 0; i < plan.executionOrder.length; i++) {
      const phase = plan.executionOrder[i]

      context.logger.info(`[Continuous] Phase ${i + 1}/${plan.executionOrder.length} (${phase.length} task(s))`)

      // Execute tasks in phase (could be parallel in future)
      for (const taskId of phase) {
        if (!state.running) {
          context.logger.info('[Continuous] Stopping mid-phase')
          return
        }

        const task = plan.tasks.find((t: Task) => t.id === taskId)
        if (!task) {
          context.logger.warn(`[Continuous] Task not found: ${taskId}`)
          continue
        }

        try {
          // Get current state
          const currentState = await stateManager.getState()

          if (!currentState) {
            context.logger.error('[Continuous] State is null')
            continue
          }

          // Execute task
          const result = await state.executor.execute(task, currentState)

          if (result.success) {
            context.logger.info(`[Continuous] ✅ ${task.title}`)

            // Move task from queue to completed
            await stateManager.moveTask(task.id, 'queue', 'completed')

            // Record success for prioritization learning
            state.prioritizer.recordExecution(task.id, true)

            // Record file changes
            for (const file of task.files) {
              state.prioritizer.recordFileChange(file)
            }

            completedTasks++
          } else {
            context.logger.error(`[Continuous] ❌ ${task.title}`, result.error)

            // Move task from queue to failed
            await stateManager.moveTask(task.id, 'queue', 'failed')

            // Record failure for prioritization learning
            state.prioritizer.recordExecution(task.id, false)
          }
        } catch (error) {
          context.logger.error(`[Continuous] ❌ ${task.title}`, error as Error)

          // Move task from queue to failed
          await stateManager.moveTask(task.id, 'queue', 'failed')
        }
      }
    }

    context.logger.info(`[Continuous] Plan execution complete: ${completedTasks}/${plan.tasks.length} task(s) succeeded`)
  }

  /**
   * Single iteration of continuous improvement
   */
  async function iteration(): Promise<void> {
    state.iterationCount++
    context.logger.info(`[Continuous] Iteration #${state.iterationCount}`)

    try {
      // 1. Discover tasks
      const tasks = await state.discovery.discover({ useCache: true })

      if (tasks.length === 0) {
        context.logger.info('[Continuous] No tasks discovered')

        // CRITICAL v2.1: Don't exit, increase backoff and continue
        state.discovery.increaseBackoff()
        return
      }

      // Tasks found - reset backoff
      state.discovery.resetBackoff()

      context.logger.info(`[Continuous] Discovered ${tasks.length} task(s)`)

      // 2. Prioritize tasks dynamically
      const prioritizedTasks = state.prioritizer.prioritizeTasks(tasks, tasks)

      context.logger.info(`[Continuous] Prioritized ${prioritizedTasks.length} task(s)`)

      // Log high priority tasks
      const highPriority = state.prioritizer.getCriticalTasks(prioritizedTasks)
      if (highPriority.length > 0) {
        context.logger.info(`[Continuous] Critical tasks: ${highPriority.map((t) => t.title).join(', ')}`)
      }

      // 3. Create plan
      const plan = state.planner.createPlan('Continuous improvement', prioritizedTasks)

      context.logger.info(`[Continuous] Plan created with ${plan.executionOrder.length} phase(s)`)

      // 3. Execute plan
      await executePlan(plan)

      context.logger.info(`[Continuous] Iteration #${state.iterationCount} complete`)
    } catch (error) {
      context.logger.error('[Continuous] Iteration failed', error as Error)

      // Continue running even on error (with backoff)
      state.discovery.increaseBackoff()
    }
  }

  /**
   * Wait between iterations with exponential backoff
   */
  async function waitBetweenIterations(): Promise<void> {
    const seconds = state.discovery.getBackoffSeconds()

    context.logger.info(`[Continuous] Waiting ${seconds}s before next iteration...`)

    // Wait in 1-second increments to check for interrupts
    for (let i = 0; i < seconds; i++) {
      if (!state.running) {
        context.logger.info('[Continuous] Wait interrupted')
        return
      }

      await new Promise((resolve) => setTimeout(resolve, 1000))
    }
  }

  return {
    /**
     * Start continuous improvement loop
     */
    async start(): Promise<void> {
      if (state.running) {
        throw new Error('Loop already running')
      }

      state.running = true
      state.iterationCount = 0

      context.logger.info('[Continuous] Starting continuous improvement loop...')
      context.logger.info('[Continuous] Press Ctrl+C to stop')

      // Main loop
      while (state.running) {
        await iteration()

        // Check if should stop
        if (!state.running) {
          break
        }

        // Wait before next iteration (with exponential backoff)
        await waitBetweenIterations()
      }

      context.logger.info('[Continuous] Loop stopped')
    },

    /**
     * Stop the loop
     */
    async stop(): Promise<void> {
      context.logger.info('[Continuous] Stopping loop...')
      state.running = false
      state.executor.cancelAll()
    },

    /**
     * Get iteration count
     */
    getIterationCount(): number {
      return state.iterationCount
    },

    /**
     * Check if currently running
     */
    isRunning(): boolean {
      return state.running
    },
  }
}
