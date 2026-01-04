import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { Priority } from './constants'
import { TaskExecutor } from './executor'
import { createMockContext, createMockLogger } from './test-fixtures'
import type { AgentConfig, AgentState, Task } from './types'

describe('TaskExecutor', () => {
  let executor: TaskExecutor
  let mockLogger: ReturnType<typeof createMockLogger>
  let mockState: AgentState

  const mockConfig: AgentConfig = {
    strategy: 'goal-directed',
    continueOnCompletion: false,
    maxIterations: 0,
    timeout: 0,
    requireApprovalFor: 'destructive',
    pauseOnError: true,
    workingBranch: 'main',
    maxConcurrency: 1,
    autoSaveInterval: 30000,
    enableProgress: true,
    destructiveOperations: ['delete', 'force-push', 'reset'],
    maxAutoApprovalCost: 5,
    autoApproveSafeTasks: true,
    continuousImprovement: {
      sleepTimeOnNoTasks: 60000,
      sleepTimeBetweenTasks: 5000,
      maxCycles: 0,
    },
    discovery: {
      enabledStrategies: [],
      cacheTime: 300000,
      checkChanges: true,
    },
    approval: {
      level: 'destructive',
      autoApproveSafeTasks: true,
      maxAutoApprovalCost: 5,
    },
    safety: {
      enabledChecks: [],
      blockDestructive: true,
      maxFileSize: 10485760,
    },
    healthCheck: {
      enabled: true,
      interval: 30,
    },
  }

  beforeEach(() => {
    mockLogger = createMockLogger()
    executor = new TaskExecutor(createMockContext(), mockLogger)

    mockState = {
      sessionId: 'test-session',
      currentMode: 'idle',
      currentGoal: undefined,
      config: mockConfig,
      currentTask: undefined,
      taskQueue: [],
      completedTasks: [],
      failedTasks: [],
      blockedTasks: [],
      executionHistory: [],
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalTasks: 0,
        totalExecutionTime: 0,
        averageTaskTime: 0,
        successRate: 0,
        git: {
          totalCommits: 0,
          totalFilesChanged: 0,
          totalInsertions: 0,
          totalDeletions: 0,
          branchesCreated: 0,
        },
        tests: {
          totalTestsRun: 0,
          testsPassed: 0,
          testsFailed: 0,
          currentCoverage: 0,
          testsAdded: 0,
        },
        improvements: {
          bugsFixed: 0,
          testsAdded: 0,
          refactoringsCompleted: 0,
          documentationAdded: 0,
          qualityImprovements: 0,
        },
      },
      timestamps: {
        startTime: Date.now(),
        lastActivity: Date.now(),
        lastSaveTime: Date.now(),
        lastMetricsUpdate: Date.now(),
        modeTransitions: [],
      },
      session: {
        id: 'test-session',
        iterationCount: 0,
        parentPid: 1,
        pid: 1,
      },
    }
  })

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: `task-${Date.now()}`,
    title: 'Test task',
    description: 'Test description',
    type: 'bugfix',
    priority: Priority.MEDIUM,
    complexity: 'medium',
    estimatedTime: 30,
    status: 'pending',
    workflow: 'code',
    workflowInput: {},
    dependencies: [],
    files: [],
    createdAt: Date.now(),
    retryCount: 0,
    ...overrides,
  })

  describe('execute', () => {
    it('should execute task successfully', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        invokeWorkflow: async () => ({
          success: true,
          data: { result: 'done' },
          output: 'Task completed',
        }),
      }))

      const result = await executor.execute(task, mockState)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ result: 'done' })
    })

    it('should handle task execution failures', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        invokeWorkflow: async () => ({
          success: false,
          error: new Error('Workflow failed'),
        }),
      }))

      const result = await executor.execute(task, mockState)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })

    it('should handle workflow exceptions', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        invokeWorkflow: async () => {
          throw new Error('Unexpected error')
        },
      }))

      const result = await executor.execute(task, mockState)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Unexpected error')
    })

    it('should enforce task timeout', async () => {
      // Create task that takes longer than timeout
      const task = createMockTask()

      // Use the mock state
      const testState = mockState

      mock.module('./workflow-adapter', () => ({
        invokeWorkflow: async () => {
          // Sleep longer than 100ms timeout
          await new Promise((resolve) => setTimeout(resolve, 500))
          return { success: true }
        },
      }))

      // Execute with 100ms timeout
      const result = await executor.execute(task, testState, 100)

      // Should timeout
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('timed out')
    }, 5000)
  })

  describe('cancel', () => {
    it('should cancel running task', async () => {
      const task = createMockTask()

      // Start task that never completes
      const neverResolve = new Promise(() => {})
      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => neverResolve,
        },
      }))

      // Start execution (don't await)
      const execution = executor.execute(task, mockState)

      // Cancel immediately
      const cancelled = executor.cancel(task.id)

      expect(cancelled).toBe(true)

      // Clean up
      try {
        await Promise.race([execution, new Promise((r) => setTimeout(r, 100))])
      } catch {}
    })

    it('should return false for non-existent task', () => {
      const cancelled = executor.cancel('non-existent')

      expect(cancelled).toBe(false)
    })
  })

  describe('cancelAll', () => {
    it('should cancel all running tasks', async () => {
      const task1 = createMockTask({ id: 'task-1' })
      const task2 = createMockTask({ id: 'task-2' })

      const neverResolve = new Promise(() => {})
      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => neverResolve,
        },
      }))

      // Start executions
      const exec1 = executor.execute(task1, mockState)
      const exec2 = executor.execute(task2, mockState)

      // Cancel all
      executor.cancelAll()

      // Clean up
      try {
        await Promise.race([Promise.all([exec1, exec2]), new Promise((r) => setTimeout(r, 100))])
      } catch {}
    })
  })
})
