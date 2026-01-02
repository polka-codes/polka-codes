import * as crypto from 'node:crypto'
import * as path from 'node:path'
import { AgentStatusError, SafetyViolationError } from './errors'
import { TaskExecutor } from './executor'
import { GoalDecomposer } from './goal-decomposer'
import { HealthMonitor } from './health-monitor'
import { ContinuousImprovementLoop } from './improvement-loop'
import { AgentLogger } from './logger'
import { MetricsCollector } from './metrics'
import { TaskPlanner } from './planner'
import { ResourceMonitor } from './resource-monitor'
import { ApprovalManager } from './safety/approval'
import { SafetyChecker } from './safety/checks'
import { InterruptHandler } from './safety/interrupt'
import { SessionManager } from './session'
import { AgentStateManager } from './state-manager'
import { TaskHistory } from './task-history'
import type { AgentConfig, AgentState, Plan, WorkflowContext } from './types'

/**
 * Main autonomous agent orchestrator
 *
 * Coordinates all agent components to:
 * - Accept high-level goals
 * - Decompose into executable tasks
 * - Execute tasks safely with approvals
 * - Manage resources and state
 * - Handle continuous improvement mode
 *
 * Two modes:
 * - Goal-directed: User provides a goal to achieve
 * - Continuous: Auto-discovers and fixes issues
 */
export class AutonomousAgent {
  private stateManager: AgentStateManager
  private resourceMonitor: ResourceMonitor
  private taskHistory: TaskHistory
  private logger: AgentLogger
  private metrics: MetricsCollector
  private approvalManager: ApprovalManager
  private safetyChecker: SafetyChecker
  private interruptHandler: InterruptHandler
  private goalDecomposer: GoalDecomposer
  private taskPlanner: TaskPlanner
  private taskExecutor: TaskExecutor
  private improvementLoop?: ContinuousImprovementLoop

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
    this.sessionManager = new SessionManager()
    this.resourceMonitor = new ResourceMonitor(config.resourceLimits, context.logger, this.handleResourceLimit.bind(this))
    this.taskHistory = new TaskHistory(stateDir)
    this.healthMonitor = new HealthMonitor(context.logger, config.healthCheck)
    this.logger = new AgentLogger(context.logger, path.join(stateDir, 'agent.log'), this.sessionId)
    this.metrics = new MetricsCollector()
    this.approvalManager = new ApprovalManager(
      this.logger,
      config.approval.level,
      config.approval.autoApproveSafeTasks,
      config.approval.maxAutoApprovalCost,
      config.destructiveOperations,
    )
    this.safetyChecker = new SafetyChecker(config.safety, this.logger)
    this.interruptHandler = new InterruptHandler(this.logger, this)
    this.goalDecomposer = new GoalDecomposer(context)
    this.taskPlanner = new TaskPlanner(context)
    this.taskExecutor = new TaskExecutor(context, context.logger)
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

      const acquireResult = await SessionManager.acquire(this.sessionId)

      if (!acquireResult.acquired) {
        throw new AgentStatusError(`Session conflict: ${this.sessionId} - ${acquireResult.reason}`)
      }

      this.logger.info('[Init] ✅ Session acquired')

      // 2. Initialize state
      this.logger.info('[Init] Initializing state...')

      const initialState = await this.stateManager.initialize()

      this.logger.info(`[Init] ✅ State initialized: ${initialState.currentMode}`)

      // 3. Start resource monitor
      this.logger.info('[Init] Starting resource monitor...')

      await this.resourceMonitor.start()

      this.logger.info('[Init] ✅ Resource monitor started')

      // 4. Log configuration
      this.logger.info('[Init] Configuration:')
      this.logger.info(`  - Approval level: ${this.config.approval.level}`)
      this.logger.info(`  - Max memory: ${this.config.resourceLimits.maxMemory}MB`)
      this.logger.info(`  - Session timeout: ${this.config.resourceLimits.maxSessionTime}min`)
      this.logger.info(`  - Task timeout: ${this.config.resourceLimits.maxTaskExecutionTime}min`)
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

    if (!state.currentGoal) {
      throw new AgentStatusError('No goal set')
    }

    this.logger.info('')
    this.logger.info('🚀 Starting execution...')
    this.logger.info('')

    try {
      // 1. Goal decomposition
      this.logger.info('[Run] Phase 1: Decomposing goal...')

      const tasks = await this.goalDecomposer.decompose(state.currentGoal)

      this.logger.info(`[Run] ✅ Generated ${tasks.length} task(s)`)

      // 2. Safety check
      this.logger.info('[Run] Phase 2: Checking safety...')

      const safetyResult = await this.safetyChecker.checkTasks(tasks)

      if (!safetyResult.safe) {
        throw new SafetyViolationError(`Safety check failed: ${safetyResult.violations.join(', ')}`)
      }

      this.logger.info('[Run] ✅ Safety checks passed')

      // 3. Create plan
      this.logger.info('[Run] Phase 3: Creating execution plan...')

      const plan = this.taskPlanner.createPlan(state.currentGoal, tasks)

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

      const approved = await this.approvalManager.requestApproval({
        type: 'plan',
        goal: state.currentGoal,
        tasks,
        plan,
      })

      if (!approved) {
        this.logger.info('[Run] ❌ Plan not approved, stopping')
        await this.stateManager.updateState({ currentMode: 'idle' })
        return
      }

      this.logger.info('[Run] ✅ Plan approved')

      // 5. Execute plan
      this.logger.info('[Run] Phase 5: Executing plan...')
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
    this.improvementLoop = new ContinuousImprovementLoop(this.context, this.stateManager, this.sessionId)

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
      // Stop resource monitor
      await this.resourceMonitor.stop()

      // Release session
      await SessionManager.release(this.sessionId)

      // Log metrics
      const metrics = this.metrics.getMetrics()
      this.logger.info('[Cleanup] Metrics:', metrics as any)

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
        }
      }
    }

    this.logger.info(`[Run] Execution summary: ${completedTasks} succeeded, ${failedTasks} failed`)
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: any): Promise<boolean> {
    this.logger.info(`[Run] → ${task.title}`)

    try {
      // Get current state
      const state = await this.stateManager.getState()

      // Request approval if needed
      const needsApproval = await this.approvalManager.requiresApproval(task)

      if (needsApproval) {
        const approved = await this.approvalManager.requestApproval({
          type: 'task',
          task,
        })

        if (!approved) {
          this.logger.info(`[Run] ⏭️  Task skipped (not approved)`)
          return false
        }
      }

      // Execute task
      const result = await this.taskExecutor.execute(task, state)

      if (result.success) {
        this.logger.info(`[Run] ✅ Task completed`)

        // Move task from queue to completed
        await this.stateManager.moveTask(task.id, 'queue', 'completed')

        // Add to history
        await this.taskHistory.add({
          task,
          result,
          timestamp: Date.now(),
        })

        return true
      } else {
        this.logger.error(`[Run] ❌ Task failed`, result.error)

        // Move task from queue to failed
        await this.stateManager.moveTask(task.id, 'queue', 'failed')

        return false
      }
    } catch (error) {
      this.logger.error(`[Run] ❌ Task error`, error as Error)

      // Move task from queue to failed
      await this.stateManager.moveTask(task.id, 'queue', 'failed')

      return false
    }
  }

  /**
   * Handle resource limit exceeded
   */
  private async handleResourceLimit(event: { limit: string; current: number; max: number }): Promise<void> {
    this.logger.warn(`[Resource] Limit exceeded: ${event.limit} (${event.current}/${event.max})`)

    if (event.limit === 'memory') {
      // Note: Attempting garbage collection requires --expose-gc flag
      // In production, rely on Node.js/Bun automatic garbage collection
      // Consider reducing memory usage by clearing caches, releasing resources, etc.
      this.logger.warn('[Resource] Memory limit exceeded - consider clearing caches or reducing task complexity')
    }

    if (event.limit === 'sessionTime') {
      this.logger.warn('[Resource] Session timeout approaching')

      // Stop gracefully
      await this.stop()
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `agent-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`
  }

  /**
   * Get current state
   */
  async getState(): Promise<AgentState> {
    return await this.stateManager.getState()
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.metrics.getMetrics()
  }
}
