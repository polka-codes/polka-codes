/**
 * Test fixtures and mock utilities for agent testing
 *
 * Provides properly typed mock objects and factory functions
 * to replace unsafe `as any` assertions in tests.
 */

import type { Logger, StepFn, WorkflowTools } from '@polka-codes/core'
import type { WorkflowContext } from './types'

/**
 * Mock logger for testing
 */
export function createMockLogger(): Logger {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }
}

/**
 * Mock step function for testing
 */
export function createMockStepFn(): StepFn {
  return async (_name, optionsOrFn, fn?) => {
    const actualFn = fn || optionsOrFn
    if (typeof actualFn === 'function') {
      return await actualFn()
    }
    throw new Error('Expected function')
  }
}

/**
 * Mock tools for testing
 */
export function createMockTools(): WorkflowTools<any> {
  return {
    executeCommand: async () => ({
      exitCode: 0,
      stdout: '',
      stderr: '',
    }),
    readFile: async () => ({ content: '' }),
    listFiles: async () => [],
    writeToFile: async () => {},
    removeFile: async () => {},
    updateMemory: async () => {},
    readMemory: async () => '',
    listMemoryTopics: async () => [],
    getMemoryContext: async () => '',
  }
}

/**
 * Mock workflow context for testing
 */
export function createMockContext(overrides?: Partial<WorkflowContext>): WorkflowContext {
  return {
    logger: createMockLogger(),
    tools: createMockTools(),
    step: createMockStepFn(),
    workingDir: '/test/workspace',
    stateDir: '/test/state',
    sessionId: 'test-session-123',
    ...overrides,
  }
}

/**
 * Mock agent config for testing
 */
export function createMockConfig() {
  return {
    resourceLimits: {
      maxMemory: 1024,
      maxSessionTime: 60,
      maxTaskExecutionTime: 30,
    },
    approval: {
      level: 'none' as const,
      autoApproveSafeTasks: true,
      maxAutoApprovalCost: 100,
    },
    destructiveOperations: {
      allowBranchDeletion: false,
      allowForcePush: false,
      allowStagingReset: false,
    },
    discovery: {
      strategy: 'default' as const,
      maxTasksPerIteration: 10,
      taskPrioritization: true,
    },
    stateDir: '/test/state',
  }
}

/**
 * Mock agent state for testing
 */
export function createMockState() {
  return {
    currentMode: 'idle' as const,
    currentGoal: null,
    config: createMockConfig(),
    taskQueue: [],
    completedTasks: [],
    failedTasks: [],
    startTime: Date.now(),
    lastActivity: Date.now(),
    sessionMetadata: {
      pid: process.pid,
      hostname: 'localhost',
      username: 'test-user',
    },
  }
}
