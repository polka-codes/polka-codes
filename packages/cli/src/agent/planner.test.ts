import { beforeEach, describe, expect, it } from 'bun:test'
import { Priority } from './constants'
import { TaskPlanner } from './planner'
import type { Task } from './types'

describe('TaskPlanner', () => {
  const mockContext = {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  }

  let planner: TaskPlanner

  beforeEach(() => {
    planner = new TaskPlanner(mockContext)
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
      const tasks = [createMockTask({ type: 'fix', title: 'Fix bug' }), createMockTask({ type: 'feature', title: 'Add feature' })]

      const plan = planner.createPlan('Test goal', tasks)

      expect(plan.highLevelPlan).toContain('Test goal')
      expect(plan.highLevelPlan).toContain('2 task')
      expect(plan.highLevelPlan).toContain('fix')
      expect(plan.highLevelPlan).toContain('feature')
    })

    it('should extract dependency graph', () => {
      const task1 = createMockTask({ id: 'task-1', dependencies: [] })
      const task2 = createMockTask({ id: 'task-2', dependencies: ['task-1'] })

      const plan = planner.createPlan('Test', [task1, task2])

      const dep = plan.dependencies.find((d) => d.taskId === 'task-2')
      expect(dep).toBeDefined()
      expect(dep?.dependsOn).toEqual(['task-1'])
      expect(dep?.type).toBe('hard')
    })
  })

  describe('resolveDependencies', () => {
    it('should resolve dependency titles to IDs', () => {
      const tasks = [
        createMockTask({ id: 'task-1', title: 'First task', dependencies: [] }),
        createMockTask({
          id: 'task-2',
          title: 'Second task',
          dependencies: ['First task'],
        }),
      ]

      const resolved = planner.resolveDependencies(tasks)

      expect(resolved[1].dependencies).toEqual(['task-1'])
    })

    it('should handle missing dependencies', () => {
      const tasks = [
        createMockTask({
          title: 'Task',
          dependencies: ['Non-existent task'],
        }),
      ]

      const resolved = planner.resolveDependencies(tasks)

      expect(resolved[0].dependencies).toEqual([])
    })
  })

  describe('createExecutionPhases', () => {
    it('should create phases for tasks with no dependencies', () => {
      const tasks = [createMockTask({ id: 'task-1', dependencies: [] }), createMockTask({ id: 'task-2', dependencies: [] })]

      const phases = planner.createExecutionPhases(tasks)

      expect(phases).toHaveLength(1)
      expect(phases[0]).toHaveLength(2)
    })

    it('should handle task dependencies correctly', () => {
      const tasks = [
        createMockTask({ id: 'task-1', dependencies: [] }),
        createMockTask({ id: 'task-2', dependencies: ['task-1'] }),
        createMockTask({ id: 'task-3', dependencies: ['task-1'] }),
        createMockTask({ id: 'task-4', dependencies: ['task-2', 'task-3'] }),
      ]

      const phases = planner.createExecutionPhases(tasks)

      expect(phases).toHaveLength(3)
      expect(phases[0]).toEqual(['task-1'])
      expect(phases[1]).toContain('task-2')
      expect(phases[1]).toContain('task-3')
      expect(phases[2]).toEqual(['task-4'])
    })

    it('should detect circular dependencies', () => {
      const tasks = [createMockTask({ id: 'task-1', dependencies: ['task-2'] }), createMockTask({ id: 'task-2', dependencies: ['task-1'] })]

      const phases = planner.createExecutionPhases(tasks)

      // Should break out of loop to prevent infinite loop
      expect(phases.length).toBeLessThan(10)
    })
  })

  describe('identifyRisks', () => {
    it('should identify tasks with many dependencies', () => {
      const tasks = [
        createMockTask({
          dependencies: ['1', '2', '3', '4', '5', '6'],
        }),
      ]

      const risks = planner.identifyRisks(tasks)

      expect(risks.some((r) => r.includes('6 dependencies'))).toBe(true)
    })

    it('should identify long-running tasks', () => {
      const tasks = [createMockTask({ estimatedTime: 150 })]

      const risks = planner.identifyRisks(tasks)

      expect(risks.some((r) => r.includes('long estimated time'))).toBe(true)
    })

    it('should identify high-priority high-complexity tasks', () => {
      const tasks = [
        createMockTask({
          priority: Priority.HIGH,
          complexity: 'high',
        }),
      ]

      const risks = planner.identifyRisks(tasks)

      expect(risks.some((r) => r.includes('high-complexity'))).toBe(true)
    })

    it('should identify tasks affecting many files', () => {
      const tasks = [
        createMockTask({
          files: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
        }),
      ]

      const risks = planner.identifyRisks(tasks)

      expect(risks.some((r) => r.includes('>10 files'))).toBe(true)
    })

    it('should identify many critical tasks', () => {
      const tasks = [
        createMockTask({ priority: Priority.CRITICAL }),
        createMockTask({ priority: Priority.CRITICAL }),
        createMockTask({ priority: Priority.CRITICAL }),
        createMockTask({ priority: Priority.CRITICAL }),
      ]

      const risks = planner.identifyRisks(tasks)

      expect(risks.some((r) => r.includes('critical-priority'))).toBe(true)
    })

    it('should return empty array when no risks', () => {
      const tasks = [
        createMockTask({
          dependencies: ['1'],
          estimatedTime: 30,
          priority: Priority.MEDIUM,
          complexity: 'low',
          files: ['1'],
        }),
      ]

      const risks = planner.identifyRisks(tasks)

      expect(risks).toHaveLength(0)
    })
  })
})
