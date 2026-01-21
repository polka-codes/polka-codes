import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Logger } from '@polka-codes/core'
import { Priority, type Task } from '../types'
import { SafetyChecker } from './checks'

// Mock Logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
} as unknown as Logger

// Mock Tools
const mockExecuteCommand = mock(async (_args: { command: string }) => ({ stdout: '', stderr: '', exitCode: 0 }))
const mockTools = {
  executeCommand: mockExecuteCommand,
}

describe('SafetyChecker', () => {
  let checker: SafetyChecker

  const createTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'test-task',
    type: 'feature',
    title: 'Test Task',
    description: 'Description',
    priority: Priority.MEDIUM,
    complexity: 'medium',
    dependencies: [],
    estimatedTime: 10,
    status: 'pending',
    files: [],
    workflow: 'code',
    workflowInput: {},
    retryCount: 0,
    createdAt: Date.now(),
    ...overrides,
  })

  beforeEach(() => {
    mockExecuteCommand.mockClear()
    checker = new SafetyChecker(mockLogger, mockTools)
  })

  describe('checkTasks', () => {
    it('should pass when all checks pass', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }) // Clean git status

      const task = createTask()
      const result = await checker.checkTasks([task])

      expect(result.safe).toBe(true)
      expect(result.failed).toHaveLength(0)
    })

    it('should warn on uncommitted changes for commit tasks', async () => {
      mockExecuteCommand.mockImplementation(async ({ command }: { command: string }) => {
        if (command.includes('git status')) {
          return { stdout: 'M file.ts', stderr: '', exitCode: 0 }
        }
        return { stdout: 'feature-branch', stderr: '', exitCode: 0 }
      })

      const task = createTask({ type: 'commit' })
      const result = await checker.checkTasks([task])

      expect(result.safe).toBe(true) // It's a warning, not a block
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].name).toBe('uncommitted-changes')
    })

    it('should warn when affecting critical files', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })

      const task = createTask({ files: ['package.json'] })
      const result = await checker.checkTasks([task])

      expect(result.safe).toBe(true) // Warning
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].name).toBe('critical-files')
    })

    it('should warn when committing to main branch', async () => {
      mockExecuteCommand.mockImplementation(async ({ command }: { command: string }) => {
        if (command.includes('git branch')) {
          return { stdout: 'main', stderr: '', exitCode: 0 }
        }
        return { stdout: '', stderr: '', exitCode: 0 }
      })

      const task = createTask({ type: 'commit' })
      const result = await checker.checkTasks([task])

      expect(result.safe).toBe(true) // Warning
      expect(result.warnings).toHaveLength(1)
      expect(result.warnings[0].name).toBe('working-branch')
    })

    it('should handle multiple tasks', async () => {
      mockExecuteCommand.mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 })
      const tasks = [createTask(), createTask()]
      const result = await checker.checkTasks(tasks)
      expect(result.safe).toBe(true)
      expect(result.checks.length).toBeGreaterThan(0)
    })
  })
})
