import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { Priority } from './constants'
import { ContinuousImprovementLoop } from './improvement-loop'
import { AgentStateManager } from './state-manager'
import type { AgentConfig, WorkflowContext } from './types'

describe('ContinuousImprovementLoop', () => {
  let loop: ContinuousImprovementLoop
  let stateManager: AgentStateManager
  let mockContext: WorkflowContext

  const mockConfig: AgentConfig = {
    approval: {
      level: 'destructive',
    },
    resourceLimits: {
      maxMemory: 1024,
      maxSessionTime: 60,
      maxTaskExecutionTime: 5,
    },
    safety: {
      allowedOperations: ['read', 'write'],
      forbiddenPatterns: [],
    },
    taskHistorySize: 100,
    logging: {
      level: 'info',
    },
    healthCheck: {
      interval: 30,
    },
  }

  beforeEach(() => {
    mockContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
      },
      cwd: '/test',
    }

    stateManager = new AgentStateManager(mockConfig)
    loop = new ContinuousImprovementLoop(mockContext, stateManager, 'test-session')
  })

  describe('start and stop', () => {
    it('should start and stop loop', async () => {
      mock.module('./task-discovery', () => ({
        TaskDiscoveryEngine: class {
          async discover() {
            return [] // No tasks
          }
          getBackoffSeconds() {
            return 1
          }
          increaseBackoff() {
            /* noop */
          }
          resetBackoff() {
            /* noop */
          }
        },
      }))

      // Start loop in background
      const startPromise = loop.start()

      // Let it run one iteration
      await new Promise((resolve) => setTimeout(resolve, 100))

      // Stop loop
      await loop.stop()

      // Wait for start to complete
      await startPromise

      expect(loop.isRunning()).toBe(false)
    })

    it('should not allow starting twice', async () => {
      mock.module('./task-discovery', () => ({
        TaskDiscoveryEngine: class {
          async discover() {
            return []
          }
          getBackoffSeconds() {
            return 1
          }
          increaseBackoff() {
            /* noop */
          }
          resetBackoff() {
            /* noop */
          }
        },
      }))

      const start1 = loop.start()
      await new Promise((resolve) => setTimeout(resolve, 50))

      await expect(loop.start()).rejects.toThrow('already running')

      await loop.stop()
      await start1
    })
  })

  describe('iteration', () => {
    it('should execute discovered tasks', async () => {
      let discoveryCount = 0
      let executionCount = 0

      mock.module('./task-discovery', () => ({
        TaskDiscoveryEngine: class {
          async discover() {
            discoveryCount++
            return [
              {
                id: 'task-1',
                title: 'Fix bug',
                description: '',
                type: 'fix' as const,
                priority: Priority.HIGH,
                complexity: 'low' as const,
                estimatedTime: 30,
                status: 'pending' as const,
                workflow: 'code' as const,
                workflowInput: {},
                dependencies: [],
                files: [],
                createdAt: Date.now(),
                metadata: {},
              },
            ]
          }
          getBackoffSeconds() {
            return 0.1
          }
          resetBackoff() {
            /* noop */
          }
        },
      }))

      mock.module('./planner', () => ({
        TaskPlanner: class {
          createPlan() {
            return {
              goal: 'Test',
              highLevelPlan: 'Test plan',
              tasks: [],
              executionOrder: [['task-1']],
              estimatedTime: 30,
              risks: [],
              dependencies: [],
            }
          }
        },
      }))

      mock.module('./executor', () => ({
        TaskExecutor: class {
          async execute() {
            executionCount++
            return { success: true }
          }
        },
      }))

      mock.module('./session', () => ({
        SessionManager: {
          getActiveSession: () => ({ sessionId: 'test-session' }),
          updateHeartbeat: () => Promise.resolve(),
        },
      }))

      await loop.iteration()

      expect(discoveryCount).toBe(1)
      expect(executionCount).toBe(1)
      expect(loop.getIterationCount()).toBe(1)
    })

    it('should increase backoff when no tasks found', async () => {
      let backoffIncreased = false

      mock.module('./task-discovery', () => ({
        TaskDiscoveryEngine: class {
          async discover() {
            return [] // No tasks
          }
          getBackoffSeconds() {
            return 60
          }
          increaseBackoff() {
            backoffIncreased = true
          }
        },
      }))

      await loop.iteration()

      expect(backoffIncreased).toBe(true)
    })

    it('should reset backoff when tasks found', async () => {
      let backoffReset = false

      mock.module('./task-discovery', () => ({
        TaskDiscoveryEngine: class {
          async discover() {
            return [
              {
                id: 'task-1',
                title: 'Fix',
                description: '',
                type: 'fix' as const,
                priority: Priority.HIGH,
                complexity: 'low' as const,
                estimatedTime: 30,
                status: 'pending' as const,
                workflow: 'code' as const,
                workflowInput: {},
                dependencies: [],
                files: [],
                createdAt: Date.now(),
                metadata: {},
              },
            ]
          }
          getBackoffSeconds() {
            return 120
          }
          resetBackoff() {
            backoffReset = true
          }
        },
      }))

      mock.module('./planner', () => ({
        TaskPlanner: class {
          createPlan() {
            return {
              goal: 'Test',
              highLevelPlan: 'Test',
              tasks: [],
              executionOrder: [['task-1']],
              estimatedTime: 30,
              risks: [],
              dependencies: [],
            }
          }
        },
      }))

      mock.module('./executor', () => ({
        TaskExecutor: class {
          async execute() {
            return { success: true }
          }
        },
      }))

      mock.module('./session', () => ({
        SessionManager: {
          getActiveSession: () => ({ sessionId: 'test-session' }),
          updateHeartbeat: () => Promise.resolve(),
        },
      }))

      await loop.iteration()

      expect(backoffReset).toBe(true)
    })

    it('should handle iteration errors gracefully', async () => {
      mock.module('./task-discovery', () => ({
        TaskDiscoveryEngine: class {
          async discover() {
            throw new Error('Discovery failed')
          }
          getBackoffSeconds() {
            return 60
          }
          increaseBackoff() {
            /* noop */
          }
        },
      }))

      // Should not throw
      await loop.iteration()

      expect(loop.getIterationCount()).toBe(1)
    })
  })

  describe('executePlan', () => {
    it('should execute all plan phases', async () => {
      const executedTasks: string[] = []

      mock.module('./executor', () => ({
        TaskExecutor: class {
          async execute(task: any) {
            executedTasks.push(task.id)
            return { success: true }
          }
        },
      }))

      const plan = {
        goal: 'Test',
        highLevelPlan: 'Test',
        tasks: [
          { id: 'task-1', title: 'Task 1' },
          { id: 'task-2', title: 'Task 2' },
        ],
        executionOrder: [['task-1'], ['task-2']],
        estimatedTime: 60,
        risks: [],
        dependencies: [],
      }

      await loop.executePlan(plan)

      expect(executedTasks).toEqual(['task-1', 'task-2'])
    })

    it('should update state for completed tasks', async () => {
      mock.module('./executor', () => ({
        TaskExecutor: class {
          async execute(_task: any) {
            return { success: true, data: { result: 'done' } }
          }
        },
      }))

      await stateManager.initialize()

      // Add task to queue
      await stateManager.state.taskQueue.push({
        id: 'task-1',
        title: 'Task',
        description: '',
        type: 'fix' as const,
        priority: Priority.HIGH,
        complexity: 'low' as const,
        estimatedTime: 30,
        status: 'pending' as const,
        workflow: 'code' as const,
        workflowInput: {},
        dependencies: [],
        files: [],
        createdAt: Date.now(),
        metadata: {},
      })

      const plan = {
        goal: 'Test',
        highLevelPlan: 'Test',
        tasks: [],
        executionOrder: [['task-1']],
        estimatedTime: 30,
        risks: [],
        dependencies: [],
      }

      await loop.executePlan(plan)

      const state = await stateManager.getState()
      expect(state.completedQueue).toHaveLength(1)
      expect(state.completedQueue[0].status).toBe('completed')
    })
  })

  describe('getIterationCount', () => {
    it('should return iteration count', () => {
      expect(loop.getIterationCount()).toBe(0)
    })
  })

  describe('isRunning', () => {
    it('should return running state', () => {
      expect(loop.isRunning()).toBe(false)
    })
  })
})
