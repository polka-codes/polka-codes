import { beforeEach, describe, expect, it } from 'bun:test'
import { createContinuousImprovementLoop } from './improvement-loop'
import { AgentStateManager } from './state-manager'
import type { AgentConfig, WorkflowContext } from './types'

describe('ContinuousImprovementLoop', () => {
  let loop: ReturnType<typeof createContinuousImprovementLoop>
  let stateManager: AgentStateManager
  let mockContext: WorkflowContext

  const _mockConfig: AgentConfig = {
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
    resourceLimits: {
      maxMemory: 1024,
      maxCpuPercent: 80,
      maxSessionTime: 60,
      maxTaskExecutionTime: 5,
      maxFilesChanged: 20,
    },
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
    mockContext = {
      logger: {
        info: () => {},
        warn: () => {},
        error: () => {},
        debug: () => {},
      },
      cwd: '/test',
    } as unknown as WorkflowContext

    stateManager = new AgentStateManager('/test-state-dir', 'test-session')
    loop = createContinuousImprovementLoop(mockContext, stateManager, 'test-session')
  })

  describe('start and stop', () => {
    it('should create loop successfully', () => {
      expect(loop).toBeDefined()
      expect(loop.isRunning()).toBe(false)
      expect(loop.getIterationCount()).toBe(0)
    })

    it('should get iteration count', () => {
      expect(loop.getIterationCount()).toBe(0)
    })

    it('should check running state', () => {
      expect(loop.isRunning()).toBe(false)
    })
  })
})
