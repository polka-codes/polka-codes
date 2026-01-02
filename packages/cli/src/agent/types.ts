/**
 * Core type definitions for the autonomous agent system
 */

import type { Logger } from '@polka-codes/core'

/**
 * Agent operation modes with explicit state machine
 */
export type AgentMode =
  | 'idle' // Ready to accept goals
  | 'planning' // Decomposing goal into tasks
  | 'executing' // Running tasks
  | 'reviewing' // Reviewing execution results
  | 'committing' // Committing changes
  | 'error-recovery' // Recovering from errors
  | 'stopped' // Gracefully stopped

/**
 * Agent execution strategy
 */
export type AgentStrategy = 'goal-directed' | 'continuous-improvement'

/**
 * Approval requirement levels
 */
export type ApprovalLevel = 'none' | 'destructive' | 'commits' | 'all'

/**
 * Priority levels (enum-based for clarity)
 */
export enum Priority {
  CRITICAL = 1000, // Build failures, security issues, data loss
  HIGH = 800, // Test failures, type errors, bugs
  MEDIUM = 600, // Refactoring, documentation, coverage
  LOW = 400, // Nice-to-have features, optimizations
  TRIVIAL = 200, // Style fixes, minor cleanups
}

/**
 * Task complexity estimation
 */
export type TaskComplexity = 'low' | 'medium' | 'high'

/**
 * Task types supported by the agent
 */
export type TaskType =
  | 'feature'
  | 'bugfix'
  | 'refactor'
  | 'refactoring'
  | 'test'
  | 'testing'
  | 'docs'
  | 'documentation'
  | 'review'
  | 'commit'
  | 'analysis'
  | 'security'
  | 'optimization'
  | 'other'

/**
 * Task execution status
 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked' | 'skipped'

/**
 * Workflow names (mapped to existing workflows)
 */
export type WorkflowName = 'plan' | 'code' | 'review' | 'fix' | 'commit' | 'test' | 'refactor' | 'analyze'

/**
 * Priority calculation result
 */
export interface PriorityResult {
  priority: Priority
  reason: string
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  /** Execution strategy */
  strategy: AgentStrategy

  /** Continue running after goal completion */
  continueOnCompletion: boolean

  /** Maximum iterations in continuous mode (0 = infinite) */
  maxIterations: number

  /** Session timeout in minutes (0 = no timeout) */
  timeout: number

  /** Approval requirement level */
  requireApprovalFor: ApprovalLevel

  /** Pause on error and wait for user input */
  pauseOnError: boolean

  /** Working branch for commits */
  workingBranch: string

  /** Maximum concurrent tasks (1 = sequential) */
  maxConcurrency: number

  /** Auto-save state interval (ms) */
  autoSaveInterval: number

  /** Enable progress reporting */
  enableProgress: boolean

  /** Destructive operations that require approval */
  destructiveOperations: TaskType[]

  /** Maximum estimated time for auto-approval (minutes) */
  maxAutoApprovalCost: number

  /** Auto-approve safe tasks */
  autoApproveSafeTasks: boolean

  /** Resource limits */
  resourceLimits: ResourceLimits

  /** Continuous improvement settings */
  continuousImprovement: ContinuousImprovementConfig

  /** Discovery settings */
  discovery: DiscoveryConfig

  /** Configuration preset name (if loaded from preset) */
  preset?: string
}

/**
 * Resource limits to prevent resource exhaustion
 */
export interface ResourceLimits {
  /** Maximum memory usage (MB) */
  maxMemory: number

  /** Maximum CPU percentage */
  maxCpuPercent: number

  /** Maximum execution time per task (minutes) */
  maxTaskExecutionTime: number

  /** Maximum total session time (minutes) */
  maxSessionTime: number

  /** Maximum files changed per commit */
  maxFilesChanged: number
}

/**
 * Continuous improvement configuration
 */
export interface ContinuousImprovementConfig {
  /** Sleep time between cycles when no tasks found (ms) */
  sleepTimeOnNoTasks: number

  /** Sleep time between tasks (ms) */
  sleepTimeBetweenTasks: number

  /** Maximum cycles before forced shutdown (0 = infinite) */
  maxCycles: number
}

/**
 * Discovery configuration
 */
export interface DiscoveryConfig {
  /** Enable/disable specific strategies */
  enabledStrategies: string[]

  /** Cache discovery results (ms) */
  cacheTime: number

  /** Only run discovery if git status shows changes */
  checkChanges: boolean
}

/**
 * Agent state (persisted across sessions)
 */
export interface AgentState {
  /** Session identifier */
  sessionId: string

  /** Current mode */
  currentMode: AgentMode

  /** Previous mode (for error recovery) */
  previousMode?: AgentMode

  /** Current goal (if any) */
  currentGoal?: string

  /** Configuration */
  config: AgentConfig

  /** Current task being executed */
  currentTask?: Task

  /** Task queue */
  taskQueue: Task[]

  /** Completed tasks */
  completedTasks: Task[]

  /** Failed tasks */
  failedTasks: Task[]

  /** Blocked tasks */
  blockedTasks: Task[]

  /** Execution history */
  executionHistory: ExecutionRecord[]

  /** Metrics */
  metrics: AgentMetrics

  /** Timestamps */
  timestamps: Timestamps

  /** Session info */
  session: SessionInfo

  /** Error recovery state */
  errorRecovery?: ErrorRecoveryState
}

/**
 * Error recovery state
 */
export interface ErrorRecoveryState {
  /** Error that triggered recovery */
  error: Error

  /** Retry count */
  retryCount: number

  /** Maximum retries */
  maxRetries: number

  /** Recovery strategy */
  strategy: 'retry' | 'skip' | 'fail' | 'approve'
}

/**
 * Task definition
 */
export interface Task {
  /** Unique identifier */
  id: string

  /** Task type */
  type: TaskType

  /** Task title */
  title: string

  /** Detailed description */
  description: string

  /** Priority (enum) */
  priority: Priority

  /** Complexity estimation */
  complexity: TaskComplexity

  /** Task dependencies (task IDs) */
  dependencies: string[]

  /** Estimated execution time (minutes) */
  estimatedTime: number

  /** Current status */
  status: TaskStatus

  /** Files affected by this task */
  files: string[]

  /** Workflow to execute */
  workflow: WorkflowName

  /** Input for the workflow */
  workflowInput: any

  /** Execution result (if completed) */
  result?: WorkflowExecutionResult

  /** Error (if failed) */
  error?: TaskError

  /** Retry count */
  retryCount: number

  /** Creation timestamp */
  createdAt: number

  /** Start timestamp (if started) */
  startedAt?: number

  /** Completion timestamp (if completed) */
  completedAt?: number

  /** Branch for this task */
  branch?: string

  /** Additional metadata */
  metadata?: Record<string, any>
}

/**
 * Workflow execution result
 */
export interface WorkflowExecutionResult {
  /** Success flag */
  success: boolean

  /** Result data */
  data?: any

  /** Output generated */
  output?: string

  /** Files modified */
  filesModified?: string[]

  /** Tests run */
  testsRun?: number

  /** Tests passed */
  testsPassed?: number

  /** Error (if failed) */
  error?: Error
}

/**
 * Task error with context
 */
export interface TaskError {
  /** Error message */
  message: string

  /** Error type */
  type: ErrorType

  /** Stack trace */
  stack?: string

  /** Context where error occurred */
  context: string

  /** Whether retry is possible */
  retryable: boolean
}

/**
 * Error classification
 */
export type ErrorType =
  | 'transient' // Network issues, timeouts (retry)
  | 'validation' // Schema failures, invalid input (fix or skip)
  | 'test-failure' // Test failures (fix)
  | 'permission' // File permissions (user intervention)
  | 'fatal' // Cannot continue (stop)
  | 'unknown' // Uncertain (ask user)

/**
 * Execution record for learning
 */
export interface ExecutionRecord {
  /** Task ID */
  taskId: string

  /** Task type */
  taskType: TaskType

  /** Success flag */
  success: boolean

  /** Execution duration (ms) */
  duration: number

  /** Estimated time (minutes) */
  estimatedTime: number

  /** Actual time (minutes) */
  actualTime: number

  /** Timestamp */
  timestamp: number

  /** Error message (if failed) */
  error?: string
}

/**
 * Agent metrics
 */
export interface AgentMetrics {
  /** Total tasks completed */
  tasksCompleted: number

  /** Total tasks failed */
  tasksFailed: number

  /** Total tasks attempted */
  totalTasks: number

  /** Total execution time (ms) */
  totalExecutionTime: number

  /** Average task time (minutes) */
  averageTaskTime: number

  /** Success rate (%) */
  successRate: number

  /** Git metrics */
  git: GitMetrics

  /** Test metrics */
  tests: TestMetrics

  /** Improvement metrics */
  improvements: ImprovementMetrics

  /** Resource usage */
  resources: ResourceUsage
}

/**
 * Git-related metrics
 */
export interface GitMetrics {
  /** Total commits made */
  totalCommits: number

  /** Total files changed */
  totalFilesChanged: number

  /** Total insertions */
  totalInsertions: number

  /** Total deletions */
  totalDeletions: number

  /** Branches created */
  branchesCreated: number
}

/**
 * Test-related metrics
 */
export interface TestMetrics {
  /** Total tests run */
  totalTestsRun: number

  /** Tests passed */
  testsPassed: number

  /** Tests failed */
  testsFailed: number

  /** Current coverage percentage */
  currentCoverage: number

  /** Tests added */
  testsAdded: number
}

/**
 * Improvement metrics
 */
export interface ImprovementMetrics {
  /** Bugs fixed */
  bugsFixed: number

  /** Tests added */
  testsAdded: number

  /** Refactorings completed */
  refactoringsCompleted: number

  /** Documentation additions */
  documentationAdded: number

  /** Code quality improvements */
  qualityImprovements: number
}

/**
 * Resource usage tracking
 */
export interface ResourceUsage {
  /** Peak memory usage (MB) */
  peakMemoryMB: number

  /** Average CPU percentage */
  averageCpuPercent: number

  /** Total API calls made */
  totalApiCalls: number

  /** Total tokens used */
  totalTokensUsed: number
}

/**
 * Timestamp tracking
 */
export interface Timestamps {
  /** Session start time */
  startTime: number

  /** Last activity timestamp */
  lastActivity: number

  /** Last save timestamp */
  lastSaveTime: number

  /** Last metrics update */
  lastMetricsUpdate: number

  /** Mode transition timestamps */
  modeTransitions: Array<{
    from: AgentMode
    to: AgentMode
    timestamp: number
  }>
}

/**
 * Session information
 */
export interface SessionInfo {
  /** Session ID */
  id: string

  /** Iteration count */
  iterationCount: number

  /** Parent PID (for monitoring) */
  parentPid: number

  /** Node process PID */
  pid: number
}

/**
 * Safety check result
 */
export interface SafetyCheckResult {
  /** Overall safety flag */
  safe: boolean

  /** Individual checks */
  checks: SafetyCheck[]

  /** Failed checks */
  failed: SafetyCheck[]

  /** Warnings (non-blocking) */
  warnings: SafetyCheck[]
}

/**
 * Individual safety check
 */
export interface SafetyCheck {
  /** Check name */
  name: string

  /** Passed flag */
  passed: boolean

  /** Check message */
  message: string

  /** Error details (if failed) */
  error?: string

  /** Action to take */
  action: 'block' | 'warn' | 'ignore'
}

/**
 * Approval decision
 */
export interface ApprovalDecision {
  /** Approved flag */
  approved: boolean

  /** Reason (if not approved) */
  reason?: string

  /** Conditions for approval */
  conditions?: string[]
}

/**
 * Error handling result
 */
export interface ErrorHandlingResult {
  /** Action to take */
  action: 'success' | 'retry' | 'skip' | 'fail' | 'approve'

  /** Reason for action */
  reason?: string

  /** Retry delay (ms) if retrying */
  retryDelay?: number

  /** Error recovery state */
  recoveryState?: ErrorRecoveryState
}

/**
 * Progress report
 */
export interface ProgressReport {
  /** Current mode */
  mode: AgentMode

  /** Current phase */
  phase: string

  /** Current task */
  currentTask?: string

  /** Progress percentage (0-100) */
  progress: number

  /** Completed tasks */
  completedTasks: number

  /** Total tasks */
  totalTasks: number

  /** Estimated time remaining (minutes) */
  estimatedTimeRemaining: number

  /** Metrics snapshot */
  metrics: AgentMetrics
}

/**
 * Workflow context (extended from core)
 */
export interface WorkflowContext {
  /** Logger */
  logger: Logger

  /** Tools */
  tools: any

  /** State directory */
  stateDir: string

  /** Working directory */
  workingDir: string

  /** Session ID */
  sessionId: number

  /** Config */
  config?: AgentConfig
}

/**
 * Discovery strategy for finding tasks
 */
export interface DiscoveryStrategy {
  /** Strategy name */
  name: string

  /** Description */
  description: string

  /** Execute discovery */
  execute: (context: WorkflowContext) => Promise<Task[]>

  /** Calculate priority */
  priority: (task: Task) => PriorityResult

  /** Enable/disable flag */
  enabled: boolean

  /** Should check for changes before running */
  checkChanges?: boolean
}

/**
 * Execution plan
 */
export interface Plan {
  /** Goal to achieve */
  goal: string

  /** High-level plan description */
  highLevelPlan: string

  /** Tasks in the plan */
  tasks: Task[]

  /** Execution order (phases of task IDs) */
  executionOrder: string[][]

  /** Estimated total time (minutes) */
  estimatedTime: number

  /** Identified risks */
  risks: string[]

  /** Dependency graph */
  dependencies: Record<string, string[]>
}
