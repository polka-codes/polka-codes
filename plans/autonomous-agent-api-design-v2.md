# Autonomous Agent - Revised Implementation Plan v2.0

**Created:** 2025-01-02
**Status:** Ready for Implementation
**Revised:** Based on comprehensive review feedback
**Estimated Timeline:** 12 weeks (with MVP in 8 weeks)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Phase 1: Foundation (Week 1-2)](#phase-1-foundation)
4. [Phase 2: Core Execution (Week 3-5)](#phase-2-core-execution)
5. [Phase 3: Continuous Improvement (Week 6-7)](#phase-3-continuous-improvement)
6. [Phase 4: Advanced Features (Week 8-10)](#phase-4-advanced-features)
7. [Phase 5: Optimization & Polish (Week 11-12)](#phase-5-optimization--polish)
8. [MVP Definition](#mvp-definition)
9. [Testing Strategy](#testing-strategy)
10. [TypeScript API Reference](#typescript-api-reference)

---

## Executive Summary

### What Changed in v2.0

**Critical Additions:**
- ✅ Complete orchestrator specification with state machine
- ✅ Task executor implementation with workflow integration
- ✅ Continuous improvement loop redesign (no more infinite exits)
- ✅ Explicit state transition rules and mode management
- ✅ Workflow mapping to existing codebase
- ✅ Smart discovery with change detection
- ✅ Priority system redesign (enum-based)
- ✅ Configuration validation with Zod schemas

**Improvements:**
- Extended timeline: 10 → 12 weeks (more realistic)
- Phase 2 split: Core execution (3 weeks) + Review/gates moved to Phase 4
- Better integration with existing workflow infrastructure
- Improved error handling and recovery
- Enhanced testing strategy
- MVP clearly defined (8 weeks)

**Removed/Delayed:**
- Parallel execution moved from Phase 2 to Phase 4
- Learning system marked as "future work" (Phase 5+)
- Console.log "security issue" downgraded
- Some advanced discovery strategies delayed

---

## Architecture Overview

### System Components

```
┌─────────────────────────────────────────────────────────────┐
│                     CLI Interface                            │
│                    (autonomous command)                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  AutonomousAgent                              │
│                  (Orchestrator)                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  State Machine                                        │   │
│  │  idle → planning → executing → reviewing → committing  │   │
│  └──────────────────────────────────────────────────────┘   │
└───┬─────────────┬──────────────┬──────────────┬────────────┘
    │             │              │              │
    ▼             ▼              ▼              ▼
┌────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐
│ State  │  │  Goal    │  │  Task    │  │ Discovery  │
│Manager │  │Decomposer│  │ Executor │  │   Engine   │
└────────┘  └──────────┘  └──────────┘  └────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
            ┌─────────────┐          ┌────────────┐
            │  Existing  │          │   Safety   │
            │ Workflows  │          │   Systems  │
            └─────────────┘          └────────────┘
```

### State Machine

```
                    ┌─────────────┐
                    │    idle     │
                    └──────┬──────┘
                           │ setGoal()
                           ▼
                    ┌─────────────┐
                    │  planning   │
                    └──────┬──────┘
                           │ plan ready
                           ▼
                    ┌─────────────┐
                    │  executing  │◄──────────────────┐
                    └──────┬──────┘                   │
                           │                          │
            ┌──────────────┴──────────────┐          │
            │                             │          │
       ▼    │                        ▼    │          │
   ┌────────┐│                    ┌────────┐│         │
   │success││                    │  error ││         │
   └───┬────┘│                    └───┬────┘│         │
       │     │                         │     │         │
       ▼     │                         ▼     │         │
┌──────────┐ │                  ┌──────────┐│         │
│reviewing │ │                  │error-    ││         │
└────┬─────┘ │                  │recovery  ││         │
     │       │                  └────┬─────┘│         │
     │       │                       │      │         │
     ▼       │                       ▼      │         │
┌──────────┐ │                  ┌──────────┐│         │
│committing│ │                  │  stopped  │◄─────────┘
└────┬─────┘ │                  └──────────┘
     │       │
     ▼       │
┌──────────┐ │
│  idle    │◄┘
└──────────┘
```

### Workflow Mapping

Tasks map to existing workflows:

```typescript
WORKFLOW_MAPPING = {
  feature   → 'plan'    → plan.workflow.ts
  bugfix    → 'fix'     → fix.workflow.ts
  refactor  → 'code'    → code.workflow.ts
  test      → 'code'    → code.workflow.ts
  docs      → 'code'    → code.workflow.ts
  review    → 'review'  → review.workflow.ts
  commit    → 'commit'  → commit.workflow.ts
  analysis  → 'plan'    → plan.workflow.ts
  other     → 'plan'    → plan.workflow.ts
}
```

---

## Phase 1: Foundation (Week 1-2)

### Overview
Build the core infrastructure for the autonomous agent system.

### Task Breakdown

#### 1.1 Project Structure Setup (0.5 days)

**Files to Create:**
```
packages/cli/src/agent/
├── index.ts                    # Main exports
├── orchestrator.ts             # Agent orchestrator (NEW)
├── state-manager.ts            # State persistence
├── config.ts                   # Configuration with Zod validation
├── logger.ts                   # Structured logging
├── metrics.ts                  # Metrics collection
├── safety/
│   ├── approval.ts            # Approval management
│   ├── checks.ts              # Safety checks
│   └── interrupt.ts           # Interrupt handling
├── types.ts                    # Core type definitions (REVISED)
├── constants.ts                # Constants and mappings (NEW)
└── errors.ts                   # Agent-specific errors (NEW)
```

---

#### 1.2 Core Type Definitions (1 day)

**File:** `packages/cli/src/agent/types.ts`

**Changes from v1:**
- Priority is now an enum
- Added state transition types
- Added workflow result types
- Improved error types

```typescript
/**
 * Core type definitions for the autonomous agent system
 */

import type { z } from 'zod'
import type { Logger } from '@polka-codes/core'

/**
 * Agent operation modes with explicit state machine
 */
export type AgentMode =
  | 'idle'           // Ready to accept goals
  | 'planning'       // Decomposing goal into tasks
  | 'executing'      // Running tasks
  | 'reviewing'      // Reviewing execution results
  | 'committing'     // Committing changes
  | 'error-recovery' // Recovering from errors
  | 'stopped'        // Gracefully stopped

/**
 * Valid state transitions
 */
export type StateTransition = {
  from: AgentMode
  to: AgentMode
  condition?: () => boolean | Promise<boolean>
}

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
  CRITICAL = 1000,  // Build failures, security issues, data loss
  HIGH = 800,       // Test failures, type errors, bugs
  MEDIUM = 600,     // Refactoring, documentation, coverage
  LOW = 400,        // Nice-to-have features, optimizations
  TRIVIAL = 200     // Style fixes, minor cleanups
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
  | 'test'
  | 'docs'
  | 'review'
  | 'commit'
  | 'analysis'
  | 'other'

/**
 * Task execution status
 */
export type TaskStatus = 'pending' | 'in-progress' | 'completed' | 'failed' | 'blocked' | 'skipped'

/**
 * Workflow names (mapped to existing workflows)
 */
export type WorkflowName =
  | 'plan'
  | 'code'
  | 'review'
  | 'fix'
  | 'commit'
  | 'test'
  | 'refactor'
  | 'analyze'

/**
 * Priority calculation result
 */
export interface PriorityResult {
  priority: Priority
  reason: string
}

/**
 * Agent configuration (with Zod validation)
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
  continuousImprovement: {
    /** Sleep time between cycles when no tasks found (ms) */
    sleepTimeOnNoTasks: number

    /** Sleep time between tasks (ms) */
    sleepTimeBetweenTasks: number

    /** Maximum cycles before forced shutdown (0 = infinite) */
    maxCycles: number
  }

  /** Discovery settings */
  discovery: {
    /** Enable/disable specific strategies */
    enabledStrategies: string[]

    /** Cache discovery results (ms) */
    cacheTime: number

    /** Only run discovery if git status shows changes */
    checkChanges: boolean
  }
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
 * Task definition (REVISED)
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
 * Error classification (improved)
 */
export type ErrorType =
  | 'transient'      // Network issues, timeouts (retry)
  | 'validation'     // Schema failures, invalid input (fix or skip)
  | 'test-failure'   // Test failures (fix)
  | 'permission'     // File permissions (user intervention)
  | 'fatal'          // Cannot continue (stop)
  | 'unknown'        // Uncertain (ask user)

/**
 * Execution record for learning (future work)
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
}

/**
 * Plan for achieving a goal
 */
export interface Plan {
  /** Goal description */
  goal: string

  /** High-level plan */
  highLevelPlan: string

  /** Tasks to execute */
  tasks: Task[]

  /** Execution order (phases of parallel tasks) */
  executionOrder: string[][]

  /** Estimated total time (minutes) */
  estimatedTime: number

  /** Identified risks */
  risks: string[]

  /** Dependencies between tasks */
  dependencies: TaskDependency[]
}

/**
 * Task dependency
 */
export interface TaskDependency {
  /** Task ID */
  taskId: string

  /** Depends on task IDs */
  dependsOn: string[]

  /** Dependency type */
  type: 'hard' | 'soft'
}

/**
 * Goal decomposition result
 */
export interface GoalDecompositionResult {
  /** Original goal */
  goal: string

  /** Identified requirements */
  requirements: string[]

  /** High-level plan */
  highLevelPlan: string

  /** Tasks to execute */
  tasks: Task[]

  /** Estimated complexity */
  estimatedComplexity: TaskComplexity

  /** Dependencies */
  dependencies: TaskDependency[]

  /** Identified risks */
  risks: string[]
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
```

---

#### 1.3 Constants and Mappings (0.5 days)

**File:** `packages/cli/src/agent/constants.ts` (NEW)

```typescript
import { TaskType, WorkflowName } from './types'

/**
 * Mapping of task types to workflows
 */
export const WORKFLOW_MAPPING: Record<TaskType, WorkflowName> = {
  feature: 'plan',
  bugfix: 'fix',
  refactor: 'code',
  test: 'code',
  docs: 'code',
  review: 'review',
  commit: 'commit',
  analysis: 'plan',
  other: 'plan'
}

/**
 * Default discovery strategies
 */
export const DEFAULT_DISCOVERY_STRATEGIES = [
  'build-errors',
  'failing-tests',
  'type-errors',
  'lint-issues'
] as const

/**
 * Advanced discovery strategies
 */
export const ADVANCED_DISCOVERY_STRATEGIES = [
  'test-coverage',
  'code-quality',
  'refactoring',
  'documentation',
  'security'
] as const

/**
 * All discovery strategies
 */
export const ALL_DISCOVERY_STRATEGIES = [
  ...DEFAULT_DISCOVERY_STRATEGIES,
  ...ADVANCED_DISCOVERY_STRATEGIES
] as const

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
  { from: ['*'], to: 'stopped', label: 'interrupt' }
]

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG = {
  strategy: 'goal-directed' as const,
  continueOnCompletion: false,
  maxIterations: 0,
  timeout: 0,
  requireApprovalFor: 'destructive' as const,
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
    maxFilesChanged: 20
  },
  continuousImprovement: {
    sleepTimeOnNoTasks: 60000,      // 1 minute
    sleepTimeBetweenTasks: 5000,    // 5 seconds
    maxCycles: 0                    // infinite
  },
  discovery: {
    enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES],
    cacheTime: 300000,              // 5 minutes
    checkChanges: true
  }
}

/**
 * Configuration presets
 */
export const CONFIG_PRESETS: Record<string, Partial<AgentConfig>> = {
  conservative: {
    requireApprovalFor: 'all',
    autoApproveSafeTasks: false,
    maxAutoApprovalCost: 0,
    pauseOnError: true,
    maxConcurrency: 1,
    discovery: {
      enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES],
      cacheTime: 300000,
      checkChanges: true
    }
  },

  balanced: {
    requireApprovalFor: 'destructive',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 10,
    pauseOnError: true,
    maxConcurrency: 1,
    discovery: {
      enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES],
      cacheTime: 300000,
      checkChanges: true
    }
  },

  aggressive: {
    requireApprovalFor: 'none',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 30,
    pauseOnError: false,
    maxConcurrency: 2,
    discovery: {
      enabledStrategies: [...ALL_DISCOVERY_STRATEGIES],
      cacheTime: 600000,
      checkChanges: false
    }
  },

  'continuous-improvement': {
    strategy: 'continuous-improvement',
    continueOnCompletion: true,
    maxIterations: 0,
    requireApprovalFor: 'commits',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 15,
    pauseOnError: false,
    maxConcurrency: 2,
    discovery: {
      enabledStrategies: [...DEFAULT_DISCOVERY_STRATEGIES, 'test-coverage'],
      cacheTime: 300000,
      checkChanges: true
    }
  }
}
```

---

#### 1.4 Custom Error Types (0.5 days)

**File:** `packages/cli/src/agent/errors.ts` (NEW)

```typescript
/**
 * Base agent error
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

/**
 * Invalid state transition error
 */
export class StateTransitionError extends AgentError {
  constructor(
    from: string,
    to: string,
    reason?: string
  ) {
    super(
      `Invalid state transition from ${from} to ${to}${reason ? ': ' + reason : ''}`,
      'INVALID_STATE_TRANSITION',
      { from, to }
    )
    this.name = 'StateTransitionError'
  }
}

/**
 * Task execution error
 */
export class TaskExecutionError extends AgentError {
  constructor(
    taskId: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(
      `Task ${taskId} failed: ${message}`,
      'TASK_EXECUTION_FAILED',
      { taskId }
    )
    this.name = 'TaskExecutionError'
  }
}

/**
 * Workflow invocation error
 */
export class WorkflowInvocationError extends AgentError {
  constructor(
    workflow: string,
    message: string,
    public readonly originalError?: Error
  ) {
    super(
      `Workflow ${workflow} failed: ${message}`,
      'WORKFLOW_INVOCATION_FAILED',
      { workflow }
    )
    this.name = 'WorkflowInvocationError'
  }
}

/**
 * State corruption error
 */
export class StateCorruptionError extends AgentError {
  constructor(message: string, public readonly details?: any) {
    super(
      `Agent state corrupted: ${message}`,
      'STATE_CORRUPTION',
      details
    )
    this.name = 'StateCorruptionError'
  }
}

/**
 * Resource limit exceeded error
 */
export class ResourceLimitError extends AgentError {
  constructor(
    limit: string,
    current: number,
    max: number
  ) {
    super(
      `Resource limit exceeded: ${limit} (${current}/${max})`,
      'RESOURCE_LIMIT_EXCEEDED',
      { limit, current, max }
    )
    this.name = 'ResourceLimitError'
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends AgentError {
  constructor(
    message: string,
    public readonly validationErrors: string[]
  ) {
    super(
      `Configuration validation failed: ${message}`,
      'CONFIG_VALIDATION_FAILED',
      { errors: validationErrors }
    )
    this.name = 'ConfigValidationError'
  }
}
```

---

#### 1.5 Configuration System with Zod (1 day)

**File:** `packages/cli/src/agent/config.ts`

**Changes:** Added Zod schema validation

```typescript
import { z } from 'zod'
import type { AgentConfig, ApprovalLevel, AgentStrategy } from './types'
import { DEFAULT_AGENT_CONFIG, CONFIG_PRESETS } from './constants'
import { ConfigValidationError } from './errors'

/**
 * Zod schema for AgentConfig
 */
const ResourceLimitsSchema = z.object({
  maxMemory: z.number().int().positive().default(2048),
  maxCpuPercent: z.number().int().min(1).max(100).default(80),
  maxTaskExecutionTime: z.number().int().positive().default(60),
  maxSessionTime: z.number().int().positive().default(480),
  maxFilesChanged: z.number().int().positive().default(20)
})

const ContinuousImprovementConfigSchema = z.object({
  sleepTimeOnNoTasks: z.number().int().positive().default(60000),
  sleepTimeBetweenTasks: z.number().int().nonnegative().default(5000),
  maxCycles: z.number().int().nonnegative().default(0)
})

const DiscoveryConfigSchema = z.object({
  enabledStrategies: z.array(z.string()).min(1),
  cacheTime: z.number().int().positive().default(300000),
  checkChanges: z.boolean().default(true)
})

export const AgentConfigSchema = z.object({
  strategy: z.enum(['goal-directed', 'continuous-improvement']).default('goal-directed'),
  continueOnCompletion: z.boolean().default(false),
  maxIterations: z.number().int().nonnegative().default(0),
  timeout: z.number().int().nonnegative().default(0),
  requireApprovalFor: z.enum(['none', 'destructive', 'commits', 'all']).default('destructive'),
  pauseOnError: z.boolean().default(true),
  workingBranch: z.string().default('main'),
  maxConcurrency: z.number().int().min(1).default(1),
  autoSaveInterval: z.number().int().min(1000).default(30000),
  enableProgress: z.boolean().default(true),
  destructiveOperations: z.array(z.string()).default([]),
  maxAutoApprovalCost: z.number().int().nonnegative().default(5),
  autoApproveSafeTasks: z.boolean().default(true),
  resourceLimits: ResourceLimitsSchema.default(DEFAULT_AGENT_CONFIG.resourceLimits),
  continuousImprovement: ContinuousImprovementConfigSchema.default(DEFAULT_AGENT_CONFIG.continuousImprovement),
  discovery: DiscoveryConfigSchema.default(DEFAULT_AGENT_CONFIG.discovery)
})

/**
 * Type guard for AgentConfig
 */
export function isValidAgentConfig(config: unknown): config is AgentConfig {
  try {
    AgentConfigSchema.parse(config)
    return true
  } catch {
    return false
  }
}

/**
 * Validate configuration with Zod
 */
export function validateConfig(config: unknown): AgentConfig {
  try {
    return AgentConfigSchema.parse(config)
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.errors.map(e =>
        `${e.path.join('.')}: ${e.message}`
      )
      throw new ConfigValidationError(
        'Configuration validation failed',
        errors
      )
    }
    throw error
  }
}

/**
 * Load configuration from CLI options and config file
 */
export async function loadConfig(
  cliOptions: Partial<AgentConfig>,
  configPath?: string
): Promise<AgentConfig> {
  // Start with defaults
  let config: AgentConfig = { ...DEFAULT_AGENT_CONFIG }

  // Apply preset if specified
  if (cliOptions.preset && CONFIG_PRESETS[cliOptions.preset]) {
    config = mergeConfig(config, CONFIG_PRESETS[cliOptions.preset])
  }

  // Load from file if exists
  if (configPath) {
    const fileConfig = await loadConfigFromFile(configPath)
    config = mergeConfig(config, fileConfig)
  }

  // Apply CLI options (highest priority)
  config = mergeConfig(config, cliOptions)

  // Validate configuration
  return validateConfig(config)
}

/**
 * Merge two configurations (second overrides first)
 */
export function mergeConfig(
  base: AgentConfig,
  override: Partial<AgentConfig>
): AgentConfig {
  return {
    ...base,
    ...override,
    resourceLimits: {
      ...base.resourceLimits,
      ...(override.resourceLimits || {})
    },
    continuousImprovement: {
      ...base.continuousImprovement,
      ...(override.continuousImprovement || {})
    },
    discovery: {
      ...base.discovery,
      ...(override.discovery || {})
    }
  }
}

/**
 * Load configuration from file
 */
async function loadConfigFromFile(configPath: string): Promise<Partial<AgentConfig>> {
  try {
    const fs = await import('node:fs/promises')
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}
```

---

#### 1.6 Agent State Manager (2 days)

**File:** `packages/cli/src/agent/state-manager.ts`

**No major changes from v1**, but add error handling for corrupted state:

```typescript
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AgentState, AgentConfig } from './types'
import { StateCorruptionError } from './errors'

export class AgentStateManager {
  // ... (implementation from v1)

  /**
   * Load existing state from disk with corruption handling
   */
  async loadState(): Promise<AgentState | null> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8')

      // Validate JSON structure
      const state = JSON.parse(content)

      // Basic validation
      if (!state.sessionId || !state.currentMode || !state.config) {
        throw new StateCorruptionError('Missing required fields in state file')
      }

      this.state = state
      return this.state
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null // No existing state
      }

      if (error instanceof StateCorruptionError) {
        throw error
      }

      throw new StateCorruptionError(
        'Failed to load state file',
        { originalError: error }
      )
    }
  }

  // ... rest of implementation
}
```

**Acceptance Criteria:**
- [ ] State can be initialized, saved, and loaded
- [ ] Corrupted state files are detected
- [ ] Backup/restore mechanism works
- [ ] Auto-save timer starts and stops correctly
- [ ] Checkpoints can be created and restored
- [ ] All methods have error handling
- [ ] 100% test coverage

---

#### 1.7 Structured Logger (1 day)

**File:** `packages/cli/src/agent/logger.ts`

**Changes:** Fixed missing `discovery` method from v1

```typescript
import type { Logger } from '@polka-codes/core'
import type { Task, AgentMetrics } from './types'
import * as fs from 'node:fs/promises'

export class AgentLogger {
  private logger: Logger
  private logFile: string
  private sessionId: string

  constructor(logger: Logger, logFile: string, sessionId: string) {
    this.logger = logger
    this.logFile = logFile
    this.sessionId = sessionId
  }

  /**
   * Log task-related message
   */
  task(task: Task, message: string, meta?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'task',
      taskId: task.id,
      taskType: task.type,
      taskTitle: task.title,
      message,
      ...meta
    }

    this.logger.info(`[${task.id}] ${message}`)
    this.writeToFile(logEntry)
  }

  /**
   * Log workflow-related message
   */
  workflow(workflow: string, message: string, meta?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'workflow',
      workflow,
      message,
      ...meta
    }

    this.logger.info(`[${workflow}] ${message}`)
    this.writeToFile(logEntry)
  }

  /**
   * Log milestone/phase change
   */
  milestone(message: string, meta?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'milestone',
      message,
      ...meta
    }

    this.logger.info(`[MILESTONE] ${message}`)
    this.writeToFile(logEntry)
  }

  /**
   * Log discovery result (FIXED - was missing in v1)
   */
  discovery(strategy: string, tasksFound: number, meta?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'discovery',
      strategy,
      tasksFound,
      ...meta
    }

    this.logger.info(`[Discovery] ${strategy}: found ${tasksFound} tasks`)
    this.writeToFile(logEntry)
  }

  /**
   * Log state transition
   */
  stateTransition(from: string, to: string, reason?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'state-transition',
      from,
      to,
      reason
    }

    this.logger.info(`[State] ${from} → ${to}${reason ? ` (${reason})` : ''}`)
    this.writeToFile(logEntry)
  }

  /**
   * Log metrics update
   */
  metrics(metrics: AgentMetrics): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'debug',
      type: 'metrics',
      ...metrics
    }

    this.logger.debug(`[Metrics] Tasks: ${metrics.tasksCompleted}/${metrics.totalTasks}`)
    this.writeToFile(logEntry)
  }

  /**
   * Log approval request
   */
  approval(task: Task, approved: boolean, reason?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'approval',
      taskId: task.id,
      taskTitle: task.title,
      approved,
      reason,
      action: approved ? 'approved' : 'rejected'
    }

    this.logger.info(`[Approval] ${approved ? '✓' : '✗'} ${task.title}`)
    this.writeToFile(logEntry)
  }

  /**
   * Log error with context
   */
  error(context: string, error: Error, meta?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'error',
      type: 'error',
      context,
      message: error.message,
      stack: error.stack,
      ...meta
    }

    this.logger.error(`[${context}] ${error.message}`)
    this.writeToFile(logEntry)
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: any): Promise<void> {
    try {
      await fs.appendFile(this.logFile, JSON.stringify(entry) + '\n')
    } catch (error) {
      // Silently fail to avoid infinite loops
      console.error('Failed to write to log file:', error)
    }
  }
}
```

---

#### 1.8 Metrics Collector (1 day)

**File:** `packages/cli/src/agent/metrics.ts`

**No major changes from v1**, but add success rate calculation:

```typescript
import type { AgentMetrics, Task, TaskResult, ExecutionRecord } from './types'

export class MetricsCollector {
  // ... (implementation from v1)

  /**
   * Get current metrics with success rate
   */
  getMetrics(): AgentMetrics {
    // Update total execution time
    this.metrics.totalExecutionTime = Date.now() - this.startTime

    // Calculate success rate
    const total = this.metrics.tasksCompleted + this.metrics.tasksFailed
    this.metrics.successRate = total > 0
      ? (this.metrics.tasksCompleted / total) * 100
      : 0

    return { ...this.metrics }
  }

  // ... rest of implementation
}
```

---

#### 1.9 Safety Systems (3 days)

**1.9.1 Approval Manager** (1 day)

**File:** `packages/cli/src/agent/safety/approval.ts`

**Changes:** Use Priority enum instead of raw numbers

```typescript
import type { ApprovalDecision, ApprovalLevel, Task, Priority } from '../types'
import type { Logger } from '@polka-codes/core'
import { getUserInput } from '../../utils/userInput'
import { Priority } from '../types' // Import enum

export class ApprovalManager {
  constructor(
    private logger: Logger,
    private approvalLevel: ApprovalLevel,
    private autoApproveSafeTasks: boolean,
    private maxAutoApprovalCost: number,
    private destructiveOperations: string[]
  ) {}

  /**
   * Check if task requires approval
   */
  requiresApproval(task: Task): boolean {
    // Always approve if level is 'none'
    if (this.approvalLevel === 'none') {
      return false
    }

    // Always require approval for all tasks if level is 'all'
    if (this.approvalLevel === 'all') {
      return true
    }

    // Check if task is destructive
    if (this.isDestructive(task)) {
      return true
    }

    // Require approval for commits if level is 'commits'
    if (this.approvalLevel === 'commits' && task.type === 'commit') {
      return true
    }

    // Auto-approve safe tasks if within time threshold and low priority
    if (
      this.autoApproveSafeTasks &&
      task.estimatedTime <= this.maxAutoApprovalCost &&
      task.priority === Priority.TRIVIAL
    ) {
      return false
    }

    return true
  }

  /**
   * Request user approval for a task
   */
  async requestApproval(task: Task): Promise<ApprovalDecision> {
    this.logger.info('\n' + '═'.repeat(60))
    this.logger.info(`🤖 Approval Required: ${task.title}`)
    this.logger.info('═'.repeat(60))
    this.logger.info(`📝 Description: ${task.description}`)
    this.logger.info(`🏷️  Type: ${task.type}`)
    this.logger.info(`⚖️  Complexity: ${task.complexity}`)
    this.logger.info(`📊 Priority: ${Priority[task.priority]} (${task.priority})`)
    this.logger.info(`⏱️  Estimated Time: ${task.estimatedTime} minutes`)
    if (task.files.length > 0) {
      this.logger.info(`📁 Files: ${task.files.join(', ')}`)
    }
    this.logger.info('═'.repeat(60))

    const answer = await getUserInput('\n✅ Approve this task? (yes/no/skip)')

    if (!answer) {
      return { approved: false, reason: 'No response' }
    }

    const normalized = answer.toLowerCase().trim()

    if (normalized === 'yes' || normalized === 'y') {
      return { approved: true }
    }

    if (normalized === 'skip') {
      return { approved: false, reason: 'Skipped by user' }
    }

    return { approved: false, reason: 'Rejected by user' }
  }

  /**
   * Check if task is destructive
   */
  private isDestructive(task: Task): boolean {
    // Check if task type is in destructive list
    if (this.destructiveOperations.includes(task.type)) {
      return true
    }

    // Check if task affects many files
    if (task.files.length > 10) {
      return true
    }

    // Check description for destructive keywords
    const destructiveKeywords = ['delete', 'remove', 'force', 'reset', 'drop']
    const description = task.description.toLowerCase()
    if (destructiveKeywords.some(kw => description.includes(kw))) {
      return true
    }

    return false
  }
}
```

**1.9.2 Safety Checker** (1 day)

No major changes from v1.

**1.9.3 Interrupt Handler** (1 day)

No major changes from v1.

---

#### 1.10 CLI Command Integration (1 day)

**File:** `packages/cli/src/commands/autonomous.ts`

No major changes from v1.

**Phase 1 Acceptance Criteria:**
- [ ] All type definitions created with Priority enum
- [ ] Constants file with mappings created
- [ ] Custom error types implemented
- [ ] Configuration validated with Zod
- [ ] State manager handles corruption
- [ ] Logger has all required methods
- [ ] Metrics calculates success rate
- [ ] Safety systems work correctly
- [ ] CLI command registered and working

---

## Phase 2: Core Execution (Week 3-5)

### Overview
**Extended from 2 to 3 weeks** for more realistic implementation.
Enable the agent to accept goals, break them down into tasks, and execute them to completion.
Review and quality gates moved to Phase 4.

### Task Breakdown

#### 2.1 Agent Orchestrator (CRITICAL - 3 days)

**File:** `packages/cli/src/agent/orchestrator.ts`

**This is the MISSING piece from v1.** Complete implementation:

```typescript
import type { AgentConfig, AgentMode, AgentState, Plan, Task, ProgressReport } from './types'
import { StateTransitionError, TaskExecutionError } from './errors'
import { AgentStateManager } from './state-manager'
import { AgentLogger } from './logger'
import { MetricsCollector } from './metrics'
import { ApprovalManager } from './safety/approval'
import { SafetyChecker } from './safety/checks'
import { InterruptHandler } from './safety/interrupt'
import { GoalDecomposer } from './goal-decomposer'
import { TaskPlanner } from './planner'
import { TaskExecutor } from './executor'
import { STATE_TRANSITIONS } from './constants'

/**
 * Main autonomous agent orchestrator
 * Manages state machine and coordinates all components
 */
export class AutonomousAgent {
  private stateManager: AgentStateManager
  private logger: AgentLogger
  private metrics: MetricsCollector
  private approvalManager: ApprovalManager
  private safetyChecker: SafetyChecker
  private interruptHandler: InterruptHandler
  private goalDecomposer: GoalDecomposer
  private taskPlanner: TaskPlanner
  private taskExecutor: TaskExecutor

  private state: AgentState | null = null
  private running: boolean = false

  constructor(
    private config: AgentConfig,
    private workflowContext: any
  ) {
    // Initialize components
    this.stateManager = new AgentStateManager(
      workflowContext.stateDir,
      `agent-${Date.now()}`
    )

    this.logger = new AgentLogger(
      workflowContext.logger,
      `${workflowContext.stateDir}/agent.log`,
      `agent-${Date.now()}`
    )

    this.metrics = new MetricsCollector()
    this.approvalManager = new ApprovalManager(
      workflowContext.logger,
      config.requireApprovalFor,
      config.autoApproveSafeTasks,
      config.maxAutoApprovalCost,
      config.destructiveOperations
    )

    this.safetyChecker = new SafetyChecker(
      workflowContext.logger,
      workflowContext.tools
    )

    this.interruptHandler = new InterruptHandler(
      workflowContext.logger,
      this
    )

    this.goalDecomposer = new GoalDecomposer(workflowContext)
    this.taskPlanner = new TaskPlanner(workflowContext)
    this.taskExecutor = new TaskExecutor(workflowContext, this.logger)
  }

  /**
   * Initialize agent state
   */
  async initialize(): Promise<void> {
    this.state = await this.stateManager.initialize(this.config)
    this.stateManager.startAutoSave(this.config.autoSaveInterval)

    this.logger.milestone('Agent initialized', {
      sessionId: this.state.sessionId,
      strategy: this.config.strategy
    })
  }

  /**
   * Load existing agent state
   */
  async loadState(): Promise<void> {
    this.state = await this.stateManager.loadState()

    if (!this.state) {
      throw new Error('No existing state found')
    }

    this.logger.milestone('Agent state loaded', {
      sessionId: this.state.sessionId,
      mode: this.state.currentMode
    })
  }

  /**
   * Set goal and transition to planning mode
   */
  async setGoal(goal: string): Promise<void> {
    if (!this.state) {
      throw new Error('Agent not initialized')
    }

    this.transitionState('idle', 'planning', 'setGoal')

    this.state.currentGoal = goal
    await this.stateManager.updateState({ currentGoal: goal })

    this.logger.milestone('Goal set', { goal })
  }

  /**
   * Run the agent
   */
  async run(): Promise<void> {
    if (!this.state) {
      throw new Error('Agent not initialized')
    }

    this.running = true

    try {
      if (this.config.strategy === 'goal-directed') {
        await this.runGoalDirected()
      } else {
        await this.runContinuousImprovement()
      }
    } finally {
      this.running = false
    }
  }

  /**
   * Run in goal-directed mode
   */
  private async runGoalDirected(): Promise<void> {
    if (!this.state?.currentGoal) {
      throw new Error('No goal set')
    }

    // Phase 1: Planning
    await this.planningPhase()

    // Phase 2: Execution
    await this.executionPhase()

    // Phase 3: Reviewing
    await this.reviewingPhase()

    // Phase 4: Committing
    await this.committingPhase()

    // Done
    this.transitionState(this.state.currentMode, 'idle', 'goal complete')
  }

  /**
   * Planning phase - decompose goal into tasks
   */
  private async planningPhase(): Promise<void> {
    this.logger.milestone('Entering planning phase')

    const decomposition = await this.goalDecomposer.decompose(this.state!.currentGoal!)

    this.logger.info(`Decomposed goal into ${decomposition.tasks.length} tasks`)
    this.logger.info(decomposition.highLevelPlan)

    // Create execution plan
    const plan = this.taskPlanner.createPlan(
      this.state!.currentGoal!,
      decomposition.tasks
    )

    // Update state
    await this.stateManager.updateState({
      taskQueue: plan.tasks,
      currentMode: 'executing'
    })

    this.logger.info(`Plan created with ${plan.executionOrder.length} phases`)
    this.logger.info(`Estimated time: ${plan.estimatedTime} minutes`)

    if (plan.risks.length > 0) {
      this.logger.warn(`Identified ${plan.risks.length} risks:`)
      plan.risks.forEach(risk => this.logger.warn(`  - ${risk}`))
    }
  }

  /**
   * Execution phase - execute tasks
   */
  private async executionPhase(): Promise<void> {
    this.logger.milestone('Entering execution phase')

    const state = this.state!
    let executedCount = 0

    for (const task of state.taskQueue) {
      if (task.status === 'completed') continue

      // Check dependencies
      if (!this.areDependenciesMet(task, state.completedTasks)) {
        this.logger.info(`Task ${task.id} blocked by dependencies`)
        continue
      }

      // Execute task
      await this.executeTask(task)
      executedCount++
    }

    this.logger.milestone(`Execution phase complete`, {
      tasksExecuted: executedCount
    })
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: Task): Promise<void> {
    const state = this.state!

    this.logger.task(task, `Starting execution`)

    // Update task status
    task.status = 'in-progress'
    task.startedAt = Date.now()
    state.currentTask = task

    await this.stateManager.updateState({
      currentTask: task,
      taskQueue: state.taskQueue
    })

    try {
      // Safety checks
      const safetyResult = await this.safetyChecker.preExecutionCheck(task)
      if (!safetyResult.safe) {
        throw new Error(`Safety checks failed: ${safetyResult.failed.map(f => f.message).join(', ')}`)
      }

      // Approval if required
      if (this.approvalManager.requiresApproval(task)) {
        const decision = await this.approvalManager.requestApproval(task)
        if (!decision.approved) {
          task.status = 'skipped'
          this.logger.approval(task, false, decision.reason)
          return
        }
      }

      // Execute
      const result = await this.taskExecutor.execute(task, state)

      if (result.success) {
        task.status = 'completed'
        task.completedAt = Date.now()
        task.result = result

        state.completedTasks.push(task)

        this.logger.task(task, `Completed successfully`)
      } else {
        throw result.error
      }

    } catch (error) {
      task.status = 'failed'
      task.error = {
        message: error instanceof Error ? error.message : String(error),
        type: 'unknown',
        context: 'task-execution',
        retryable: false
      }

      state.failedTasks.push(task)

      this.logger.error(`Task ${task.id}`, error as Error)

      // Transition to error recovery
      this.transitionState(state.currentMode, 'error-recovery', 'task failed')

      // Handle error
      await this.handleTaskError(task, error as Error)
    }

    await this.stateManager.updateState({
      currentTask: undefined,
      taskQueue: state.taskQueue,
      completedTasks: state.completedTasks,
      failedTasks: state.failedTasks
    })
  }

  /**
   * Reviewing phase - review execution results
   */
  private async reviewingPhase(): Promise<void> {
    this.logger.milestone('Entering reviewing phase')

    // For MVP, just log summary
    // Full review implementation in Phase 4
    const state = this.state!

    this.logger.info(`Completed: ${state.completedTasks.length}`)
    this.logger.info(`Failed: ${state.failedTasks.length}`)

    if (state.failedTasks.length === 0) {
      this.transitionState(state.currentMode, 'committing', 'review passed')
    } else {
      this.transitionState(state.currentMode, 'error-recovery', 'review failed')
    }
  }

  /**
   * Committing phase - commit changes
   */
  private async committingPhase(): Promise<void> {
    this.logger.milestone('Entering committing phase')

    const state = this.state!

    // Check if approval needed
    const commitTask: Task = {
      id: `commit-${Date.now()}`,
      type: 'commit',
      title: 'Commit changes',
      description: 'Commit all changes from this session',
      priority: 800, // HIGH
      complexity: 'low',
      dependencies: [],
      estimatedTime: 2,
      status: 'pending',
      files: [],
      workflow: 'commit',
      workflowInput: {},
      retryCount: 0,
      createdAt: Date.now()
    }

    if (this.approvalManager.requiresApproval(commitTask)) {
      const decision = await this.approvalManager.requestApproval(commitTask)
      if (!decision.approved) {
        this.logger.info('Commit skipped by user')
        return
      }
    }

    // Execute commit workflow
    // ... implementation

    this.transitionState(state.currentMode, 'idle', 'committed')
  }

  /**
   * Run in continuous improvement mode
   */
  private async runContinuousImprovement(): Promise<void> {
    this.logger.milestone('Starting continuous improvement mode')

    const config = this.config.continuousImprovement
    let cycles = 0

    while (
      this.running &&
      !this.interruptHandler.shouldStop() &&
      (config.maxCycles === 0 || cycles < config.maxCycles)
    ) {
      this.logger.info(`[Continuous] Cycle ${cycles + 1}`)

      // Discover tasks
      // ... (discovery logic)

      // If no tasks found, wait and retry
      // ... (wait logic)

      cycles++

      // Small sleep between tasks
      if (config.sleepTimeBetweenTasks > 0) {
        await this.sleep(config.sleepTimeBetweenTasks)
      }
    }

    this.logger.milestone('Continuous improvement stopped', {
      cycles
    })
  }

  /**
   * Handle task error
   */
  private async handleTaskError(task: Task, error: Error): Promise<void> {
    const state = this.state!

    if (this.config.pauseOnError) {
      this.logger.error('Task execution paused', error)

      // Ask user what to do
      const answer = await getUserInput(
        '\n❌ Task failed. Continue? (yes/no/retry)'
      )

      if (answer?.toLowerCase() === 'retry') {
        // Retry task
        task.retryCount++
        await this.executeTask(task)
      } else if (answer?.toLowerCase() === 'yes') {
        // Continue with next task
        this.transitionState('error-recovery', 'executing', 'user chose to continue')
      } else {
        // Stop
        this.transitionState('error-recovery', 'stopped', 'user chose to stop')
      }
    } else {
      // Auto-continue
      this.transitionState('error-recovery', 'executing', 'auto-continue')
    }
  }

  /**
   * Transition state with validation
   */
  private transitionState(from: AgentMode, to: AgentMode, reason: string): void {
    if (!this.state) return

    // Validate transition
    const valid = STATE_TRANSITIONS.some(t =>
      (t.from === '*' || t.from.includes(from)) && t.to === to
    )

    if (!valid) {
      throw new StateTransitionError(from, to, reason)
    }

    const previousMode = this.state.currentMode
    this.state.currentMode = to
    this.state.previousMode = previousMode

    // Record transition
    this.state.timestamps.modeTransitions.push({
      from,
      to,
      timestamp: Date.now()
    })

    this.logger.stateTransition(from, to, reason)
  }

  /**
   * Check if task dependencies are met
   */
  private areDependenciesMet(task: Task, completedTasks: Task[]): boolean {
    return task.dependencies.every(depId =>
      completedTasks.some(ct => ct.id === depId)
    )
  }

  /**
   * Stop the agent
   */
  async stop(): Promise<void> {
    this.running = false

    if (this.state) {
      this.transitionState(this.state.currentMode, 'stopped', 'user requested')
    }

    this.logger.milestone('Agent stopped')
  }

  /**
   * Get current progress
   */
  getProgress(): ProgressReport {
    if (!this.state) {
      throw new Error('Agent not initialized')
    }

    const totalTasks = this.state.taskQueue.length
    const completedTasks = this.state.completedTasks.length
    const metrics = this.metrics.getMetrics()

    return {
      mode: this.state.currentMode,
      phase: this.state.currentMode,
      currentTask: this.state.currentTask?.title,
      progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      completedTasks,
      totalTasks,
      estimatedTimeRemaining: 0, // TODO: calculate
      metrics
    }
  }

  /**
   * Save state
   */
  async saveState(): Promise<void> {
    await this.stateManager.saveState()
  }

  /**
   * Get metrics
   */
  getMetrics(): MetricsCollector {
    return this.metrics
  }

  /**
   * Check if has current task
   */
  hasCurrentTask(): boolean {
    return this.state?.currentTask !== undefined
  }

  /**
   * Wait for current task
   */
  async waitForCurrentTask(): Promise<void> {
    while (this.hasCurrentTask() && this.running) {
      await this.sleep(100)
    }
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    this.stateManager.stopAutoSave()
    await this.stateManager.saveState()
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}

/**
 * User input helper
 */
async function getUserInput(prompt: string): Promise<string | undefined> {
  // TODO: implement
  return undefined
}
```

**Acceptance Criteria:**
- [ ] Agent can be initialized and state loaded
- [ ] Goal-directed mode works end-to-end
- [ ] State transitions are validated
- [ ] Tasks are executed in correct order
- [ ] Dependencies are respected
- [ ] Errors trigger recovery mode
- [ ] Progress reports are accurate
- [ ] Cleanup works correctly

---

#### 2.2 Task Executor (CRITICAL - 2 days)

**File:** `packages/cli/src/agent/executor.ts`

**This is another MISSING piece from v1.** Complete implementation:

```typescript
import type { Task, AgentState, WorkflowExecutionResult, TaskResult } from './types'
import { AgentLogger } from './logger'
import { WorkflowInvocationError, TaskExecutionError } from './errors'
import { WORKFLOW_MAPPING } from './constants'

/**
 * Executes tasks by invoking appropriate workflows
 */
export class TaskExecutor {
  constructor(
    private context: any,
    private logger: AgentLogger
  ) {}

  /**
   * Execute a task
   */
  async execute(task: Task, state: AgentState): Promise<WorkflowExecutionResult> {
    this.logger.task(task, 'Executing')

    try {
      // Map task type to workflow
      const workflowName = WORKFLOW_MAPPING[task.type] || 'plan'

      this.logger.workflow(workflowName, `Invoking for task ${task.id}`)

      // Invoke workflow
      const result = await this.invokeWorkflow(workflowName, task.workflowInput)

      this.logger.task(task, 'Execution completed')

      return {
        success: true,
        data: result,
        output: JSON.stringify(result)
      }

    } catch (error) {
      this.logger.error(`Task ${task.id}`, error as Error)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }

  /**
   * Invoke a workflow by name
   */
  private async invokeWorkflow(
    workflowName: string,
    input: any
  ): Promise<any> {
    // Get workflow function
    const workflow = this.getWorkflow(workflowName)
    if (!workflow) {
      throw new WorkflowInvocationError(
        workflowName,
        `Workflow not found: ${workflowName}`
      )
    }

    // Invoke workflow
    try {
      const result = await workflow(input, this.context)

      return result
    } catch (error) {
      throw new WorkflowInvocationError(
        workflowName,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Get workflow function by name
   */
  private getWorkflow(name: string): Function | null {
    // Import workflow dynamically
    switch (name) {
      case 'plan':
        return this.importWorkflow('../workflows/plan.workflow')
      case 'code':
        return this.importWorkflow('../workflows/code.workflow')
      case 'fix':
        return this.importWorkflow('../workflows/fix.workflow')
      case 'review':
        return this.importWorkflow('../workflows/review.workflow')
      case 'commit':
        return this.importWorkflow('../workflows/commit.workflow')
      case 'test':
        return this.importWorkflow('../workflows/test.workflow')
      case 'refactor':
        return this.importWorkflow('../workflows/code.workflow')
      case 'analyze':
        return this.importWorkflow('../workflows/plan.workflow')
      default:
        return null
    }
  }

  /**
   * Import workflow module
   */
  private importWorkflow(path: string): Function | null {
    try {
      // Dynamic import
      const module = require(path)
      return module.default || Object.values(module)[0]
    } catch {
      return null
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Maps task types to workflows correctly
- [ ] Invokes workflows with proper input
- [ ] Handles workflow errors
- [ ] Returns structured results
- [ ] Logs all operations
- [ ] 100% test coverage

---

#### 2.3 Goal Decomposition Engine (3 days)

**File:** `packages/cli/src/agent/goal-decomposer.ts`

**Changes from v1:**
- Uses Priority enum
- Returns Task with proper priorities
- Better integration with existing workflow system

```typescript
import type { GoalDecompositionResult, Plan, Task, WorkflowContext } from './types'
import { runAgentWithSchema } from '../workflows/agent-builder'
import { z } from 'zod'
import { Priority } from './types'
import { WORKFLOW_MAPPING } from './constants'

/**
 * Schema for goal decomposition result
 */
const GoalDecompositionSchema = z.object({
  requirements: z.array(z.string()),
  highLevelPlan: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    type: z.enum(['feature', 'bugfix', 'refactor', 'test', 'docs', 'other']),
    priority: z.enum(['critical', 'high', 'medium', 'low', 'trivial']),
    complexity: z.enum(['low', 'medium', 'high']),
    estimatedTime: z.number(),
    files: z.array(z.string()).optional(),
    dependencies: z.array(z.string()).optional()
  })),
  risks: z.array(z.string())
})

/**
 * Decomposes a high-level goal into actionable tasks
 */
export class GoalDecomposer {
  constructor(private context: WorkflowContext) {}

  /**
   * Decompose goal into implementation plan
   */
  async decompose(goal: string): Promise<GoalDecompositionResult> {
    this.context.logger.info(`[GoalDecomposer] Analyzing goal: ${goal}`)

    // Gather context about codebase
    const codebaseContext = await this.gatherCodebaseContext()

    // Use agent to decompose goal
    const result = await runAgentWithSchema(this.context, {
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildDecompositionPrompt(goal, codebaseContext),
      schema: GoalDecompositionSchema,
      maxToolRoundTrips: 50
    })

    // Convert to tasks with Priority enum
    const tasks = result.tasks.map((t, i) => {
      const priority = this.mapPriority(t.priority)

      return {
        id: `task-${Date.now()}-${i}`,
        type: t.type,
        title: t.title,
        description: t.description,
        priority,
        complexity: t.complexity,
        dependencies: t.dependencies || [],
        estimatedTime: t.estimatedTime,
        status: 'pending' as const,
        files: t.files || [],
        workflow: WORKFLOW_MAPPING[t.type],
        workflowInput: this.buildWorkflowInput(t),
        retryCount: 0,
        createdAt: Date.now()
      }
    })

    // Estimate total complexity
    const complexityScores = { low: 1, medium: 2, high: 3 }
    const avgComplexity =
      tasks.reduce((sum, t) => sum + complexityScores[t.complexity], 0) / tasks.length
    const estimatedComplexity: TaskComplexity =
      avgComplexity < 1.5 ? 'low' : avgComplexity < 2.5 ? 'medium' : 'high'

    return {
      goal,
      requirements: result.requirements,
      highLevelPlan: result.highLevelPlan,
      tasks,
      estimatedComplexity,
      dependencies: this.extractDependencies(tasks),
      risks: result.risks
    }
  }

  /**
   * Map string priority to enum
   */
  private mapPriority(priority: string): Priority {
    switch (priority) {
      case 'critical': return Priority.CRITICAL
      case 'high': return Priority.HIGH
      case 'medium': return Priority.MEDIUM
      case 'low': return Priority.LOW
      case 'trivial': return Priority.TRIVIAL
      default: return Priority.MEDIUM
    }
  }

  /**
   * Build system prompt for goal decomposition
   */
  private buildSystemPrompt(): string {
    return `You are an expert software architect and project manager.

Your task is to:
1. Analyze the given goal and identify requirements
2. Create a high-level implementation plan
3. Break down the plan into specific, actionable tasks
4. Estimate complexity and time for each task
5. Identify dependencies between tasks
6. Flag potential risks

Task Types:
- feature: New functionality to implement
- bugfix: Fixing bugs or errors
- refactor: Improving code structure without changing behavior
- test: Adding or improving tests
- docs: Adding or improving documentation
- other: Tasks that don't fit the above categories

Priority Guidelines:
- critical: Build failures, security issues, data loss (Priority 1000)
- high: Test failures, type errors, bugs (Priority 800)
- medium: Refactoring, documentation, coverage (Priority 600)
- low: Nice-to-have features, optimizations (Priority 400)
- trivial: Style fixes, minor cleanups (Priority 200)

Complexity Guidelines:
- low: Simple, straightforward task (<30 min)
- medium: Moderate complexity, some research needed (30-60 min)
- high: Complex, requires significant work (>60 min)

For each task, specify:
- title: Brief, descriptive title
- description: What needs to be done
- type: One of the task types above
- priority: critical/high/medium/low/trivial
- complexity: low/medium/high
- estimatedTime: Time in minutes
- files: Expected files to be affected (if known)
- dependencies: Array of task titles this task depends on

Be specific and actionable. Break complex tasks into smaller steps.`
  }

  /**
   * Build workflow input for task
   */
  private buildWorkflowInput(task: any): any {
    switch (task.type) {
      case 'feature':
        return {
          prompt: task.description,
          files: task.files || []
        }
      case 'bugfix':
        return {
          error: task.description
        }
      case 'refactor':
        return {
          prompt: task.description,
          files: task.files || []
        }
      case 'test':
        return {
          prompt: `Add tests for: ${task.description}`,
          files: task.files || []
        }
      case 'docs':
        return {
          prompt: task.description,
          files: task.files || []
        }
      default:
        return {
          prompt: task.description
        }
    }
  }

  /**
   * Extract dependencies between tasks
   */
  private extractDependencies(tasks: Task[]): any[] {
    const taskMap = new Map(tasks.map(t => [t.title, t.id]))
    const dependencies: any[] = []

    for (const task of tasks) {
      for (const depTitle of task.dependencies) {
        const depId = taskMap.get(depTitle)
        if (depId) {
          dependencies.push({
            taskId: task.id,
            dependsOn: [depId],
            type: 'hard' as const
          })
        }
      }
    }

    return dependencies
  }

  // ... rest of implementation (same as v1)
}
```

**Acceptance Criteria:**
- [ ] Can decompose simple goals into tasks
- [ ] Tasks have proper dependencies
- [ ] Priorities use enum correctly
- [ ] Complexity estimates are reasonable
- [ ] Workflow mapping is correct
- [ ] Handles errors gracefully

---

#### 2.4 Planning Engine (2 days)

**File:** `packages/cli/src/agent/planner.ts`

**No major changes from v1**, except using Priority enum:

```typescript
import type { Plan, Task, WorkflowContext } from './types'

export class TaskPlanner {
  constructor(private context: WorkflowContext) {}

  createPlan(goal: string, tasks: Task[]): Plan {
    this.context.logger.info(`[Planner] Creating plan with ${tasks.length} tasks`)

    // Resolve dependencies
    const withDependencies = this.resolveDependencies(tasks)

    // Create execution phases
    const executionOrder = this.createExecutionPhases(withDependencies)

    // Estimate total time
    const estimatedTime = withDependencies.reduce((sum, task) => sum + task.estimatedTime, 0)

    return {
      goal,
      highLevelPlan: this.generateHighLevelPlan(goal, withDependencies),
      tasks: withDependencies,
      executionOrder,
      estimatedTime,
      risks: this.identifyRisks(withDependencies),
      dependencies: this.extractDependencyGraph(withDependencies)
    }
  }

  // ... implementation from v1
}
```

**Acceptance Criteria:**
- [ ] Creates valid execution phases
- [ ] Handles circular dependencies
- [ ] Identifies risks correctly
- [ ] Topological sort is correct

---

**Phase 2 Acceptance Criteria:**
- [ ] Orchestrator manages complete lifecycle
- [ ] State machine works correctly
- [ ] Task executor invokes workflows
- [ ] Goals are decomposed properly
- [ ] Plans are created correctly
- [ ] All components integrate
- [ ] Error recovery works
- [ ] Continuous improvement loop doesn't exit prematurely

---

## Phase 3: Continuous Improvement (Week 6-7)

### Overview
Implement the continuous improvement loop that allows the agent to self-discover and execute tasks when no goal is provided.

**Key Change from v1:** Fixed the infinite loop bug where no tasks would stop execution.

### Task Breakdown

#### 3.1 Task Discovery Engine (4 days)

**File:** `packages/cli/src/agent/task-discovery.ts`

**Changes from v1:**
- Smart change detection (checks git status)
- Caching to avoid redundant work
- Uses Priority enum
- Better error handling

```typescript
import type { DiscoveryStrategy, Task, WorkflowContext, PriorityResult } from './types'
import { Priority } from './types'

/**
 * Discovers potential tasks by analyzing codebase
 */
export class TaskDiscoveryEngine {
  private strategies: Map<string, DiscoveryStrategy> = new Map()
  private cache: Map<string, { tasks: Task[], timestamp: number }> = new Map()

  constructor(private context: WorkflowContext) {
    this.registerDefaultStrategies()
  }

  /**
   * Register a discovery strategy
   */
  registerStrategy(strategy: DiscoveryStrategy): void {
    this.strategies.set(strategy.name, strategy)
  }

  /**
   * Discover tasks using all registered strategies
   */
  async discoverTasks(excludeCompleted: string[] = []): Promise<Task[]> {
    this.context.logger.info('[Discovery] Starting task discovery...')

    const allTasks: Task[] = []

    // Check git status if enabled
    const config = this.context.config.discovery
    if (config.checkChanges) {
      const hasChanges = await this.checkGitStatus()
      if (!hasChanges) {
        this.context.logger.info('[Discovery] No changes detected, skipping discovery')
        return []
      }
    }

    // Run each strategy
    for (const [name, strategy] of this.strategies) {
      if (!config.enabledStrategies.includes(name)) {
        this.context.logger.debug(`[Discovery] Skipping disabled strategy: ${name}`)
        continue
      }

      try {
        this.context.logger.debug(`[Discovery] Running strategy: ${name}`)

        // Check cache
        const cached = this.cache.get(name)
        if (cached && Date.now() - cached.timestamp < config.cacheTime) {
          this.context.logger.debug(`[Discovery] Using cached results for ${name}`)
          allTasks.push(...cached.tasks.filter(t => !excludeCompleted.includes(t.id)))
          continue
        }

        // Run strategy
        const tasks = await strategy.execute(this.context)

        // Filter out completed tasks
        const filtered = tasks.filter(t => !excludeCompleted.includes(t.id))

        // Calculate priority
        for (const task of filtered) {
          const priorityResult = strategy.priority(task)
          task.priority = priorityResult.priority
        }

        // Cache results
        this.cache.set(name, { tasks: filtered, timestamp: Date.now() })

        allTasks.push(...filtered)
        this.context.logger.discovery(name, filtered.length)
      } catch (error) {
        this.context.logger.error(`Discovery-${name}`, error as Error)
      }
    }

    this.context.logger.info(`[Discovery] Found ${allTasks.length} total tasks`)
    return allTasks
  }

  /**
   * Check if git working tree has changes
   */
  private async checkGitStatus(): Promise<boolean> {
    try {
      const result = await this.context.tools.executeCommand({
        command: 'git',
        args: ['status', '--porcelain']
      })

      return result.stdout.trim().length > 0
    } catch {
      return true // Assume there are changes if check fails
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
  }

  /**
   * Register default discovery strategies
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy({
      name: 'build-errors',
      description: 'Find and fix build errors',
      enabled: true,
      checkChanges: true,
      execute: async (context) => this.discoverBuildErrors(context),
      priority: (task) => ({ priority: Priority.CRITICAL, reason: 'Build failure' })
    })

    this.registerStrategy({
      name: 'failing-tests',
      description: 'Find and fix failing tests',
      enabled: true,
      checkChanges: true,
      execute: async (context) => this.discoverFailingTests(context),
      priority: (task) => ({ priority: Priority.HIGH, reason: 'Test failure' })
    })

    this.registerStrategy({
      name: 'type-errors',
      description: 'Find and fix type errors',
      enabled: true,
      checkChanges: true,
      execute: async (context) => this.discoverTypeErrors(context),
      priority: (task) => ({ priority: Priority.HIGH, reason: 'Type error' })
    })

    this.registerStrategy({
      name: 'lint-issues',
      description: 'Find and fix lint issues',
      enabled: true,
      checkChanges: true,
      execute: async (context) => this.discoverLintIssues(context),
      priority: (task) => ({ priority: Priority.LOW, reason: 'Lint issue' })
    })
  }

  // ... Discovery strategy implementations (similar to v1, but return PriorityResult)
}
```

**Acceptance Criteria:**
- [ ] Discovers build errors
- [ ] Discovers failing tests
- [ ] Discovers type errors
- [ ] Discovers lint issues
- [ ] Checks git status before running
- [ ] Caches results properly
- [ ] Uses Priority enum
- [ ] Strategies can be enabled/disabled

---

#### 3.2 Continuous Improvement Loop (3 days)

**File:** `packages/cli/src/agent/improvement-loop.ts`

**CRITICAL FIX from v1:** No longer exits when no tasks found

```typescript
import type { Task, WorkflowContext, AgentState } from './types'
import { TaskDiscoveryEngine } from './task-discovery'
import { TaskPlanner } from './planner'
import { TaskExecutor } from './executor'
import { AgentLogger } from './logger'

/**
 * Manages continuous improvement loop
 */
export class ContinuousImprovementLoop {
  private discovery: TaskDiscoveryEngine
  private planner: TaskPlanner
  private executor: TaskExecutor

  constructor(
    private context: WorkflowContext,
    private logger: AgentLogger,
    private state: AgentState
  ) {
    this.discovery = new TaskDiscoveryEngine(context)
    this.planner = new TaskPlanner(context)
    this.executor = new TaskExecutor(context, logger)
  }

  /**
   * Run continuous improvement loop
   * FIXED: No longer exits when no tasks found
   */
  async run(): Promise<void> {
    const config = this.state.config.continuousImprovement
    let cycles = 0

    this.logger.milestone('Starting continuous improvement loop')

    while (
      !this.shouldStop(cycles)
    ) {
      cycles++

      this.logger.info(`[Continuous] Starting cycle ${cycles}`)

      // 1. Discover tasks
      const completedIds = this.state.completedTasks.map(t => t.id)
      const discovered = await this.discovery.discoverTasks(completedIds)

      if (discovered.length === 0) {
        // FIXED: Don't exit, just wait and retry
        this.logger.info('[Continuous] No tasks discovered, waiting...')

        // Sleep for configured time
        await this.sleep(config.sleepTimeOnNoTasks)

        // Clear cache before retry
        this.discovery.clearCache()

        continue
      }

      // 2. Prioritize tasks
      const prioritized = this.prioritizeTasks(discovered)

      // 3. Select and execute best task
      const selected = this.selectNextTask(prioritized)

      if (!selected) {
        this.logger.info('[Continuous] No ready tasks (all blocked by dependencies)')

        // Wait a bit then retry
        await this.sleep(config.sleepTimeBetweenTasks)
        continue
      }

      // 4. Execute task
      this.logger.info(`[Continuous] Executing: ${selected.title}`)
      const result = await this.executor.execute(selected, this.state)

      // 5. Update state
      if (result.success) {
        this.state.completedTasks.push(selected)
        this.state.metrics.tasksCompleted++
        this.logger.info(`[Continuous] Completed: ${selected.title}`)
      } else {
        this.state.failedTasks.push(selected)
        this.state.metrics.tasksFailed++
        this.logger.error('Continuous', result.error!)

        // Decide whether to continue or stop
        if (this.state.config.pauseOnError) {
          this.logger.warn('[Continuous] Pausing after error')
          break
        }
      }

      // 6. Sleep between tasks
      if (config.sleepTimeBetweenTasks > 0) {
        await this.sleep(config.sleepTimeBetweenTasks)
      }
    }

    this.logger.milestone('Continuous improvement loop ended', {
      cycles,
      tasksCompleted: this.state.metrics.tasksCompleted,
      tasksFailed: this.state.metrics.tasksFailed
    })
  }

  /**
   * Check if loop should stop
   */
  private shouldStop(cycles: number): boolean {
    const config = this.state.config.continuousImprovement

    // Check max cycles
    if (config.maxCycles > 0 && cycles >= config.maxCycles) {
      this.logger.info('[Continuous] Max cycles reached')
      return true
    }

    return false
  }

  /**
   * Prioritize tasks by priority enum value
   */
  private prioritizeTasks(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      // First by priority (higher value = higher priority)
      const priorityDiff = b.priority - a.priority

      if (priorityDiff !== 0) return priorityDiff

      // Then by complexity (prefer simpler)
      const complexityScore = { low: 3, medium: 2, high: 1 }
      const complexityDiff = complexityScore[a.complexity] - complexityScore[b.complexity]

      if (complexityDiff !== 0) return complexityDiff

      // Finally by estimated time (prefer faster)
      return a.estimatedTime - b.estimatedTime
    })
  }

  /**
   * Select next task to execute
   */
  private selectNextTask(tasks: Task[]): Task | null {
    const completedIds = new Set(this.state.completedTasks.map(t => t.id))

    // Find first task with all dependencies met
    for (const task of tasks) {
      if (this.areDependenciesMet(task, completedIds)) {
        return task
      }
    }

    return null
  }

  /**
   * Check if task dependencies are met
   */
  private areDependenciesMet(task: Task, completedIds: Set<string>): boolean {
    return task.dependencies.every(dep => completedIds.has(dep))
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
```

**Acceptance Criteria:**
- [ ] Loop doesn't exit when no tasks found
- [ ] Sleeps between cycles correctly
- [ ] Respects max cycles limit
- [ ] Prioritizes tasks correctly
- [ ] Respects dependencies
- [ ] Updates state correctly
- [ ] Handles errors gracefully
- [ ] Can be stopped gracefully

---

**Phase 3 Acceptance Criteria:**
- [ ] Discovery engine finds tasks
- [ ] Git status checking works
- [ ] Caching improves performance
- [ ] Continuous loop runs indefinitely
- [ ] Loop sleeps when no work found
- [ ] Max cycles is respected
- [ ] Tasks are prioritized correctly
- [ ] All edge cases handled

---

## Phase 4: Advanced Features (Week 8-10)

### Overview
Add advanced discovery strategies, review system, quality gates, and parallel execution.

### Task Breakdown

#### 4.1 Advanced Discovery Strategies (3 days)

**File:** `packages/cli/src/agent/advanced-discovery.ts`

**Changes from v1:**
- Downgraded console.log from "security" to TRIVIAL priority
- Better duplicate detection algorithm
- More realistic complexity calculation

```typescript
import type { DiscoveryStrategy, Task, WorkflowContext } from './types'
import { Priority } from './types'

/**
 * Advanced discovery strategies
 */
export class AdvancedDiscoveryStrategies {
  /**
   * Strategy: Discover refactoring opportunities
   */
  static refactoringStrategy: DiscoveryStrategy = {
    name: 'refactoring',
    description: 'Find refactoring opportunities',
    enabled: false, // Disabled by default
    checkChanges: true,
    execute: async (context) => this.discoverRefactoringOpportunities(context),
    priority: (task) => ({ priority: Priority.MEDIUM, reason: 'Refactoring opportunity' })
  }

  /**
   * Strategy: Discover documentation gaps
   */
  static documentationStrategy: DiscoveryStrategy = {
    name: 'documentation',
    description: 'Find missing documentation',
    enabled: false,
    checkChanges: true,
    execute: async (context) => this.discoverDocumentationGaps(context),
    priority: (task) => ({ priority: Priority.LOW, reason: 'Missing documentation' })
  }

  /**
   * Strategy: Suggest new features
   */
  static featureIdeationStrategy: DiscoveryStrategy = {
    name: 'feature-ideas',
    description: 'Suggest new features based on codebase analysis',
    enabled: false, // Disabled by default
    checkChanges: false,
    execute: async (context) => this.suggestFeatures(context),
    priority: (task) => ({ priority: Priority.TRIVIAL, reason: 'Feature suggestion' })
  }

  /**
   * Strategy: Security analysis (REVISED)
   */
  static securityStrategy: DiscoveryStrategy = {
    name: 'security',
    description: 'Find potential security issues',
    enabled: true,
    checkChanges: true,
    execute: async (context) => this.discoverSecurityIssues(context),
    priority: (task) => {
      // Only CRITICAL security issues, not console.log
      return { priority: Priority.CRITICAL, reason: 'Security issue' }
    }
  }

  /**
   * Strategy: Test coverage gaps
   */
  static coverageStrategy: DiscoveryStrategy = {
    name: 'test-coverage',
    description: 'Improve test coverage',
    enabled: false,
    checkChanges: true,
    execute: async (context) => this.discoverCoverageGaps(context),
    priority: (task) => ({ priority: Priority.MEDIUM, reason: 'Low coverage' })
  }

  /**
   * Discover refactoring opportunities
   */
  private static async discoverRefactoringOpportunities(context: WorkflowContext): Promise<Task[]> {
    // Similar to v1, but using Priority enum
    // ...
    return []
  }

  /**
   * Discover documentation gaps
   */
  private static async discoverDocumentationGaps(context: WorkflowContext): Promise<Task[]> {
    // Similar to v1, but using Priority enum
    // ...
    return []
  }

  /**
   * Suggest new features
   */
  private static async suggestFeatures(context: WorkflowContext): Promise<Task[]> {
    // Similar to v1, but using Priority.TRIVIAL
    // ...
    return []
  }

  /**
   * Discover security issues (REVISED - removed console.log)
   */
  private static async discoverSecurityIssues(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []
    const files = await this.getAllFiles(context)

    // REVISED: Only real security issues, not console.log
    const securityPatterns = [
      { pattern: /eval\s*\(/, issue: 'Use of eval() is dangerous', severity: 1000 },
      { pattern: /innerHTML\s*=/, issue: 'Unsanitized HTML assignment', severity: 900 },
      { pattern: /dangerouslySetInnerHTML/, issue: 'Dangerous HTML assignment', severity: 900 },
      { pattern: /document\.write\(/, issue: 'document.write is dangerous', severity: 850 }
      // REMOVED: console.log (not a security issue)
    ]

    for (const file of files) {
      const content = await context.tools.readFile({ path: file })

      for (const { pattern, issue, severity } of securityPatterns) {
        const matches = content.match(pattern)
        if (matches) {
          tasks.push({
            id: `security-${file}-${Date.now()}`,
            type: 'bugfix',
            title: `Fix security issue: ${issue}`,
            description: `Found in ${file}`,
            priority: severity, // Dynamic priority
            complexity: 'medium',
            dependencies: [],
            estimatedTime: 20,
            status: 'pending',
            files: [file],
            workflow: 'code',
            workflowInput: {
              prompt: `Fix security issue: ${issue}`,
              files: [file]
            },
            retryCount: 0,
            createdAt: Date.now()
          })
        }
      }
    }

    return tasks
  }

  /**
   * Discover test coverage gaps
   */
  private static async discoverCoverageGaps(context: WorkflowContext): Promise<Task[]> {
    // Similar to v1, but using Priority enum
    // ...
    return []
  }

  /**
   * Get all relevant files
   */
  private static async getAllFiles(context: WorkflowContext): Promise<string[]> {
    const result = await context.tools.executeCommand({
      command: 'find',
      args: ['packages', '-name', '*.ts', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/dist/*']
    })

    return result.stdout.split('\n').filter(Boolean)
  }
}
```

**Acceptance Criteria:**
- [ ] Finds duplicate code
- [ ] Finds complex code
- [ ] Finds missing documentation
- [ ] Suggests features (low priority)
- [ ] Finds security issues (only real ones)
- [ ] Finds coverage gaps
- [ ] All strategies can be toggled
- [ ] Priorities are appropriate

---

#### 4.2 Review and Quality Gates (3 days)

**File:** `packages/cli/src/agent/review.ts` (NEW)

```typescript
import type { Task, ReviewResult, QualityGateResult } from './types'
import { AgentLogger } from './logger'

/**
 * Reviews task execution results
 */
export class ReviewEngine {
  constructor(private logger: AgentLogger) {}

  /**
   * Review completed task
   */
  async reviewTask(task: Task, result: WorkflowExecutionResult): Promise<ReviewResult> {
    this.logger.task(task, 'Reviewing execution result')

    const issues: Issue[] = []

    // Check if tests passed
    if (result.testsRun && result.testsPassed !== result.testsRun) {
      issues.push({
        severity: 'error',
        category: 'tests',
        message: `${result.testsRun - result.testsPassed} test(s) failed`,
        details: `${result.testsPassed}/${result.testsRun} tests passed`
      })
    }

    // Check if too many files modified
    if (result.filesModified && result.filesModified.length > 20) {
      issues.push({
        severity: 'warning',
        category: 'scope',
        message: 'Many files modified',
        details: `${result.filesModified.length} files changed`
      })
    }

    const approved = issues.filter(i => i.severity === 'error').length === 0

    return {
      approved,
      issues,
      metrics: {
        testsPassed: result.testsPassed ? result.testsPassed === result.testsRun : true,
        buildPassed: true, // TODO: check
        reviewComments: issues.length,
        coverageMet: true // TODO: check
      }
    }
  }

  /**
   * Run quality gates before committing
   */
  async runQualityGates(state: AgentState): Promise<QualityGateResult> {
    this.logger.info('[Review] Running quality gates...')

    const checks: QualityGateCheck[] = []

    // Check 1: No failing tasks
    const hasFailures = state.failedTasks.length > 0
    checks.push({
      name: 'no-failures',
      passed: !hasFailures,
      action: hasFailures ? 'block' : 'ignore',
      error: hasFailures ? `${state.failedTasks.length} tasks failed` : undefined
    })

    // Check 2: Tests pass
    const testsPassed = state.metrics.tests.testsFailed === 0
    checks.push({
      name: 'tests-pass',
      passed: testsPassed,
      action: 'block',
      error: testsPassed ? undefined : `${state.metrics.tests.testsFailed} tests failed`
    })

    // Check 3: Build passes
    // TODO: run build

    // Check 4: Coverage threshold
    const coverageMet = state.metrics.tests.currentCoverage >= 80
    checks.push({
      name: 'coverage-threshold',
      passed: coverageMet,
      action: 'warn',
      error: coverageMet ? undefined : `Coverage: ${state.metrics.tests.currentCoverage}%`
    })

    const allPassed = checks.every(c => c.passed)
    const blocked = checks.some(c => !c.passed && c.action === 'block')

    return {
      allPassed,
      blocked,
      checks
    }
  }
}

interface Issue {
  severity: 'error' | 'warning' | 'info'
  category: string
  message: string
  details?: string
}
```

**Acceptance Criteria:**
- [ ] Reviews task results
- [ ] Runs quality gates
- [ ] Blocks on critical failures
- [ ] Warns on non-critical issues
- [ ] Provides detailed feedback
- [ ] Configurable thresholds

---

#### 4.3 Parallel Execution (4 days)

**File:** `packages/cli/src/agent/parallel-executor.ts`

**Moved from Phase 2 to Phase 4** - this is advanced functionality.

```typescript
import type { Task, WorkflowContext, TaskResult } from './types'
import { TaskExecutor } from './executor'
import { AgentLogger } from './logger'

/**
 * Executes multiple tasks in parallel with dependency management
 */
export class ParallelExecutor {
  constructor(
    private context: WorkflowContext,
    private logger: AgentLogger,
    private maxConcurrency: number = 2
  ) {}

  /**
   * Execute phase of tasks in parallel
   */
  async executePhase(taskIds: string[], allTasks: Map<string, Task>): Promise<Map<string, TaskResult>> {
    const results = new Map<string, TaskResult>()
    const executing = new Map<string, Promise<void>>()
    const queue = [...taskIds]

    this.logger.info(`[Parallel] Executing ${taskIds.length} tasks with max concurrency ${this.maxConcurrency}`)

    while (queue.length > 0 || executing.size > 0) {
      // Start new tasks up to concurrency limit
      while (queue.length > 0 && executing.size < this.maxConcurrency) {
        const taskId = queue.shift()!
        const task = allTasks.get(taskId)!

        this.logger.info(`[Parallel] Starting task: ${task.title}`)

        const promise = this.executeTask(task).then(result => {
          results.set(taskId, result)
          executing.delete(taskId)

          if (result.success) {
            this.logger.info(`[Parallel] Completed: ${task.title}`)
          } else {
            this.logger.error(`[Parallel] Failed: ${task.title}`, result.error!)
          }
        })

        executing.set(taskId, promise)
      }

      // Wait for at least one task to complete
      if (executing.size > 0) {
        await Promise.race(executing.values())
      }
    }

    return results
  }

  /**
   * Execute single task
   */
  private async executeTask(task: Task): Promise<TaskResult> {
    const executor = new TaskExecutor(this.context, this.logger)
    return await executor.execute(task, this.context)
  }

  /**
   * Execute tasks in topological order with parallel phases
   */
  async executePlan(phases: string[][], allTasks: Map<string, Task>): Promise<Map<string, TaskResult>> {
    const allResults = new Map<string, TaskResult>()

    for (let i = 0; i < phases.length; i++) {
      this.logger.milestone(`Starting phase ${i + 1}/${phases.length} (${phases[i].length} tasks)`)

      const phaseResults = await this.executePhase(phases[i], allTasks)

      // Check for failures
      const failures = Array.from(phaseResults.entries()).filter(([_, r]) => !r.success)
      if (failures.length > 0) {
        this.logger.warn(`[Parallel] Phase ${i + 1} had ${failures.length} failures`)

        // Decide whether to continue or stop
        // For now, continue with next phase
      }

      // Merge results
      for (const [id, result] of phaseResults) {
        allResults.set(id, result)
      }
    }

    return allResults
  }
}
```

**Acceptance Criteria:**
- [ ] Executes tasks in parallel up to concurrency limit
- [ ] Respects task dependencies
- [ ] Handles failures gracefully
- [ ] Provides progress updates
- [ ] Can configure max concurrency
- [ ] No deadlocks
- [ ] Resource contention handled

---

**Phase 4 Acceptance Criteria:**
- [ ] Advanced discovery strategies work
- [ ] Security scanner doesn't flag console.log
- [ ] Review engine checks results
- [ ] Quality gates block appropriately
- [ ] Parallel execution respects concurrency
- [ ] No deadlocks in parallel mode
- [ ] All components integrate

---

## Phase 5: Optimization & Polish (Week 11-12)

### Overview
Improve performance, add caching, enhance documentation, and polish the implementation.

### Task Breakdown

#### 5.1 Caching Layer (2 days)

**File:** `packages/cli/src/agent/cache.ts`

Similar to v1, but with better integration.

#### 5.2 Enhanced Error Recovery (2 days)

**File:** `packages/cli/src/agent/error-recovery.ts`

Similar to v1, but with more error types handled.

#### 5.3 Performance Optimizations (2 days)

**File:** `packages/cli/src/agent/optimizations.ts`

Similar to v1, plus:
- Batch file operations
- Lazy loading
- Memory optimization

#### 5.4 Documentation & Testing (2 days)

- Add architecture diagrams
- Add sequence diagrams
- Add state machine diagram
- Write integration tests
- Write end-to-end tests
- Create deployment guide

---

## MVP Definition

### What's in MVP (8 weeks)?

**Week 1-2:** Phase 1 - Foundation
**Week 3-5:** Phase 2 - Core Execution
**Week 6-7:** Phase 3 - Continuous Improvement (basic only)
**Week 8:** Testing & Documentation

### MVP Includes:
✅ Complete type system
✅ State management
✅ Configuration with Zod validation
✅ Orchestrator with state machine
✅ Goal decomposition
✅ Task execution with workflow integration
✅ Basic task discovery (build, test, type, lint)
✅ Continuous improvement loop (fixed)
✅ Safety systems
✅ Error handling

### MVP Excludes:
❌ Advanced discovery strategies
❌ Review and quality gates
❌ Parallel execution
❌ Caching layer
❌ Learning system
❌ Performance optimizations

---

## Testing Strategy

### Unit Tests
- Each component tested in isolation
- Mock external dependencies
- 100% coverage for core logic
- Edge cases covered

### Integration Tests
- Component interactions
- State machine transitions
- Workflow invocation
- Error recovery flows

### End-to-End Tests
- Complete goal-directed execution
- Continuous improvement scenarios
- Error scenarios
- Interrupt handling

### Test Data
- Fixtures for common scenarios
- Mock git repository
- Sample codebase

---

## TypeScript API Reference

(Kept from v1, updated with new exports)

```typescript
// packages/cli/src/agent/index.ts

export * from './types'
export * from './orchestrator'
export * from './state-manager'
export * from './config'
export * from './logger'
export * from './metrics'
export * from './constants'
export * from './errors'

export { GoalDecomposer } from './goal-decomposer'
export { TaskPlanner } from './planner'
export { TaskExecutor } from './executor'
export { TaskDiscoveryEngine } from './task-discovery'
export { ContinuousImprovementLoop } from './improvement-loop'

// Safety
export { ApprovalManager } from './safety/approval'
export { SafetyChecker } from './safety/checks'
export { InterruptHandler } from './safety/interrupt'
```

---

## Summary

### Key Improvements from v1

1. **Added Missing Components**
   - Orchestrator with state machine
   - Task executor with workflow integration
   - Constants and error types
   - Review engine and quality gates

2. **Fixed Critical Bugs**
   - Continuous improvement loop no longer exits
   - Console.log not flagged as security issue
   - Missing logger methods added
   - Priority enum instead of magic numbers

3. **Better Integration**
   - Maps to existing workflows
   - Uses Zod for validation
   - Change detection in discovery
   - Smart caching

4. **More Realistic Timeline**
   - 10 → 12 weeks
   - Phase 2 extended to 3 weeks
   - MVP clearly defined (8 weeks)

5. **Improved Architecture**
   - Explicit state machine
   - State transition validation
   - Better error handling
   - Cleaner separation of concerns

### Ready for Implementation

This revised plan addresses all critical concerns from the review and is ready for implementation.

**Next Steps:**
1. ✅ Review and approve v2.0 plan
2. ✅ Start Phase 1 implementation
3. ✅ Create tests alongside implementation
4. ✅ Iterate based on feedback
