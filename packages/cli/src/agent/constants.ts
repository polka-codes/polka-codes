import type { AgentConfig, ApprovalLevel, TaskType, WorkflowName } from './types'
import { Priority } from './types'

// Re-export Priority for convenience
export { Priority }

/**
 * Mapping of task types to workflows
 */
export const WORKFLOW_MAPPING: Record<TaskType, WorkflowName> = {
  feature: 'plan',
  bugfix: 'fix',
  refactor: 'code',
  refactoring: 'code',
  test: 'code',
  testing: 'code',
  docs: 'code',
  documentation: 'code',
  review: 'review',
  commit: 'commit',
  analysis: 'plan',
  security: 'fix',
  optimization: 'code',
  other: 'plan',
  plan: 'plan',
  task: 'code',
  delete: 'code',
  'force-push': 'code',
  reset: 'code',
}

/**
 * Default discovery strategies
 */
export const DEFAULT_DISCOVERY_STRATEGIES = ['build-errors', 'failing-tests', 'type-errors', 'lint-issues'] as const

/**
 * Advanced discovery strategies
 */
export const ADVANCED_DISCOVERY_STRATEGIES = ['test-coverage', 'code-quality', 'refactoring', 'documentation', 'security'] as const

/**
 * All discovery strategies
 */
export const ALL_DISCOVERY_STRATEGIES = [...DEFAULT_DISCOVERY_STRATEGIES, ...ADVANCED_DISCOVERY_STRATEGIES] as const

/**
 * State transition rules
 */
export const STATE_TRANSITIONS: Array<{
  from: string[]
  to: string
  label: string
}> = [
  { from: ['idle'], to: 'planning', label: 'setGoal' },
  { from: ['planning'], to: 'executing', label: 'planReady' },
  { from: ['executing'], to: 'reviewing', label: 'taskComplete' },
  { from: ['executing'], to: 'error-recovery', label: 'taskFailed' },
  { from: ['reviewing'], to: 'committing', label: 'reviewPassed' },
  { from: ['reviewing'], to: 'executing', label: 'reviewFailed' },
  { from: ['committing'], to: 'idle', label: 'committed' },
  { from: ['error-recovery'], to: 'executing', label: 'recovered' },
  { from: ['error-recovery'], to: 'stopped', label: 'unrecoverable' },
  { from: ['*'], to: 'stopped', label: 'interrupt' },
]

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
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
    maxMemory: 2048,
    maxCpuPercent: 80,
    maxTaskExecutionTime: 60,
    maxSessionTime: 480,
    maxFilesChanged: 20,
  },
  continuousImprovement: {
    sleepTimeOnNoTasks: 60000, // 1 minute
    sleepTimeBetweenTasks: 5000, // 5 seconds
    maxCycles: 0, // infinite
  },
  discovery: {
    enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES],
    cacheTime: 300000, // 5 minutes
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
    maxFileSize: 10485760, // 10MB
  },
}

/**
 * Configuration presets
 */
export const CONFIG_PRESETS: Record<string, Partial<AgentConfig>> = {
  conservative: {
    strategy: 'goal-directed',
    requireApprovalFor: 'all' as ApprovalLevel,
    autoApproveSafeTasks: false,
    maxAutoApprovalCost: 0,
    pauseOnError: true,
    maxConcurrency: 1,
    discovery: {
      enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES],
      cacheTime: 300000,
      checkChanges: true,
    },
  },

  balanced: {
    strategy: 'goal-directed',
    requireApprovalFor: 'destructive' as ApprovalLevel,
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 10,
    pauseOnError: true,
    maxConcurrency: 1,
    discovery: {
      enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES],
      cacheTime: 300000,
      checkChanges: true,
    },
  },

  aggressive: {
    strategy: 'goal-directed',
    requireApprovalFor: 'none' as ApprovalLevel,
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 30,
    pauseOnError: false,
    maxConcurrency: 2,
    discovery: {
      enabledStrategies: [...ALL_DISCOVERY_STRATEGIES],
      cacheTime: 600000,
      checkChanges: false,
    },
  },

  'continuous-improvement': {
    strategy: 'continuous-improvement',
    continueOnCompletion: true,
    maxIterations: 0,
    requireApprovalFor: 'commits' as ApprovalLevel,
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 15,
    pauseOnError: false,
    maxConcurrency: 2,
    discovery: {
      enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES, 'test-coverage'],
      cacheTime: 300000,
      checkChanges: true,
    },
  },
}
