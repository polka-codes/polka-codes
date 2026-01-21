import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Logger } from '@polka-codes/core'
import { Priority, type Task } from '../types'
import { ApprovalManager } from './approval'

// Mock Logger
const infoMock = mock(() => {})
const warnMock = mock(() => {})
const errorMock = mock(() => {})
const debugMock = mock(() => {})

const mockLogger = {
  info: infoMock,
  warn: warnMock,
  error: errorMock,
  debug: debugMock,
} as unknown as Logger

// Mock readline
let mockAnswer = 'yes'
const mockQuestion = mock((_query: string, cb: (answer: string) => void) => {
  cb(mockAnswer)
})

mock.module('node:readline', () => {
  return {
    createInterface: () => ({
      question: mockQuestion,
      close: () => {},
    }),
  }
})

describe('ApprovalManager', () => {
  let manager: ApprovalManager

  // Helper to create tasks
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
    // Reset mocks
    infoMock.mockClear()
    warnMock.mockClear()
    mockQuestion.mockClear()

    // Default manager setup
    manager = new ApprovalManager(
      mockLogger,
      'destructive', // approvalLevel
      true, // autoApproveSafeTasks
      30, // maxAutoApprovalCost
      ['delete', 'force-push'], // destructiveOperations
    )
  })

  describe('requiresApproval', () => {
    it('should return false when approval level is none', () => {
      manager = new ApprovalManager(mockLogger, 'none', false, 0, [])
      const task = createTask({ type: 'delete' }) // Even destructive
      expect(manager.requiresApproval(task)).toBe(false)
    })

    it('should return true when approval level is all', () => {
      manager = new ApprovalManager(mockLogger, 'all', true, 100, [])
      const task = createTask({ type: 'feature' })
      expect(manager.requiresApproval(task)).toBe(true)
    })

    it('should return true for destructive tasks', () => {
      const task = createTask({ type: 'delete' })
      expect(manager.requiresApproval(task)).toBe(true)
    })

    it('should return true for tasks affecting many files', () => {
      const files = Array(11).fill('file.ts')
      const task = createTask({ files })
      expect(manager.requiresApproval(task)).toBe(true)
    })

    it('should return true for tasks with destructive keywords in description', () => {
      const task = createTask({ description: 'This will delete everything' })
      expect(manager.requiresApproval(task)).toBe(true)
    })

    it('should return true for commits when level is commits', () => {
      manager = new ApprovalManager(mockLogger, 'commits', true, 30, [])
      const task = createTask({ type: 'commit' })
      expect(manager.requiresApproval(task)).toBe(true)
    })

    it('should auto-approve safe tasks within limits', () => {
      const task = createTask({
        estimatedTime: 20,
        priority: Priority.TRIVIAL,
      })
      expect(manager.requiresApproval(task)).toBe(false)
    })

    it('should require approval if task exceeds auto-approval cost', () => {
      const task = createTask({
        estimatedTime: 40,
        priority: Priority.TRIVIAL,
      })
      expect(manager.requiresApproval(task)).toBe(true)
    })

    it('should require approval if task is not trivial priority', () => {
      const task = createTask({
        estimatedTime: 20,
        priority: Priority.HIGH,
      })
      expect(manager.requiresApproval(task)).toBe(true)
    })
  })

  describe('requestApproval', () => {
    // We need to handle process.stdin.isTTY
    const originalIsTTY = process.stdin.isTTY

    beforeEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', { value: true, configurable: true })
    })

    afterEach(() => {
      Object.defineProperty(process.stdin, 'isTTY', { value: originalIsTTY, configurable: true })
    })

    it('should return approved when user answers yes', async () => {
      mockAnswer = 'yes'
      const task = createTask()
      const result = await manager.requestApproval(task)
      expect(result.approved).toBe(true)
      expect(mockQuestion).toHaveBeenCalled()
    })

    it('should return rejected when user answers no', async () => {
      mockAnswer = 'no'
      const task = createTask()
      const result = await manager.requestApproval(task)
      expect(result.approved).toBe(false)
      expect(result.reason).toBe('Rejected by user')
    })

    it('should auto-reject if not TTY', async () => {
      Object.defineProperty(process.stdin, 'isTTY', { value: false, configurable: true })
      const task = createTask()
      const result = await manager.requestApproval(task)
      expect(result.approved).toBe(false)
      expect(result.reason).toContain('Non-interactive')
    })
  })
})
