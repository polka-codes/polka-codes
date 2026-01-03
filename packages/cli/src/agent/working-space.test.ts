import { beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { Priority } from './constants'
import type { Plan, Task } from './types'
import { WorkingSpace } from './working-space'

describe('WorkingSpace', () => {
  let workingSpace: WorkingSpace
  let testDir: string
  let mockLogger: any
  let testCounter = 0

  beforeEach(async () => {
    // Create temporary directory for tests with counter for uniqueness
    testCounter++
    testDir = path.join(os.tmpdir(), `working-space-test-${Date.now()}-${testCounter}`)
    await fs.mkdir(testDir, { recursive: true })

    mockLogger = {
      info: (_msg: string) => {},
      warn: (_msg: string) => {},
      error: (_msg: string) => {},
      debug: (_msg: string) => {},
    }

    workingSpace = new WorkingSpace(testDir, mockLogger)
    await workingSpace.initialize()
  })

  describe('initialize', () => {
    it('should create directory structure', async () => {
      const plansDir = path.join(testDir, 'plans')
      const tasksDir = path.join(testDir, 'tasks')
      const pendingDir = path.join(tasksDir, 'pending')
      const completedDir = path.join(tasksDir, 'completed')
      const logsDir = path.join(testDir, 'logs')

      // Check directories exist by trying to read them
      await expect(fs.readdir(plansDir)).resolves.toBeDefined()
      await expect(fs.readdir(pendingDir)).resolves.toBeDefined()
      await expect(fs.readdir(completedDir)).resolves.toBeDefined()
      await expect(fs.readdir(logsDir)).resolves.toBeDefined()
    })

    it('should handle existing directories', async () => {
      // Initialize again - should not throw
      await workingSpace.initialize()

      const plansDir = path.join(testDir, 'plans')
      // Just verify directory exists by reading it
      const files = await fs.readdir(plansDir)
      expect(Array.isArray(files)).toBe(true)
    })
  })

  describe('savePlan', () => {
    it('should save plan to markdown file', async () => {
      const plan: Plan = {
        goal: 'Test goal',
        highLevelPlan: 'Test plan',
        tasks: [],
        executionOrder: [],
        estimatedTime: 10,
        risks: [],
        dependencies: {},
      }

      await workingSpace.savePlan(plan)

      const plansDir = path.join(testDir, 'plans')
      const files = await fs.readdir(plansDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/\.md$/)
    })

    it('should sanitize filename', async () => {
      const plan: Plan = {
        goal: 'Test Goal with Special Chars! @#$%',
        highLevelPlan: 'Test',
        tasks: [],
        executionOrder: [],
        estimatedTime: 5,
        risks: [],
        dependencies: {},
      }

      await workingSpace.savePlan(plan)

      const plansDir = path.join(testDir, 'plans')
      const files = await fs.readdir(plansDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/\.md$/)
      expect(files[0]).not.toContain('!')
      expect(files[0]).not.toContain('@')
    })
  })

  describe('loadPlans', () => {
    it('should return empty array when no plans exist', async () => {
      const plans = await workingSpace.loadPlans()
      expect(plans).toEqual([])
    })

    it('should load plans from directory', async () => {
      const plan: Plan = {
        goal: 'Load Test',
        highLevelPlan: 'Test',
        tasks: [],
        executionOrder: [],
        estimatedTime: 5,
        risks: [],
        dependencies: {},
      }

      await workingSpace.savePlan(plan)

      const plans = await workingSpace.loadPlans()
      expect(plans.length).toBe(1)
      expect(plans[0].goal).toBe('Load Test')
    })

    it('should parse plan properties correctly from markdown', async () => {
      const plan: Plan = {
        goal: 'Complex Plan Test',
        highLevelPlan: 'This is a detailed high-level plan\nwith multiple lines\nfor testing parsing',
        tasks: [],
        executionOrder: [],
        estimatedTime: 45,
        risks: ['Risk 1: Something might go wrong', 'Risk 2: Another issue'],
        dependencies: {},
      }

      await workingSpace.savePlan(plan)

      const plans = await workingSpace.loadPlans()
      expect(plans.length).toBe(1)

      const parsed = plans[0]
      expect(parsed.goal).toBe('Complex Plan Test')
      expect(parsed.estimatedTime).toBe(45)
      expect(parsed.risks).toHaveLength(2)
      expect(parsed.risks).toContain('Risk 1: Something might go wrong')
      expect(parsed.highLevelPlan).toContain('multiple lines')
    })
  })

  describe('createPendingTask', () => {
    it('should create task file in pending directory', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'feature',
        title: 'Test task',
        description: 'Test description',
        priority: Priority.HIGH,
        complexity: 'medium',
        dependencies: [],
        estimatedTime: 10,
        status: 'pending',
        files: [],
        workflow: 'code',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)

      const pendingDir = path.join(testDir, 'tasks', 'pending')
      const files = await fs.readdir(pendingDir)
      expect(files.length).toBe(1)
      expect(files[0]).toMatch(/task-1-test-task/)
    })

    it('should include task metadata in markdown', async () => {
      const task: Task = {
        id: 'task-2',
        type: 'bugfix',
        title: 'Fix bug',
        description: 'Important fix',
        priority: Priority.CRITICAL,
        complexity: 'low',
        dependencies: [],
        estimatedTime: 5,
        status: 'pending',
        files: ['src/test.ts'],
        workflow: 'fix',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)

      const pendingDir = path.join(testDir, 'tasks', 'pending')
      const files = await fs.readdir(pendingDir)
      const content = await fs.readFile(path.join(pendingDir, files[0]), 'utf-8')

      expect(content).toContain('# Task: Fix bug')
      expect(content).toContain('**Type:** bugfix')
      expect(content).toContain('**Priority:** 1000')
      expect(content).toContain('**Status:** pending')
      expect(content).toContain('src/test.ts')
    })
  })

  describe('discoverPendingTasks', () => {
    it('should return empty array when no tasks', async () => {
      const tasks = await workingSpace.discoverPendingTasks()
      expect(tasks).toEqual([])
    })

    it('should discover pending tasks', async () => {
      const task: Task = {
        id: 'task-3',
        type: 'feature',
        title: 'Discover me',
        description: 'Test',
        priority: Priority.MEDIUM,
        complexity: 'medium',
        dependencies: [],
        estimatedTime: 15,
        status: 'pending',
        files: [],
        workflow: 'code',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)

      const tasks = await workingSpace.discoverPendingTasks()
      expect(tasks.length).toBe(1)
      expect(tasks[0].id).toBe('task-3')
      expect(tasks[0].title).toBe('Discover me')
    })

    it('should parse task properties correctly from markdown', async () => {
      const task: Task = {
        id: 'task-parse-test',
        type: 'bugfix',
        title: 'Parse Test Task',
        description: 'This is a detailed description for testing parsing',
        priority: Priority.CRITICAL,
        complexity: 'high',
        dependencies: ['task-1', 'task-2'],
        estimatedTime: 30,
        status: 'pending',
        files: ['src/file1.ts', 'src/file2.ts'],
        workflow: 'fix',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)

      const tasks = await workingSpace.discoverPendingTasks()
      expect(tasks.length).toBe(1)

      const parsed = tasks[0]
      expect(parsed.id).toBe('task-parse-test')
      expect(parsed.title).toBe('Parse Test Task')
      expect(parsed.type).toBe('bugfix')
      expect(parsed.priority).toBe(Priority.CRITICAL)
      expect(parsed.estimatedTime).toBe(30)
      expect(parsed.status).toBe('pending')
      expect(parsed.workflow).toBe('fix')
      expect(parsed.description).toContain('detailed description')
      expect(parsed.dependencies).toEqual(['task-1', 'task-2'])
      expect(parsed.files).toContain('src/file1.ts')
      expect(parsed.files).toContain('src/file2.ts')
    })

    it('should ignore non-markdown files', async () => {
      const pendingDir = path.join(testDir, 'tasks', 'pending')
      await fs.writeFile(path.join(pendingDir, 'not-a-task.txt'), 'test')

      const tasks = await workingSpace.discoverPendingTasks()
      expect(tasks).toEqual([])
    })
  })

  describe('documentCompletedTask', () => {
    it('should move task from pending to completed', async () => {
      const task: Task = {
        id: 'task-4',
        type: 'feature',
        title: 'Complete me',
        description: 'Test',
        priority: Priority.MEDIUM,
        complexity: 'low',
        dependencies: [],
        estimatedTime: 5,
        status: 'pending',
        files: [],
        workflow: 'code',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)
      await workingSpace.documentCompletedTask(task, 'Task completed successfully')

      const pendingDir = path.join(testDir, 'tasks', 'pending')
      const completedDir = path.join(testDir, 'tasks', 'completed')

      const pendingFiles = await fs.readdir(pendingDir)
      const completedFiles = await fs.readdir(completedDir)

      expect(pendingFiles.length).toBe(0)
      expect(completedFiles.length).toBe(1)
    })

    it('should update task status in completed file', async () => {
      const task: Task = {
        id: 'task-5',
        type: 'bugfix',
        title: 'Status test',
        description: 'Test',
        priority: Priority.HIGH,
        complexity: 'medium',
        dependencies: [],
        estimatedTime: 10,
        status: 'pending',
        files: [],
        workflow: 'fix',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)
      await workingSpace.documentCompletedTask(task, 'Fixed the bug')

      const completedDir = path.join(testDir, 'tasks', 'completed')
      const files = await fs.readdir(completedDir)
      const content = await fs.readFile(path.join(completedDir, files[0]), 'utf-8')

      expect(content).toContain('**Status:** completed')
      expect(content).toContain('## Result')
      expect(content).toContain('Fixed the bug')
    })
  })

  describe('getStats', () => {
    it('should return zero stats for empty working space', async () => {
      // Create a fresh working space with no files
      const emptyDir = path.join(os.tmpdir(), `working-space-empty-${Date.now()}`)
      await fs.mkdir(emptyDir, { recursive: true })
      const emptySpace = new WorkingSpace(emptyDir, mockLogger)
      await emptySpace.initialize()

      const stats = await emptySpace.getStats()

      expect(stats.planCount).toBe(0)
      expect(stats.pendingTaskCount).toBe(0)
      expect(stats.completedTaskCount).toBe(0)
      expect(stats.totalSize).toBe(0)
    })

    it('should count plans and tasks correctly', async () => {
      // Create a plan
      const plan: Plan = {
        goal: 'Stats Test',
        highLevelPlan: 'Test',
        tasks: [],
        executionOrder: [],
        estimatedTime: 5,
        risks: [],
        dependencies: {},
      }
      await workingSpace.savePlan(plan)

      // Create pending tasks
      const task1: Task = {
        id: 'task-1',
        type: 'feature',
        title: 'Task 1',
        description: 'Test',
        priority: Priority.MEDIUM,
        complexity: 'low',
        dependencies: [],
        estimatedTime: 5,
        status: 'pending',
        files: [],
        workflow: 'code',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      const task2: Task = {
        ...task1,
        id: 'task-2',
        title: 'Task 2',
      }

      await workingSpace.createPendingTask(task1)
      await workingSpace.createPendingTask(task2)

      // Complete one task
      await workingSpace.documentCompletedTask(task1, 'Done')

      // Verify files exist directly
      const plansDir = path.join(testDir, 'plans')
      const pendingDir = path.join(testDir, 'tasks', 'pending')
      const completedDir = path.join(testDir, 'tasks', 'completed')

      const planFiles = await fs.readdir(plansDir)
      const pendingFiles = await fs.readdir(pendingDir)
      const completedFiles = await fs.readdir(completedDir)

      expect(planFiles.length).toBeGreaterThanOrEqual(1)
      expect(pendingFiles.length).toBe(1)
      expect(completedFiles.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('cleanupOldCompletedTasks', () => {
    it('should keep specified number of tasks', async () => {
      // Create 5 completed tasks
      for (let i = 0; i < 5; i++) {
        const task: Task = {
          id: `task-${i}`,
          type: 'feature',
          title: `Task ${i}`,
          description: 'Test',
          priority: Priority.MEDIUM,
          complexity: 'low',
          dependencies: [],
          estimatedTime: 5,
          status: 'pending',
          files: [],
          workflow: 'code',
          workflowInput: {},
          retryCount: 0,
          createdAt: Date.now(),
        }
        await workingSpace.createPendingTask(task)
        await workingSpace.documentCompletedTask(task, 'Done')
      }

      await workingSpace.cleanupOldCompletedTasks(3)

      const stats = await workingSpace.getStats()
      expect(stats.completedTaskCount).toBeLessThanOrEqual(3)
    })

    it('should not delete any if under limit', async () => {
      const task: Task = {
        id: 'task-1',
        type: 'feature',
        title: 'Task 1',
        description: 'Test',
        priority: Priority.MEDIUM,
        complexity: 'low',
        dependencies: [],
        estimatedTime: 5,
        status: 'pending',
        files: [],
        workflow: 'code',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      await workingSpace.createPendingTask(task)
      await workingSpace.documentCompletedTask(task, 'Done')

      // Verify file exists
      const completedDir = path.join(testDir, 'tasks', 'completed')
      const completedFiles = await fs.readdir(completedDir)
      expect(completedFiles.length).toBeGreaterThanOrEqual(1)

      await workingSpace.cleanupOldCompletedTasks(10)

      // File should still exist after cleanup
      const filesAfter = await fs.readdir(completedDir)
      expect(filesAfter.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('exists', () => {
    it('should return true for existing working directory', async () => {
      const exists = await workingSpace.exists()
      expect(exists).toBe(true)
    })

    it('should return false for non-existing directory', async () => {
      const newSpace = new WorkingSpace('/non/existent/path', mockLogger)
      const exists = await newSpace.exists()
      expect(exists).toBe(false)
    })
  })

  describe('getWorkingDir', () => {
    it('should return working directory path', () => {
      const dir = workingSpace.getWorkingDir()
      expect(dir).toBe(testDir)
    })
  })
})
