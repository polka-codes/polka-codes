import { beforeEach, describe, expect, it } from 'bun:test'
import { Priority } from './constants'
import { createTaskPlanner } from './planner'
import type { Task } from './types'

describe('TaskPlanner', () => {
  const mockContext = {
    tools: {},
    step: {},
    cwd: '/test',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any

  let planner: ReturnType<typeof createTaskPlanner>

  beforeEach(() => {
    planner = createTaskPlanner(mockContext)
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

  describe('createPlan', () => {
    it('should create a plan from tasks', () => {
      const tasks = [createMockTask({ title: 'Task 1', estimatedTime: 30 }), createMockTask({ title: 'Task 2', estimatedTime: 45 })]

      const plan = planner.createPlan('Test goal', tasks)

      expect(plan.goal).toBe('Test goal')
      expect(plan.tasks).toHaveLength(2)
      expect(plan.estimatedTime).toBe(75)
      expect(plan.executionOrder).toBeDefined()
      expect(plan.dependencies).toBeDefined()
    })

    it('should calculate total estimated time', () => {
      const tasks = [createMockTask({ estimatedTime: 30 }), createMockTask({ estimatedTime: 45 }), createMockTask({ estimatedTime: 60 })]

      const plan = planner.createPlan('Test', tasks)

      expect(plan.estimatedTime).toBe(135)
    })

    it('should identify risks', () => {
      const tasks = [
        createMockTask({
          dependencies: ['task-1', 'task-2', 'task-3', 'task-4', 'task-5', 'task-6'],
        }),
        createMockTask({ estimatedTime: 150 }),
        createMockTask({
          priority: Priority.CRITICAL,
          complexity: 'high',
        }),
      ]

      const plan = planner.createPlan('Test', tasks)

      expect(plan.risks.length).toBeGreaterThan(0)
      expect(plan.risks.some((r) => r.includes('6 dependencies'))).toBe(true)
      expect(plan.risks.some((r) => r.includes('long estimated time'))).toBe(true)
      expect(plan.risks.some((r) => r.includes('high-complexity'))).toBe(true)
    })

    it('should generate high-level plan description', () => {
      const tasks = [createMockTask({ type: 'bugfix', title: 'Fix bug' }), createMockTask({ type: 'feature', title: 'Add feature' })]

      const plan = planner.createPlan('Test goal', tasks)

      expect(plan.highLevelPlan).toContain('Test goal')
      expect(plan.highLevelPlan).toContain('2 task')
      expect(plan.highLevelPlan).toContain('bugfix')
      expect(plan.highLevelPlan).toContain('feature')
    })

    it('should extract dependency graph', () => {
      const task1 = createMockTask({ id: 'task-1', dependencies: [] })
      const task2 = createMockTask({ id: 'task-2', dependencies: ['task-1'] })

      const plan = planner.createPlan('Test', [task1, task2])

      expect(plan.dependencies['task-2']).toEqual(['task-1'])
    })

    it('should resolve dependency titles to IDs', () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'First task', dependencies: [] }),
        createMockTask({
          id: 'task-2',
          title: 'Second task',
          dependencies: ['First task'],
        }),
      ]

      const plan = planner.createPlan('Test', tasks)

      expect(plan.tasks[1].dependencies).toEqual(['task-1'])
    })

    it('should handle missing dependencies', () => {
      const tasks = [
        createMockTask({
          title: 'Task',
          dependencies: ['Non-existent task'],
        }),
      ]

      const plan = planner.createPlan('Test', tasks)

      expect(plan.tasks[0].dependencies).toEqual([])
    })

    it('should create phases for tasks with no dependencies', () => {
      const tasks = [createMockTask({ id: 'task-1', dependencies: [] }), createMockTask({ id: 'task-2', dependencies: [] })]

      const plan = planner.createPlan('Test', tasks)

      expect(plan.executionOrder).toHaveLength(1)
      expect(plan.executionOrder[0]).toHaveLength(2)
    })

    it('should handle task dependencies correctly', () => {
      const tasks = [
        createMockTask({ id: 'task-1', dependencies: [] }),
        createMockTask({ id: 'task-2', dependencies: ['task-1'] }),
        createMockTask({ id: 'task-3', dependencies: ['task-1'] }),
        createMockTask({ id: 'task-4', dependencies: ['task-2', 'task-3'] }),
      ]

      const plan = planner.createPlan('Test', tasks)

      expect(plan.executionOrder).toHaveLength(3)
      expect(plan.executionOrder[0]).toEqual(['task-1'])
      expect(plan.executionOrder[1]).toContain('task-2')
      expect(plan.executionOrder[1]).toContain('task-3')
      expect(plan.executionOrder[2]).toEqual(['task-4'])
    })

    it('should detect circular dependencies', () => {
      const tasks = [createMockTask({ id: 'task-1', dependencies: ['task-2'] }), createMockTask({ id: 'task-2', dependencies: ['task-1'] })]

      const plan = planner.createPlan('Test', tasks)

      // Should break out of loop to prevent infinite loop
      expect(plan.executionOrder.length).toBeLessThan(10)
    })
  })
})
