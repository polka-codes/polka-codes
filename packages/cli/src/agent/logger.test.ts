import { beforeEach, describe, expect, it } from 'bun:test'
import { AgentLogger } from './logger'
import type { Task } from './types'

describe('AgentLogger', () => {
  let mockLogger: any
  let logger: AgentLogger
  let logMessages: string[]

  beforeEach(() => {
    logMessages = []
    mockLogger = {
      info: (msg: string) => logMessages.push(`info: ${msg}`),
      warn: (msg: string) => logMessages.push(`warn: ${msg}`),
      error: (msg: string) => logMessages.push(`error: ${msg}`),
      debug: (msg: string) => logMessages.push(`debug: ${msg}`),
    }
    logger = new AgentLogger(mockLogger, '/tmp/test.log', 'test-session')
  })

  describe('constructor', () => {
    it('should initialize with logger', () => {
      expect(logger).toBeDefined()
    })

    it('should store session ID', () => {
      expect(logger).toBeDefined()
    })
  })

  describe('task', () => {
    it('should log task message', () => {
      const task: Task = {
        id: 'task-1',
        type: 'feature',
        title: 'Test Task',
        description: 'Test description',
        priority: 800,
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

      logger.task(task, 'Task started')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[task-1]')
      expect(logMessages[0]).toContain('Task started')
    })

    it('should log task with metadata', () => {
      const task: Task = {
        id: 'task-1',
        type: 'bugfix',
        title: 'Fix bug',
        description: 'Fix the bug',
        priority: 1000,
        complexity: 'low',
        dependencies: [],
        estimatedTime: 5,
        status: 'in-progress',
        files: [],
        workflow: 'fix',
        workflowInput: {},
        retryCount: 0,
        createdAt: Date.now(),
      }

      logger.task(task, 'Task in progress', { progress: 50 })

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[task-1]')
      expect(logMessages[0]).toContain('Task in progress')
    })
  })

  describe('workflow', () => {
    it('should log workflow message', () => {
      logger.workflow('code', 'Starting code workflow')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[code]')
      expect(logMessages[0]).toContain('Starting code workflow')
    })

    it('should log workflow with metadata', () => {
      logger.workflow('fix', 'Applying fix', { files: 3 })

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[fix]')
      expect(logMessages[0]).toContain('Applying fix')
    })
  })

  describe('milestone', () => {
    it('should log milestone message', () => {
      logger.milestone('Planning complete')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[MILESTONE]')
      expect(logMessages[0]).toContain('Planning complete')
    })

    it('should log milestone with metadata', () => {
      logger.milestone('Phase complete', { phase: 1, duration: 1000 })

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[MILESTONE]')
      expect(logMessages[0]).toContain('Phase complete')
    })
  })

  describe('discovery', () => {
    it('should log discovery result', () => {
      logger.discovery('failing-tests', 5)

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[Discovery]')
      expect(logMessages[0]).toContain('failing-tests')
      expect(logMessages[0]).toContain('found 5 tasks')
    })

    it('should log discovery with metadata', () => {
      logger.discovery('type-errors', 3, { cached: false })

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[Discovery]')
      expect(logMessages[0]).toContain('type-errors')
    })
  })

  describe('stateTransition', () => {
    it('should log state transition', () => {
      logger.stateTransition('idle', 'planning')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[State]')
      expect(logMessages[0]).toContain('idle')
      expect(logMessages[0]).toContain('planning')
      expect(logMessages[0]).toContain('→')
    })

    it('should log state transition with reason', () => {
      logger.stateTransition('executing', 'error-recovery', 'Task failed')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[State]')
      expect(logMessages[0]).toContain('executing')
      expect(logMessages[0]).toContain('error-recovery')
      expect(logMessages[0]).toContain('Task failed')
    })
  })

  describe('metrics', () => {
    it('should log metrics', () => {
      logger.metrics({
        tasksCompleted: 10,
        tasksFailed: 2,
        totalTasks: 12,
        totalExecutionTime: 100000,
        averageTaskTime: 5.5,
        successRate: 83.33,
        git: {
          totalCommits: 3,
          totalFilesChanged: 15,
          totalInsertions: 200,
          totalDeletions: 50,
          branchesCreated: 1,
        },
        tests: {
          totalTestsRun: 50,
          testsPassed: 48,
          testsFailed: 2,
          currentCoverage: 85,
          testsAdded: 10,
        },
        improvements: {
          bugsFixed: 5,
          testsAdded: 10,
          refactoringsCompleted: 2,
          documentationAdded: 3,
          qualityImprovements: 1,
        },
        resources: {
          peakMemoryMB: 512,
          averageCpuPercent: 45,
          totalApiCalls: 100,
          totalTokensUsed: 50000,
        },
      })

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[Metrics]')
      expect(logMessages[0]).toContain('10/12')
    })
  })

  describe('approval', () => {
    it('should log approved task', () => {
      const task: Task = {
        id: 'task-1',
        type: 'feature',
        title: 'Add feature',
        description: 'Add new feature',
        priority: 600,
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

      logger.approval(task, true)

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[Approval]')
      expect(logMessages[0]).toContain('✓')
      expect(logMessages[0]).toContain('Add feature')
    })

    it('should log rejected task', () => {
      const task: Task = {
        id: 'task-2',
        type: 'delete',
        title: 'Delete files',
        description: 'Delete old files',
        priority: 400,
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

      logger.approval(task, false, 'Too destructive')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[Approval]')
      expect(logMessages[0]).toContain('✗')
      expect(logMessages[0]).toContain('Delete files')
    })
  })

  describe('error', () => {
    it('should log error with context', () => {
      const error = new Error('Test error')
      logger.error('TestContext', error)

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[TestContext]')
      expect(logMessages[0]).toContain('Test error')
    })

    it('should log error with metadata', () => {
      const error = new Error('Failed task')
      logger.error('TaskExecution', error, { taskId: 'task-1' })

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('[TaskExecution]')
    })
  })

  describe('info', () => {
    it('should log info message', () => {
      logger.info('Info message')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('info: Info message')
    })

    it('should log info with multiple args', () => {
      logger.info('Info with', 'multiple', 'args')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('info: Info with')
    })
  })

  describe('warn', () => {
    it('should log warn message', () => {
      logger.warn('Warning message')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('warn: Warning message')
    })

    it('should log warn with multiple args', () => {
      logger.warn('Warning with', 'data')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('warn: Warning with')
    })
  })

  describe('debug', () => {
    it('should log debug message', () => {
      logger.debug('Debug message')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('debug: Debug message')
    })

    it('should log debug with multiple args', () => {
      logger.debug('Debug with', 'details')

      expect(logMessages).toHaveLength(1)
      expect(logMessages[0]).toContain('debug: Debug with')
    })
  })

  describe('file writing', () => {
    it('should not throw when file writing fails', () => {
      const task: Task = {
        id: 'task-1',
        type: 'feature',
        title: 'Test',
        description: 'Test',
        priority: 600,
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

      // Invalid path should not throw
      const badLogger = new AgentLogger(mockLogger, '/invalid/path/test.log', 'test-session')
      expect(() => badLogger.task(task, 'Test')).not.toThrow()
    })
  })
})
