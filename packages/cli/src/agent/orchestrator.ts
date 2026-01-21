import * as path from 'node:path'
import type { Logger } from '@polka-codes/core'
import { ulid } from 'ulid'
import { AgentStatusError, SafetyViolationError } from './errors'
import { TaskExecutor } from './executor'
import { GoalDecomposer } from './goal-decomposer'
import { createContinuousImprovementLoop } from './improvement-loop'
import { MetricsCollector } from './metrics'
import { createTaskPlanner } from './planner'
import { ApprovalManager } from './safety/approval'
import { SafetyChecker } from './safety/checks'
import { InterruptHandler } from './safety/interrupt'
import { acquire, release } from './session'
import { AgentStateManager } from './state-manager'
import { TaskHistory } from './task-history'
import type { AgentConfig, AgentState, Plan, Task, WorkflowContext } from './types'
import { WorkingSpace } from './working-space'

/**
 * Main autonomous agent orchestrator
 *
 * Coordinates all agent components to:
 * - Accept high-level goals
 * - Decompose into executable tasks
 * - Execute tasks safely with approvals
 * - Manage state
 * - Handle continuous improvement mode
 * - Manage working directory for plans and tasks
 *
 * Two modes:
 * - Goal-directed: User provides a goal to achieve
 * - Continuous: Auto-discovers and fixes issues
 *
 * Optional working directory mode:
 * - Uses a user-specified directory for plans and task documentation
 * - Discovers tasks from working directory
 * - Documents completed tasks in working directory
 */
export class AutonomousAgent {
  private stateManager: AgentStateManager
  private taskHistory: TaskHistory
  private logger: Logger
  private metrics: MetricsCollector
  private approvalManager: ApprovalManager
  private safetyChecker: SafetyChecker
  private interruptHandler: InterruptHandler
  private goalDecomposer: GoalDecomposer
  private taskPlanner: ReturnType<typeof createTaskPlanner>
  private taskExecutor: TaskExecutor
  private improvementLoop?: ReturnType<typeof createContinuousImprovementLoop>
  private workingSpace?: WorkingSpace

  private initialized: boolean = false
  private sessionId: string

  constructor(
    private config: AgentConfig,
    private context: WorkflowContext,
  ) {
    this.sessionId = this.generateSessionId()

    // Determine state directory
    const stateDir = config.stateDir || path.join(process.cwd(), '.polka', 'agent-state')

    // Initialize all components with correct constructor arguments
    this.stateManager = new AgentStateManager(stateDir, this.sessionId)
    this.taskHistory = new TaskHistory(stateDir)
    this.logger = context.logger
    this.metrics = new MetricsCollector()
    this.approvalManager = new ApprovalManager(
      this.logger,
      config.approval.level,
      config.approval.autoApproveSafeTasks,
      config.approval.maxAutoApprovalCost,
      config.destructiveOperations,
    )
    this.safetyChecker = new SafetyChecker(this.logger, context.tools)
    this.interruptHandler = new InterruptHandler(this.logger, this)
    this.goalDecomposer = new GoalDecomposer(context)
    this.taskPlanner = createTaskPlanner(context)
    this.taskExecutor = new TaskExecutor(context, context.logger)

    // Initialize working space if configured
    if (config.workingDir) {
      this.workingSpace = new WorkingSpace(config.workingDir, context.logger)
    }
  }

  /**
   * Initialize agent (acquire session, start monitors)
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      throw new AgentStatusError('Agent already initialized')
    }

    this.logger.info('='.repeat(60))
    this.logger.info('🤖 Polka Codes Autonomous Agent')
    this.logger.info('='.repeat(60))
    this.logger.info('')

    try {
      // 1. Acquire session
      this.logger.info(`[Init] Acquiring session: ${this.sessionId}`)

      const acquireResult = await acquire(this.sessionId)

      if (!acquireResult.acquired) {
        throw new AgentStatusError(`Session conflict: ${this.sessionId} - ${acquireResult.reason}`)
      }

      this.logger.info('[Init] ✅ Session acquired')

      // 2. Initialize state
      this.logger.info('[Init] Initializing state...')

      const initialState = await this.stateManager.initialize(this.config)

      this.logger.info(`[Init] ✅ State initialized: ${initialState.currentMode}`)

      // 3. Initialize working space if configured
      if (this.workingSpace) {
        this.logger.info('[Init] Initializing working space...')
        await this.workingSpace.initialize()
        this.logger.info(`[Init] ✅ Working space ready: ${this.config.workingDir}`)

        const stats = await this.workingSpace.getStats()
        this.logger.info(
          `[Init] Working space stats: ${stats.planCount} plans, ${stats.pendingTaskCount} pending tasks, ${stats.completedTaskCount} completed tasks`,
        )
      }

      // 4. Log configuration
      this.logger.info('[Init] Configuration:')
      this.logger.info(`  - Strategy: ${this.config.strategy}`)
      this.logger.info(`  - Approval level: ${this.config.approval.level}`)
      if (this.config.workingDir) {
        this.logger.info(`  - Working directory: ${this.config.workingDir}`)
      }
      this.logger.info('')

      this.initialized = true

      this.logger.info('✅ Agent initialized successfully')
      this.logger.info('')
    } catch (error) {
      this.logger.error('[Init] Initialization failed', error as Error)

      // Cleanup on failure
      await this.cleanup()

      throw error
    }
  }

  /**
   * Set goal for goal-directed mode
   */
  async setGoal(goal: string): Promise<void> {
    if (!this.initialized) {
      throw new AgentStatusError('Agent not initialized')
    }

    const state = await this.stateManager.getState()

    if (!state) {
      throw new AgentStatusError('State is null')
    }

    if (state.currentMode !== 'idle') {
      throw new AgentStatusError(`Cannot set goal while agent is ${state.currentMode}`)
    }

    this.logger.info(`[Goal] Setting goal: ${goal}`)

    await this.stateManager.updateState({
      currentGoal: goal,
      currentMode: 'planning',
    })

    this.logger.info('[Goal] ✅ Goal set')
  }

  /**
   * Run agent (goal-directed mode)
   */
  async run(): Promise<void> {
    if (!this.initialized) {
      throw new AgentStatusError('Agent not initialized')
    }

    const state = await this.stateManager.getState()

    if (!state) {
      throw new AgentStatusError('State is null')
    }

    if (!state.currentGoal) {
      throw new AgentStatusError('No goal set')
    }

    this.logger.info('')
    this.logger.info('🚀 Starting execution...')
    this.logger.info('')

    try {
      // 1. Goal decomposition
      this.logger.info('[Run] Phase 1: Decomposing goal...')

      const decomposition = await this.goalDecomposer.decompose(state.currentGoal)

      this.logger.info(`[Run] ✅ Generated ${decomposition.tasks.length} task(s)`)

      // Log the high-level plan
      if (decomposition.highLevelPlan) {
        this.logger.info('[Run] High-level plan:')
        this.logger.info(decomposition.highLevelPlan)
      }

      // 2. Safety check
      this.logger.info('[Run] Phase 2: Checking safety...')

      const safetyResult = await this.safetyChecker.checkTasks(decomposition.tasks)

      if (!safetyResult.safe) {
        const violations = safetyResult.failed.map((f) => f.message).join(', ')
        throw new SafetyViolationError(`Safety check failed: ${violations}`)
      }

      this.logger.info('[Run] ✅ Safety checks passed')

      // 3. Create plan
      this.logger.info('[Run] Phase 3: Creating execution plan...')

      const plan = this.taskPlanner.createPlan(state.currentGoal, decomposition.tasks)

      this.logger.info(`[Run] ✅ Plan created: ${plan.executionOrder.length} phase(s)`)
      this.logger.info(`[Run] Estimated time: ${plan.estimatedTime}min`)

      if (plan.risks.length > 0) {
        this.logger.warn(`[Run] ⚠️  Risks identified:`)
        for (const risk of plan.risks) {
          this.logger.warn(`  - ${risk}`)
        }
      }

      // 4. Request approval
      this.logger.info('[Run] Phase 4: Requesting approval...')

      // Generate a unique plan ID using ULID
      const planId = `plan-${ulid()}`

      // Create plan approval request
      const approvalRequest = {
        planId,
        goal: state.currentGoal,
        tasks: plan.tasks,
        estimatedTime: plan.estimatedTime,
        risks: plan.risks,
        executionOrder: plan.executionOrder,
      }

      // Request approval from user
      const decision = await this.approvalManager.requestPlanApproval(approvalRequest)

      if (!decision.approved) {
        this.logger.info(`[Run] ❌ Plan not approved: ${decision.reason || 'No reason provided'}`)
        await this.stateManager.updateState({ currentMode: 'idle' })
        return
      }

      this.logger.info('[Run] ✅ Plan approved')

      // 5. Save plan to working space if configured
      if (this.workingSpace) {
        this.logger.info('[Run] Saving plan to working space...')
        await this.workingSpace.savePlan(plan)
      }

      // 6. Execute plan
      this.logger.info('[Run] Phase 6: Executing plan...')
      this.logger.info('')

      await this.executePlan(plan)

      // 6. Complete
      this.logger.info('')
      this.logger.info('✅ Execution complete')
      this.logger.info('')

      await this.stateManager.updateState({ currentMode: 'idle' })
    } catch (error) {
      this.logger.error('[Run] Execution failed', error as Error)

      await this.stateManager.updateState({ currentMode: 'error-recovery' })

      throw error
    }
  }

  /**
   * Run in continuous improvement mode
   */
  async runContinuous(): Promise<void> {
    if (!this.initialized) {
      throw new AgentStatusError('Agent not initialized')
    }

    const state = await this.stateManager.getState()

    if (!state) {
      throw new AgentStatusError('State is null')
    }

    if (state.currentMode !== 'idle') {
      throw new AgentStatusError(`Cannot start continuous mode while agent is ${state.currentMode}`)
    }

    this.logger.info('')
    this.logger.info('🔄 Starting continuous improvement mode...')
    this.logger.info('')

    await this.stateManager.updateState({
      currentMode: 'executing',
    })

    // Create and start continuous loop
    this.improvementLoop = createContinuousImprovementLoop(this.context, this.stateManager, this.sessionId)

    try {
      await this.improvementLoop.start()
    } catch (error) {
      this.logger.error('[Continuous] Loop failed', error as Error)
      throw error
    } finally {
      await this.stateManager.updateState({ currentMode: 'idle' })
    }
  }

  /**
   * Stop agent
   */
  async stop(): Promise<void> {
    this.logger.info('[Stop] Stopping agent...')

    // Stop continuous loop if running
    if (this.improvementLoop?.isRunning()) {
      await this.improvementLoop.stop()
    }

    // Cancel executing tasks
    this.taskExecutor.cancelAll()

    await this.stateManager.updateState({ currentMode: 'idle' })

    this.logger.info('[Stop] ✅ Agent stopped')
  }

  /**
   * Cleanup and release resources
   */
  async cleanup(): Promise<void> {
    this.logger.info('[Cleanup] Cleaning up...')

    try {
      // Release session
      await release(this.sessionId)

      // Log metrics
      const metrics = this.metrics.getMetrics()
      this.logger.info('[Cleanup] Metrics:', JSON.stringify(metrics, null, 2))

      this.initialized = false

      this.logger.info('[Cleanup] ✅ Cleanup complete')
    } catch (error) {
      this.logger.error('[Cleanup] Cleanup failed', error as Error)
    }
  }

  /**
   * Execute a plan phase by phase
   */
  private async executePlan(plan: Plan): Promise<void> {
    let completedTasks = 0
    let failedTasks = 0

    // Add all tasks to the queue first
    await this.stateManager.updateState({
      taskQueue: plan.tasks,
    })

    // Execute each phase
    for (let i = 0; i < plan.executionOrder.length; i++) {
      const phase = plan.executionOrder[i]

      this.logger.info(`[Run] Phase ${i + 1}/${plan.executionOrder.length} (${phase.length} task(s))`)

      // Execute tasks in phase (could be parallel in future)
      for (const taskId of phase) {
        const task = plan.tasks.find((t) => t.id === taskId)
        if (!task) {
          this.logger.warn(`[Run] Task not found: ${taskId}`)
          continue
        }

        // Check for interrupts
        if (this.interruptHandler.shouldStop()) {
          this.logger.info(`[Run] ⚠️  Interrupted: ${this.interruptHandler.getReason()}`)
          return
        }

        // Execute task
        const success = await this.executeTask(task)

        if (success) {
          completedTasks++
        } else {
          failedTasks++
          // Stop execution on task failure to prevent cascading errors
          const error = new Error(`Task "${task.title}" failed, stopping execution to prevent cascading errors`)
          this.logger.error('[Run]', error)
          throw error
        }
      }
    }

    this.logger.info(`[Run] Execution summary: ${completedTasks} succeeded, ${failedTasks} failed`)
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<boolean> {
    this.logger.info(`[Run] → ${task.title}`)

    try {
      // Get current state
      const state = await this.stateManager.getState()

      if (!state) {
        this.logger.error('[Run]', new Error('State is null'))
        return false
      }

      // Request approval if needed
      const needsApproval = this.approvalManager.requiresApproval(task)

      if (needsApproval) {
        const decision = await this.approvalManager.requestApproval(task)

        if (!decision.approved) {
          this.logger.info(`[Run] ⏭️  Task skipped (not approved): ${decision.reason || 'No reason provided'}`)
          return false
        }
      }

      // Execute task
      const result = await this.taskExecutor.execute(task, state)

      if (result.success) {
        this.logger.info(`[Run] ✅ Task completed`)

        // Document completed task in working space if configured
        if (this.workingSpace) {
          // Convert result data to readable string (handle objects, strings, primitives)
          let resultText = result.output
          if (!resultText) {
            if (result.data !== null && result.data !== undefined) {
              if (typeof result.data === 'string') {
                resultText = result.data
              } else if (typeof result.data === 'object') {
                resultText = JSON.stringify(result.data, null, 2)
              } else {
                resultText = String(result.data)
              }
            } else {
              resultText = 'Task completed successfully'
            }
          }
          await this.workingSpace.documentCompletedTask(task, resultText)
        }

        // Move task from queue to completed
        await this.stateManager.moveTask(task.id, 'queue', 'completed')

        // Add to history
        await this.taskHistory.add({
          taskId: task.id,
          taskType: task.type,
          success: true,
          duration: 0,
          estimatedTime: task.estimatedTime,
          actualTime: 0,
          timestamp: Date.now(),
        })

        return true
      } else {
        const errorMsg = result.error || 'Unknown error'
        this.logger.error('[Run]', new Error(`Task failed: ${errorMsg}`))

        // Move task from queue to failed
        await this.stateManager.moveTask(task.id, 'queue', 'failed')

        return false
      }
    } catch (error) {
      this.logger.error('[Run]', error as Error)

      // Move task from queue to failed
      await this.stateManager.moveTask(task.id, 'queue', 'failed')

      return false
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `agent-${ulid()}`
  }

  /**
   * Get current state
   */
  async getState(): Promise<AgentState | null> {
    return await this.stateManager.getState()
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.metrics.getMetrics()
  }
}
