import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { Priority } from './constants'
import { TaskExecutor } from './executor'
import type { AgentConfig, AgentState, Task } from './types'

describe('TaskExecutor', () => {
  let executor: TaskExecutor
  let mockLogger: any
  let mockState: AgentState

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
    mockLogger = {
      info: () => {},
      warn: () => {},
      error: () => {},
    }

    executor = new TaskExecutor({}, mockLogger)

    mockState = {
      status: 'idle',
      goal: null,
      mode: 'goal-directed',
      taskQueue: [],
      executingQueue: [],
      completedQueue: [],
      failedQueue: [],
      config: mockConfig,
      metrics: {
        tasksCompleted: 0,
        tasksFailed: 0,
        totalExecutionTime: 0,
      },
      sessionStartTime: Date.now(),
    }
  })

  const createMockTask = (overrides?: Partial<Task>): Task => ({
    id: `task-${Date.now()}`,
    title: 'Test task',
    description: 'Test description',
    type: 'fix',
    priority: Priority.MEDIUM,
    complexity: 'medium',
    estimatedTime: 30,
    status: 'pending',
    workflow: 'code',
    workflowInput: {},
    dependencies: [],
    files: [],
    createdAt: Date.now(),
    metadata: {},
    ...overrides,
  })

  describe('execute', () => {
    it('should execute task successfully', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => ({
            success: true,
            data: { result: 'done' },
            output: 'Task completed',
          }),
        },
      }))

      const result = await executor.execute(task, mockState)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ result: 'done' })
    })

    it('should handle task execution failures', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => ({
            success: false,
            error: new Error('Workflow failed'),
          }),
        },
      }))

      const result = await executor.execute(task, mockState)

      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
    })

    it('should handle workflow exceptions', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => {
            throw new Error('Unexpected error')
          },
        },
      }))

      const result = await executor.execute(task, mockState)

      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('Unexpected error')
    })

    it('should enforce task timeout', async () => {
      // Create task that takes longer than timeout
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => {
            // Sleep longer than 5 minute timeout
            await new Promise((resolve) => setTimeout(resolve, 10000))
            return { success: true }
          },
        },
      }))

      // Set short timeout for testing (5 minutes in config)
      const result = await executor.execute(task, mockState)

      // Should timeout
      expect(result.success).toBe(false)
      expect(result.error?.message).toContain('timed out')
    }, 10000)
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

  describe('invokeWorkflow', () => {
    it('should invoke workflow through adapter', async () => {
      const task = createMockTask({
        workflow: 'code',
        workflowInput: { prompt: 'Fix bug' },
      })

      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async (workflow: string, input: any) => {
            expect(workflow).toBe('code')
            expect(input.prompt).toBe('Fix bug')

            return {
              success: true,
              data: { fixed: true },
            }
          },
        },
      }))

      const result = await executor.invokeWorkflow(task)

      expect(result.success).toBe(true)
      expect(result.data).toEqual({ fixed: true })
    })

    it('should wrap workflow errors', async () => {
      const task = createMockTask()

      mock.module('./workflow-adapter', () => ({
        WorkflowAdapter: {
          invokeWorkflow: async () => {
            throw new Error('Workflow error')
          },
        },
      }))

      await expect(executor.invokeWorkflow(task)).rejects.toThrow()
    })
  })
})
