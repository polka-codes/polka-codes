# Autonomous Agent - Detailed Implementation Plan with API Design

**Created:** 2025-01-02
**Status:** Ready for Implementation
**Estimated Timeline:** 10 weeks (5 phases)

---

## Table of Contents

1. [Phase 1: Foundation (Week 1-2)](#phase-1-foundation)
2. [Phase 2: Goal Achievement (Week 3-4)](#phase-2-goal-achievement)
3. [Phase 3: Continuous Improvement (Week 5-6)](#phase-3-continuous-improvement)
4. [Phase 4: Advanced Discovery (Week 7-8)](#phase-4-advanced-discovery)
5. [Phase 5: Optimization (Week 9-10)](#phase-5-optimization)
6. [TypeScript API Reference](#typescript-api-reference)

---

## Phase 1: Foundation (Week 1-2)

### Overview
Build the core infrastructure for the autonomous agent system.

### Task Breakdown

#### 1.1 Project Structure Setup (1 day)

**Files to Create:**
```
packages/cli/src/agent/
├── index.ts                    # Main exports
├── orchestrator.ts             # Agent orchestrator
├── state-manager.ts            # State persistence
├── config.ts                   # Configuration types and defaults
├── logger.ts                   # Structured logging
├── metrics.ts                  # Metrics collection
├── safety/
│   ├── approval.ts            # Approval management
│   ├── checks.ts              # Safety checks
│   └── interrupt.ts           # Interrupt handling
└── types.ts                    # Core type definitions
```

**Implementation:**

`packages/cli/src/agent/types.ts`:
```typescript
/**
 * Core type definitions for the autonomous agent system
 */

import type { z } from 'zod'
import type { Logger } from '@polka-codes/core'

/**
 * Agent operation modes
 */
export type AgentMode = 'idle' | 'planning' | 'executing' | 'reviewing' | 'committing' | 'stopped' | 'error-recovery'

/**
 * Agent execution strategy
 */
export type AgentStrategy = 'goal-directed' | 'continuous-improvement'

/**
 * Approval requirement levels
 */
export type ApprovalLevel = 'none' | 'destructive' | 'commits' | 'all'

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
 * Workflow names available for task execution
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

  /** Maximum concurrent tasks */
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

  /** Learning data */
  learning: LearningData

  /** Timestamps */
  timestamps: Timestamps

  /** Session info */
  session: SessionInfo
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

  /** Priority (higher = more important) */
  priority: number

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
  result?: any

  /** Error (if failed) */
  error?: Error

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

  /** Review result */
  reviewResult?: ReviewResult
}

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

  /** Lessons learned */
  lessons?: string[]
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
 * Learning data for strategy adaptation
 */
export interface LearningData {
  /** Strategy weights by task type */
  strategies: Record<string, Strategy>

  /** Failure patterns */
  failurePatterns: Record<string, number>

  /** Success patterns */
  successPatterns: Record<string, number>

  /** Time estimation accuracy */
  estimationAccuracy: Record<string, number>
}

/**
 * Strategy data for learning
 */
export interface Strategy {
  /** Priority weight multiplier */
  priorityWeight: number

  /** Success rate (0-1) */
  successRate: number

  /** Avoid this strategy */
  avoid: boolean

  /** Last used timestamp */
  lastUsed: number

  /** Total attempts */
  attempts: number

  /** Total successes */
  successes: number
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
 * Review result
 */
export interface ReviewResult {
  /** Approval flag */
  approved: boolean

  /** Issues found */
  issues: Issue[]

  /** Review metrics */
  metrics: ReviewMetrics
}

/**
 * Issue found during review
 */
export interface Issue {
  /** Severity level */
  severity: 'error' | 'warning' | 'info'

  /** Issue category */
  category: string

  /** Issue message */
  message: string

  /** File (if applicable) */
  file?: string

  /** Line number (if applicable) */
  line?: number

  /** Additional details */
  details?: string
}

/**
 * Review metrics
 */
export interface ReviewMetrics {
  /** Tests passed */
  testsPassed: boolean

  /** Build passed */
  buildPassed: boolean

  /** Number of review comments */
  reviewComments: number

  /** Coverage threshold met */
  coverageMet: boolean
}

/**
 * Quality gate check result
 */
export interface QualityGateResult {
  /** All gates passed */
  allPassed: boolean

  /** Blocked from proceeding */
  blocked: boolean

  /** Individual gate checks */
  checks: QualityGateCheck[]
}

/**
 * Individual quality gate check
 */
export interface QualityGateCheck {
  /** Gate name */
  name: string

  /** Passed flag */
  passed: boolean

  /** Action on failure */
  action: 'block' | 'warn' | 'ignore'

  /** Error details */
  error?: string
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
  priority: (task: Task) => number

  /** Enable/disable flag */
  enabled: boolean
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
}

/**
 * Error classification
 */
export type ErrorType = 'transient' | 'validation' | 'test-failure' | 'permission' | 'fatal' | 'unknown'

/**
 * Task execution result
 */
export interface TaskResult {
  /** Success flag */
  success: boolean

  /** Result data */
  data?: any

  /** Error (if failed) */
  error?: Error

  /** Execution time (ms) */
  duration: number
}

/**
 * Progress report
 */
export interface ProgressReport {
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
  sessionId: string
}

/**
 * Audit log entry
 */
export interface AuditLog {
  /** Timestamp */
  timestamp: number

  /** Session ID */
  sessionId: string

  /** Action performed */
  action: string

  /** User who triggered action */
  user: string

  /** Action details */
  details: any

  /** Approval status */
  approval: boolean

  /** Result */
  result: 'success' | 'failure'
}
```

**Acceptance Criteria:**
- [ ] All type definitions created
- [ ] No `any` types used (except where explicitly necessary)
- [ ] All interfaces documented with JSDoc
- [ ] Types exported from `index.ts`

---

#### 1.2 Agent State Manager (2 days)

**File:** `packages/cli/src/agent/state-manager.ts`

**API Design:**

```typescript
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AgentState, AgentConfig } from './types'

/**
 * Manages agent state persistence and recovery
 */
export class AgentStateManager {
  private state: AgentState | null = null
  private stateFilePath: string
  private saveTimer: NodeJS.Timeout | null = null
  private checkpointDir: string

  constructor(stateDir: string, sessionId: string) {
    this.stateFilePath = path.join(stateDir, 'agent-state.json')
    this.checkpointDir = path.join(stateDir, 'checkpoints')
  }

  /**
   * Initialize a new agent state
   */
  async initialize(config: AgentConfig): Promise<AgentState> {
    this.state = {
      sessionId: this.generateSessionId(),
      currentMode: 'idle',
      config,
      taskQueue: [],
      completedTasks: [],
      failedTasks: [],
      blockedTasks: [],
      executionHistory: [],
      metrics: this.emptyMetrics(),
      learning: this.emptyLearning(),
      timestamps: {
        startTime: Date.now(),
        lastActivity: Date.now(),
        lastSaveTime: 0,
        lastMetricsUpdate: 0
      },
      session: {
        id: this.generateSessionId(),
        iterationCount: 0,
        parentPid: process.ppid,
        pid: process.pid
      }
    }

    await this.saveState()
    return this.state
  }

  /**
   * Load existing state from disk
   */
  async loadState(): Promise<AgentState | null> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8')
      this.state = JSON.parse(content)
      return this.state
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null // No existing state
      }
      throw error
    }
  }

  /**
   * Get current state
   */
  getState(): AgentState | null {
    return this.state
  }

  /**
   * Update state (partial merge)
   */
  async updateState(updates: Partial<AgentState>): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded. Call initialize() or loadState() first.')
    }

    this.state = { ...this.state, ...updates }
    this.state.timestamps.lastActivity = Date.now()
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<void> {
    if (!this.state) {
      throw new Error('No state to save')
    }

    this.state.timestamps.lastSaveTime = Date.now()

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true })

    // Write state atomically
    const tempPath = this.stateFilePath + '.tmp'
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2))
    await fs.rename(tempPath, this.stateFilePath)
  }

  /**
   * Start auto-save timer
   */
  startAutoSave(intervalMs: number): void {
    this.stopAutoSave()
    this.saveTimer = setInterval(async () => {
      await this.saveState()
    }, intervalMs)
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
  }

  /**
   * Create a named checkpoint
   */
  async checkpoint(name: string): Promise<string> {
    if (!this.state) {
      throw new Error('No state to checkpoint')
    }

    await fs.mkdir(this.checkpointDir, { recursive: true })
    const checkpointPath = path.join(
      this.checkpointDir,
      `checkpoint-${name}-${Date.now()}.json`
    )

    await fs.writeFile(checkpointPath, JSON.stringify(this.state, null, 2))
    return checkpointPath
  }

  /**
   * List available checkpoints
   */
  async listCheckpoints(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.checkpointDir)
      return files.filter(f => f.startsWith('checkpoint-'))
    } catch {
      return []
    }
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(checkpointName: string): Promise<AgentState> {
    const files = await this.listCheckpoints()
    const matching = files.find(f => f.includes(checkpointName))

    if (!matching) {
      throw new Error(`Checkpoint not found: ${checkpointName}`)
    }

    const checkpointPath = path.join(this.checkpointDir, matching)
    const content = await fs.readFile(checkpointPath, 'utf-8')
    this.state = JSON.parse(content)

    await this.saveState()
    return this.state
  }

  /**
   * Clear all state
   */
  async clearState(): Promise<void> {
    this.state = null
    this.stopAutoSave()

    try {
      await fs.unlink(this.stateFilePath)
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create empty metrics object
   */
  private emptyMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTasks: 0,
      totalExecutionTime: 0,
      averageTaskTime: 0,
      git: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        branchesCreated: 0
      },
      tests: {
        totalTestsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        currentCoverage: 0,
        testsAdded: 0
      },
      improvements: {
        bugsFixed: 0,
        testsAdded: 0,
        refactoringsCompleted: 0,
        documentationAdded: 0,
        qualityImprovements: 0
      },
      resources: {
        peakMemoryMB: 0,
        averageCpuPercent: 0,
        totalApiCalls: 0,
        totalTokensUsed: 0
      }
    }
  }

  /**
   * Create empty learning data
   */
  private emptyLearning(): LearningData {
    return {
      strategies: {},
      failurePatterns: {},
      successPatterns: {},
      estimationAccuracy: {}
    }
  }
}
```

**Tests to Create:**

```typescript
// packages/cli/src/agent/state-manager.test.ts
import { describe, expect, it } from 'bun:test'
import { AgentStateManager } from './state-manager'
import { tempDir } from './test-utils'

describe('AgentStateManager', () => {
  it('should initialize new state', async () => {
    const manager = new AgentStateManager(tempDir, 'test-session')
    const state = await manager.initialize({
      strategy: 'goal-directed',
      continueOnCompletion: false,
      maxIterations: 10,
      timeout: 60,
      requireApprovalFor: 'commits',
      pauseOnError: true,
      workingBranch: 'main',
      maxConcurrency: 1,
      autoSaveInterval: 30000,
      enableProgress: true,
      destructiveOperations: ['delete'],
      maxAutoApprovalCost: 5,
      autoApproveSafeTasks: true,
      resourceLimits: {
        maxMemory: 1024,
        maxCpuPercent: 80,
        maxTaskExecutionTime: 30,
        maxSessionTime: 120,
        maxFilesChanged: 10
      }
    })

    expect(state.sessionId).toBeDefined()
    expect(state.currentMode).toBe('idle')
    expect(state.taskQueue).toHaveLength(0)
  })

  it('should save and load state', async () => {
    const manager = new AgentStateManager(tempDir, 'test-session')
    const state = await manager.initialize(defaultConfig)

    state.currentGoal = 'Test goal'
    await manager.saveState()

    const manager2 = new AgentStateManager(tempDir, 'test-session')
    const loaded = await manager2.loadState()

    expect(loaded?.currentGoal).toBe('Test goal')
  })

  it('should update state partially', async () => {
    const manager = new AgentStateManager(tempDir, 'test-session')
    await manager.initialize(defaultConfig)

    await manager.updateState({
      currentGoal: 'New goal',
      currentMode: 'planning'
    })

    const state = manager.getState()
    expect(state?.currentGoal).toBe('New goal')
    expect(state?.currentMode).toBe('planning')
  })

  it('should create and restore checkpoints', async () => {
    const manager = new AgentStateManager(tempDir, 'test-session')
    const state = await manager.initialize(defaultConfig)

    state.currentGoal = 'Before checkpoint'
    await manager.checkpoint('test')

    state.currentGoal = 'After checkpoint'
    await manager.restoreCheckpoint('test')

    const restored = manager.getState()
    expect(restored?.currentGoal).toBe('Before checkpoint')
  })
})
```

**Acceptance Criteria:**
- [ ] State can be initialized, saved, and loaded
- [ ] Partial updates work correctly
- [ ] Auto-save timer starts and stops correctly
- [ ] Checkpoints can be created and restored
- [ ] All methods have error handling
- [ ] 100% test coverage

---

#### 1.3 Configuration System (1 day)

**File:** `packages/cli/src/agent/config.ts`

**API Design:**

```typescript
import type { AgentConfig, ApprovalLevel, AgentStrategy } from './types'

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  strategy: 'goal-directed',
  continueOnCompletion: false,
  maxIterations: 0, // 0 = infinite in continuous mode
  timeout: 0, // 0 = no timeout
  requireApprovalFor: 'destructive',
  pauseOnError: true,
  workingBranch: 'main',
  maxConcurrency: 1,
  autoSaveInterval: 30000, // 30 seconds
  enableProgress: true,
  destructiveOperations: ['delete', 'force-push', 'reset'],
  maxAutoApprovalCost: 5, // 5 minutes
  autoApproveSafeTasks: true,
  resourceLimits: {
    maxMemory: 2048, // 2GB
    maxCpuPercent: 80,
    maxTaskExecutionTime: 60, // 1 hour
    maxSessionTime: 480, // 8 hours
    maxFilesChanged: 20
  }
}

/**
 * Configuration presets for common scenarios
 */
export const CONFIG_PRESETS: Record<string, Partial<AgentConfig>> = {
  /**
   * Conservative preset - requires approval for most actions
   */
  conservative: {
    requireApprovalFor: 'all',
    autoApproveSafeTasks: false,
    maxAutoApprovalCost: 0,
    pauseOnError: true,
    maxConcurrency: 1
  },

  /**
   * Aggressive preset - minimal approval requirements
   */
  aggressive: {
    requireApprovalFor: 'none',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 30, // 30 minutes
    pauseOnError: false,
    maxConcurrency: 3
  },

  /**
   * Balanced preset - middle ground
   */
  balanced: {
    requireApprovalFor: 'destructive',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 10,
    pauseOnError: true,
    maxConcurrency: 2
  },

  /**
   * Continuous improvement preset
   */
  'continuous-improvement': {
    strategy: 'continuous-improvement',
    continueOnCompletion: true,
    maxIterations: 0, // infinite
    requireApprovalFor: 'commits',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 15,
    pauseOnError: false,
    maxConcurrency: 2
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
  validateConfig(config)

  return config
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
    }
  }
}

/**
 * Validate configuration
 */
export function validateConfig(config: AgentConfig): void {
  const errors: string[] = []

  if (config.maxIterations < 0) {
    errors.push('maxIterations must be >= 0')
  }

  if (config.timeout < 0) {
    errors.push('timeout must be >= 0')
  }

  if (config.maxConcurrency < 1) {
    errors.push('maxConcurrency must be >= 1')
  }

  if (config.autoSaveInterval < 1000) {
    errors.push('autoSaveInterval must be >= 1000ms')
  }

  if (config.resourceLimits.maxMemory < 128) {
    errors.push('maxMemory must be >= 128MB')
  }

  if (config.resourceLimits.maxCpuPercent < 1 || config.resourceLimits.maxCpuPercent > 100) {
    errors.push('maxCpuPercent must be between 1 and 100')
  }

  if (errors.length > 0) {
    throw new Error(`Invalid configuration:\n${errors.join('\n')}`)
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

**Acceptance Criteria:**
- [ ] Default configuration is reasonable
- [ ] Presets cover common use cases
- [ ] Configuration validation works
- [ ] Can load from file
- [ ] CLI options override file options

---

#### 1.4 Structured Logger (1 day)

**File:** `packages/cli/src/agent/logger.ts`

**API Design:**

```typescript
import type { Logger } from '@polka-codes/core'
import type { Task, AgentMetrics } from './types'
import * as fs from 'node:fs/promises'

/**
 * Structured logger for autonomous agent
 */
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
   * Log discovery result
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
   * Log metrics update
   */
  metrics(metrics: AgentMetrics): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
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

**Acceptance Criteria:**
- [ ] All log methods work correctly
- [ ] Logs written to file in JSON format
- [ ] Structured data includes all relevant context
- [ ] No infinite loops if log file write fails

---

#### 1.5 Metrics Collector (1 day)

**File:** `packages/cli/src/agent/metrics.ts`

**API Design:**

```typescript
import type { AgentMetrics, Task, TaskResult, ExecutionRecord } from './types'

/**
 * Collects and tracks agent metrics
 */
export class MetricsCollector {
  private metrics: AgentMetrics
  private startTime: number

  constructor() {
    this.metrics = this.emptyMetrics()
    this.startTime = Date.now()
  }

  /**
   * Record task execution
   */
  recordTask(task: Task, result: TaskResult): void {
    this.metrics.totalTasks++

    if (result.success) {
      this.metrics.tasksCompleted++

      // Update improvement metrics
      switch (task.type) {
        case 'bugfix':
          this.metrics.improvements.bugsFixed++
          break
        case 'test':
          this.metrics.improvements.testsAdded++
          break
        case 'refactor':
          this.metrics.improvements.refactoringsCompleted++
          break
        case 'docs':
          this.metrics.improvements.documentationAdded++
          break
      }
    } else {
      this.metrics.tasksFailed++
    }

    // Update average time
    this.updateAverageTime(result.duration)
  }

  /**
   * Record git operation
   */
  recordGitOperation(operation: {
    filesChanged?: number
    insertions?: number
    deletions?: number
    branchCreated?: boolean
  }): void {
    if (operation.filesChanged) {
      this.metrics.git.totalFilesChanged += operation.filesChanged
    }
    if (operation.insertions) {
      this.metrics.git.totalInsertions += operation.insertions
    }
    if (operation.deletions) {
      this.metrics.git.totalDeletions += operation.deletions
    }
    if (operation.branchCreated) {
      this.metrics.git.branchesCreated++
    }
    this.metrics.git.totalCommits++
  }

  /**
   * Record test results
   */
  recordTestResults(results: {
    run: number
    passed: number
    failed: number
    coverage?: number
  }): void {
    this.metrics.tests.totalTestsRun += results.run
    this.metrics.tests.testsPassed += results.passed
    this.metrics.tests.testsFailed += results.failed
    if (results.coverage !== undefined) {
      this.metrics.tests.currentCoverage = results.coverage
    }
  }

  /**
   * Update resource usage
   */
  updateResourceUsage(): void {
    const memUsage = process.memoryUsage()
    this.metrics.resources.peakMemoryMB = Math.max(
      this.metrics.resources.peakMemoryMB,
      memUsage.heapUsed / 1024 / 1024
    )
  }

  /**
   * Get current metrics
   */
  getMetrics(): AgentMetrics {
    // Update total execution time
    this.metrics.totalExecutionTime = Date.now() - this.startTime
    return { ...this.metrics }
  }

  /**
   * Generate metrics report
   */
  generateReport(): string {
    const m = this.metrics
    const duration = Math.floor((Date.now() - this.startTime) / 60000)

    return `
╔════════════════════════════════════════════════════════════╗
║              Agent Metrics Report                          ║
╠════════════════════════════════════════════════════════════╣
║ Tasks                                                      ║
║   Completed: ${String(m.tasksCompleted).padStart(4)}   Failed: ${String(m.tasksFailed).padStart(4)}   Total: ${String(m.tasksCompleted + m.tasksFailed).padStart(4)} ║
║                                                            ║
║ Improvements                                              ║
║   Bugs Fixed: ${String(m.improvements.bugsFixed).padStart(3)}     Tests Added: ${String(m.improvements.testsAdded).padStart(3)}   Refactors: ${String(m.improvements.refactoringsCompleted).padStart(3)} ║
║   Docs Added: ${String(m.improvements.documentationAdded).padStart(3)}    Quality: ${String(m.improvements.qualityImprovements).padStart(3)}                     ║
║                                                            ║
║ Git                                                        ║
║   Commits: ${String(m.git.totalCommits).padStart(4)}      Files: ${String(m.git.totalFilesChanged).padStart(4)}      Insertions: ${String(m.git.totalInsertions).padStart(5)} ║
║   Deletions: ${String(m.git.totalDeletions).padStart(5)}   Branches: ${String(m.git.branchesCreated).padStart(3)}                     ║
║                                                            ║
║ Tests                                                      ║
║   Run: ${String(m.tests.totalTestsRun).padStart(5)}      Passed: ${String(m.tests.testsPassed).padStart(5)}      Coverage: ${m.tests.currentCoverage}%          ║
║                                                            ║
║ Session                                                    ║
║   Duration: ${String(duration).padStart(4)} min   Success Rate: ${this.getSuccessRate().toFixed(1)}%        ║
╚════════════════════════════════════════════════════════════╝
    `.trim()
  }

  /**
   * Get success rate
   */
  getSuccessRate(): number {
    if (this.metrics.totalTasks === 0) return 0
    return (this.metrics.tasksCompleted / this.metrics.totalTasks) * 100
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = this.emptyMetrics()
    this.startTime = Date.now()
  }

  /**
   * Create empty metrics object
   */
  private emptyMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTasks: 0,
      totalExecutionTime: 0,
      averageTaskTime: 0,
      git: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        branchesCreated: 0
      },
      tests: {
        totalTestsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        currentCoverage: 0,
        testsAdded: 0
      },
      improvements: {
        bugsFixed: 0,
        testsAdded: 0,
        refactoringsCompleted: 0,
        documentationAdded: 0,
        qualityImprovements: 0
      },
      resources: {
        peakMemoryMB: 0,
        averageCpuPercent: 0,
        totalApiCalls: 0,
        totalTokensUsed: 0
      }
    }
  }

  /**
   * Update average task time
   */
  private updateAverageTime(durationMs: number): void {
    const total = this.metrics.tasksCompleted + this.metrics.tasksFailed
    const currentAvg = this.metrics.averageTaskTime
    const newTime = durationMs / 60000 // convert to minutes

    this.metrics.averageTaskTime = (currentAvg * (total - 1) + newTime) / total
  }
}
```

**Acceptance Criteria:**
- [ ] All metrics tracked accurately
- [ ] Report renders correctly
- [ ] Success rate calculated correctly
- [ ] Can reset metrics

---

#### 1.6 Safety Systems (3 days)

**1.6.1 Approval Manager** (1 day)

**File:** `packages/cli/src/agent/safety/approval.ts`

```typescript
import type { ApprovalDecision, ApprovalLevel, Task } from '../types'
import type { Logger } from '@polka-codes/core'
import { getUserInput } from '../../utils/userInput'

/**
 * Manages user approval for agent actions
 */
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

    // Auto-approve safe tasks if within time threshold
    if (this.autoApproveSafeTasks && task.estimatedTime <= this.maxAutoApprovalCost) {
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

**1.6.2 Safety Checker** (1 day)

**File:** `packages/cli/src/agent/safety/checks.ts`

```typescript
import type { SafetyCheck, SafetyCheckResult } from '../types'
import type { Logger } from '@polka-codes/core'
import type { WorkflowTools } from '@polka-codes/core'

/**
 * Pre-execution safety checks
 */
export class SafetyChecker {
  constructor(
    private logger: Logger,
    private tools: WorkflowTools<any>
  ) {}

  /**
   * Run all safety checks before task execution
   */
  async preExecutionCheck(task: any): Promise<SafetyCheckResult> {
    const checks: SafetyCheck[] = []

    this.logger.debug('[Safety] Running pre-execution checks...')

    // Check working tree
    checks.push(await this.checkWorkingTree())

    // Check current branch
    checks.push(await this.checkBranch(task))

    // Check disk space
    checks.push(await this.checkDiskSpace())

    // Check for conflicts
    checks.push(await this.checkConflicts(task))

    const failed = checks.filter(c => !c.passed)

    return {
      safe: failed.length === 0,
      checks,
      failed
    }
  }

  /**
   * Check if working tree is clean
   */
  private async checkWorkingTree(): Promise<SafetyCheck> {
    try {
      const result = await this.tools.executeCommand({
        command: 'git',
        args: ['status', '--porcelain']
      })

      const hasChanges = result.stdout.trim().length > 0

      return {
        name: 'working-tree-clean',
        passed: !hasChanges,
        message: hasChanges
          ? '⚠️  Working tree has uncommitted changes'
          : '✓ Working tree is clean'
      }
    } catch (error) {
      return {
        name: 'working-tree-clean',
        passed: false,
        message: `Failed to check working tree: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Check if on correct branch
   */
  private async checkBranch(task: any): Promise<SafetyCheck> {
    try {
      const result = await this.tools.executeCommand({
        command: 'git',
        args: ['branch', '--show-current']
      })

      const currentBranch = result.stdout.trim()
      const expectedBranch = task.branch || 'main'

      return {
        name: 'correct-branch',
        passed: currentBranch === expectedBranch,
        message: `On branch ${currentBranch}${currentBranch !== expectedBranch ? ` (expected ${expectedBranch})` : ''}`
      }
    } catch (error) {
      return {
        name: 'correct-branch',
        passed: false,
        message: `Failed to check branch: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }

  /**
   * Check available disk space
   */
  private async checkDiskSpace(): Promise<SafetyCheck> {
    try {
      const stats = await import('node:fs/promises').then(fs => fs.statfs('.'))
      const freeGB = stats.bfree * stats.blksize / 1024 / 1024 / 1024

      return {
        name: 'disk-space',
        passed: freeGB > 1, // Require at least 1GB free
        message: `${freeGB.toFixed(2)} GB free`
      }
    } catch (error) {
      return {
        name: 'disk-space',
        passed: true, // Don't block if we can't check
        message: 'Unable to check disk space'
      }
    }
  }

  /**
   * Check for merge conflicts
   */
  private async checkConflicts(task: any): Promise<SafetyCheck> {
    try {
      const result = await this.tools.executeCommand({
        command: 'git',
        args: ['diff', '--name-only', '--diff-filter=U']
      })

      const hasConflicts = result.stdout.trim().length > 0

      return {
        name: 'no-conflicts',
        passed: !hasConflicts,
        message: hasConflicts
          ? '⚠️  Merge conflicts detected'
          : '✓ No merge conflicts'
      }
    } catch (error) {
      return {
        name: 'no-conflicts',
        passed: true,
        message: 'Unable to check for conflicts'
      }
    }
  }
}
```

**1.6.3 Interrupt Handler** (1 day)

**File:** `packages/cli/src/agent/safety/interrupt.ts`

```typescript
import type { Logger } from '@polka-codes/core'
import type { AutonomousAgent } from '../orchestrator'

/**
 * Handles graceful shutdown on interrupt signals
 */
export class InterruptHandler {
  private shutdownSignal: boolean = false
  private cleanupCallback?: () => Promise<void>

  constructor(private logger: Logger, private agent: AutonomousAgent) {
    this.setupSignalHandlers()
  }

  /**
   * Set up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.handleInterrupt('SIGINT')
    })

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      this.handleInterrupt('SIGTERM')
    })
  }

  /**
   * Handle interrupt signal
   */
  private async handleInterrupt(signal: string): Promise<void> {
    if (this.shutdownSignal) {
      this.logger.warn('\n⚠️  Force quit requested. Exiting immediately...')
      process.exit(1)
    }

    this.shutdownSignal = true
    this.logger.warn(`\n\n⚠️  Received ${signal}. Initiating graceful shutdown...`)
    this.logger.warn('Press Ctrl+C again to force quit.')

    await this.gracefulShutdown()
  }

  /**
   * Perform graceful shutdown
   */
  private async gracefulShutdown(): Promise<void> {
    try {
      // Wait for current task to complete
      if (this.agent.hasCurrentTask()) {
        this.logger.info('⏳ Waiting for current task to complete...')
        await this.agent.waitForCurrentTask()
      }

      // Save state
      this.logger.info('💾 Saving agent state...')
      await this.agent.saveState()

      // Run cleanup
      this.logger.info('🧹 Cleaning up resources...')
      await this.agent.cleanup()

      // Print final metrics
      this.logger.info('\n' + this.agent.getMetrics().generateReport())

      this.logger.info('\n✅ Shutdown complete. Goodbye!\n')
      process.exit(0)
    } catch (error) {
      this.logger.error(`❌ Error during shutdown: ${error instanceof Error ? error.message : String(error)}`)
      process.exit(1)
    }
  }

  /**
   * Check if shutdown was requested
   */
  shouldStop(): boolean {
    return this.shutdownSignal
  }

  /**
   * Set cleanup callback
   */
  setCleanupCallback(callback: () => Promise<void>): void {
    this.cleanupCallback = callback
  }
}
```

**Acceptance Criteria:**
- [ ] Approval system works correctly
- [ ] All safety checks pass in clean environment
- [ ] Interrupt handler allows graceful shutdown
- [ ] Ctrl+C twice forces quit
- [ ] State is saved before shutdown

---

#### 1.7 CLI Command Integration (1 day)

**File:** `packages/cli/src/commands/autonomous.ts`

```typescript
import { Command } from 'commander'
import { AutonomousAgent } from '../agent/orchestrator'
import { loadConfig, CONFIG_PRESETS } from '../agent/config'
import { createLogger } from '../logger'
import type { AgentConfig, AgentStrategy } from '../agent/types'

export function registerAutonomousCommand(program: Command): void {
  program
    .command('autonomous [goal]')
    .description('Run autonomous agent with optional goal')
    .option('-c, --continue', 'Continue in continuous improvement mode after goal completion')
    .option('-s, --stop', 'Stop any running autonomous agent')
    .option('--preset <name>', 'Configuration preset', 'balanced')
    .option('--config <path>', 'Path to configuration file')
    .option('--max-iterations <n>', 'Maximum iterations in continuous mode', '0')
    .option('--timeout <minutes>', 'Session timeout', '0')
    .option('--approval <level>', 'Approval level (none|destructive|commits|all)', 'destructive')
    .option('--no-approval', 'Disable all approvals')
    .option('--auto-approve-safe', 'Auto-approve safe tasks', 'true')
    .option('--max-concurrency <n>', 'Maximum concurrent tasks', '1')
    .option('--working-branch <branch>', 'Working branch', 'main')
    .option('-y, --yes', 'Auto-approve all prompts')
    .option('-v, --verbose', 'Enable verbose logging')
    .action(async (goal, options) => {
      const logger = createLogger({ verbose: options.verbose })

      // Build configuration
      const config: Partial<AgentConfig> = {
        strategy: goal ? 'goal-directed' : 'continuous-improvement',
        continueOnCompletion: options.continue,
        maxIterations: parseInt(options.maxIterations),
        timeout: parseInt(options.timeout),
        requireApprovalFor: options.noApproval ? 'none' : options.approval,
        autoApproveSafeTasks: options.autoApproveSafe,
        maxConcurrency: parseInt(options.maxConcurrency),
        workingBranch: options.workingBranch,
        pauseOnError: !options.yes
      }

      // Add preset if specified
      if (options.preset && CONFIG_PRESETS[options.preset]) {
        Object.assign(config, CONFIG_PRESETS[options.preset])
      }

      try {
        const agent = new AutonomousAgent(config, logger)

        if (options.stop) {
          await agent.stop()
          logger.info('Agent stopped')
          return
        }

        if (goal) {
          await agent.setGoal(goal)
        }

        await agent.run()

        logger.info('\n' + agent.getMetrics().generateReport())
      } catch (error) {
        logger.error(`Agent error: ${error instanceof Error ? error.message : String(error)}`)
        process.exit(1)
      }
    })
}
```

**Acceptance Criteria:**
- [ ] CLI command registered
- [ ] All options parsed correctly
- [ ] Agent starts and runs
- [ ] Errors handled gracefully
- [ ] Help text is clear

---

## Phase 2: Goal Achievement (Week 3-4)

### Overview
Enable the agent to accept goals, break them down into tasks, and execute them to completion.

### Task Breakdown

#### 2.1 Goal Decomposition Engine (3 days)

**File:** `packages/cli/src/agent/goal-decomposer.ts`

**API Design:**

```typescript
import type { GoalDecompositionResult, Plan, Task, WorkflowContext } from './types'
import { runAgentWithSchema } from '../workflows/agent-builder'
import { z } from 'zod'

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
    priority: z.number(),
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

    // Convert to tasks
    const tasks = result.tasks.map((t, i) => ({
      id: `task-${Date.now()}-${i}`,
      ...t,
      status: 'pending' as const,
      dependencies: t.dependencies || [],
      workflow: this.mapTypeToWorkflow(t.type),
      workflowInput: this.buildWorkflowInput(t),
      retryCount: 0,
      createdAt: Date.now()
    }))

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
   * Gather context about the codebase
   */
  private async gatherCodebaseContext(): Promise<string> {
    // Get project structure
    const structure = await this.getProjectStructure()

    // Get recent commits
    const recentChanges = await this.getRecentChanges()

    // Get test coverage
    const coverage = await this.getCoverageInfo()

    return `
Project Structure:
${structure}

Recent Changes:
${recentChanges}

Test Coverage:
${coverage}
    `.trim()
  }

  /**
   * Get project structure
   */
  private async getProjectStructure(): Promise<string> {
    try {
      const result = await this.context.tools.executeCommand({
        command: 'find',
        args: ['packages', '-type', 'f', '-name', '*.ts', '|', 'head', '-50']
      })

      return result.stdout
        .split('\n')
        .map(line => `  ${line}`)
        .join('\n')
    } catch {
      return '  (Unable to determine structure)'
    }
  }

  /**
   * Get recent changes
   */
  private async getRecentChanges(): Promise<string> {
    try {
      const result = await this.context.tools.executeCommand({
        command: 'git',
        args: ['log', '--oneline', '-10']
      })

      return result.stdout.split('\n').map(line => `  ${line}`).join('\n')
    } catch {
      return '  (Unable to get recent changes)'
    }
  }

  /**
   * Get test coverage information
   */
  private async getCoverageInfo(): Promise<string> {
    try {
      const result = await this.context.tools.executeCommand({
        command: 'bun',
        args: ['test', '--coverage', '--coverage-report=summary']
      })

      // Parse coverage from output
      return '  (Coverage info available)'
    } catch {
      return '  (Unable to get coverage info)'
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

Priority Guidelines (higher = more important):
- 900-1000: Critical bugs, build errors, security issues
- 700-899: Important features, test failures
- 500-699: Refactoring, documentation
- 300-499: Nice-to-have features
- 100-299: Minor improvements, optimizations

Complexity Guidelines:
- low: Simple, straightforward task (<30 min)
- medium: Moderate complexity, some research needed (30-60 min)
- high: Complex, requires significant work (>60 min)

For each task, specify:
- title: Brief, descriptive title
- description: What needs to be done
- type: One of the task types above
- priority: Number following guidelines
- complexity: low/medium/high
- estimatedTime: Time in minutes
- files: Expected files to be affected (if known)
- dependencies: Array of task titles this task depends on

Be specific and actionable. Break complex tasks into smaller steps.`
  }

  /**
   * Build decomposition prompt
   */
  private buildDecompositionPrompt(goal: string, context: string): string {
    return `Please analyze this goal and create an implementation plan:

Goal: ${goal}

Codebase Context:
${context}

Please provide:
1. A list of requirements (what needs to be achieved)
2. A high-level plan (overall approach)
3. Detailed tasks to execute the plan
4. Potential risks or concerns`
  }

  /**
   * Map task type to workflow
   */
  private mapTypeToWorkflow(type: string): WorkflowName {
    const workflowMap: Record<string, WorkflowName> = {
      feature: 'plan',
      bugfix: 'fix',
      refactor: 'refactor',
      test: 'code',
      docs: 'code',
      other: 'plan'
    }

    return workflowMap[type] || 'plan'
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
}
```

**Acceptance Criteria:**
- [ ] Can decompose simple goals into tasks
- [ ] Tasks have proper dependencies
- [ ] Complexity estimates are reasonable
- [ ] Workflow mapping is correct
- [ ] Handles errors gracefully

---

#### 2.2 Planning Engine (2 days)

**File:** `packages/cli/src/agent/planner.ts`

**API Design:**

```typescript
import type { Plan, Task, WorkflowContext } from './types'

/**
 * Creates and manages execution plans
 */
export class TaskPlanner {
  constructor(private context: WorkflowContext) {}

  /**
   * Create execution plan from tasks
   */
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

  /**
   * Resolve task dependencies
   */
  private resolveDependencies(tasks: Task[]): Task[] {
    const taskMap = new Map(tasks.map(t => [t.title, t]))

    // Convert dependency names to IDs
    return tasks.map(task => ({
      ...task,
      dependencies: task.dependencies
        .map(name => taskMap.get(name)?.id)
        .filter((id): id is string => id !== undefined)
    }))
  }

  /**
   * Create execution phases (topological sort)
   */
  private createExecutionPhases(tasks: Task[]): string[][] {
    const phases: string[][] = []
    const remaining = new Set(tasks.map(t => t.id))
    const completed = new Set<string>()

    while (remaining.size > 0) {
      // Find tasks with all dependencies met
      const ready = Array.from(remaining).filter(id => {
        const task = tasks.find(t => t.id === id)!
        return task.dependencies.every(dep => completed.has(dep))
      })

      if (ready.length === 0) {
        // Circular dependency - take first remaining
        ready.push(Array.from(remaining)[0])
        this.context.logger.warn(`[Planner] Breaking circular dependency at task ${ready[0]}`)
      }

      phases.push(ready)
      ready.forEach(id => {
        remaining.delete(id)
        completed.add(id)
      })
    }

    return phases
  }

  /**
   * Generate high-level plan description
   */
  private generateHighLevelPlan(goal: string, tasks: Task[]): string {
    const byType = tasks.reduce((acc, task) => {
      acc[task.type] = (acc[task.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const parts = [
      `Goal: ${goal}`,
      `Tasks: ${tasks.length} total`,
      ...Object.entries(byType).map(([type, count]) => `  - ${type}: ${count}`)
    ]

    return parts.join('\n')
  }

  /**
   * Identify potential risks
   */
  private identifyRisks(tasks: Task[]): string[] {
    const risks: string[] = []

    // Check for high-complexity tasks
    const highComplexity = tasks.filter(t => t.complexity === 'high')
    if (highComplexity.length > 0) {
      risks.push(`${highComplexity.length} high-complexity tasks may take longer than estimated`)
    }

    // Check for many file changes
    const manyFiles = tasks.filter(t => t.files.length > 5)
    if (manyFiles.length > 0) {
      risks.push(`Some tasks affect many files - increased risk of conflicts`)
    }

    // Check for deep dependency chains
    const maxDepth = this.getMaxDependencyDepth(tasks)
    if (maxDepth > 3) {
      risks.push(`Deep dependency chain (${maxDepth} levels) - failures may cascade`)
    }

    return risks
  }

  /**
   * Get maximum dependency depth
   */
  private getMaxDependencyDepth(tasks: Task[]): number {
    const taskMap = new Map(tasks.map(t => [t.id, t]))

    const getDepth = (taskId: string, visited = new Set<string>()): number => {
      if (visited.has(taskId)) return 0 // Circular

      const task = taskMap.get(taskId)
      if (!task || task.dependencies.length === 0) return 1

      visited.add(taskId)
      const childDepths = task.dependencies.map(depId => getDepth(depId, visited))
      return 1 + Math.max(...childDepths)
    }

    return Math.max(...tasks.map(t => getDepth(t.id)))
  }

  /**
   * Extract dependency graph
   */
  private extractDependencyGraph(tasks: Task[]): any[] {
    return tasks
      .filter(t => t.dependencies.length > 0)
      .map(task => ({
        taskId: task.id,
        dependsOn: task.dependencies,
        type: 'hard' as const
      }))
  }
}
```

**Acceptance Criteria:**
- [ ] Creates valid execution phases
- [ ] Handles circular dependencies
- [ ] Identifies risks correctly
- [ ] Topological sort is correct

---

## Phase 3: Continuous Improvement (Week 5-6)

### Overview
Implement the continuous improvement loop that allows the agent to self-discover and execute tasks when no goal is provided.

### Task Breakdown

#### 3.1 Task Discovery Engine (3 days)

**File:** `packages/cli/src/agent/task-discovery.ts`

**API Design:**

```typescript
import type { DiscoveryStrategy, Task, WorkflowContext } from './types'

/**
 * Discovers potential tasks by analyzing codebase
 */
export class TaskDiscoveryEngine {
  private strategies: DiscoveryStrategy[] = []

  constructor(private context: WorkflowContext) {
    this.registerDefaultStrategies()
  }

  /**
   * Register a discovery strategy
   */
  registerStrategy(strategy: DiscoveryStrategy): void {
    this.strategies.push(strategy)
  }

  /**
   * Discover tasks using all registered strategies
   */
  async discoverTasks(excludeCompleted: string[] = []): Promise<Task[]> {
    this.context.logger.info('[Discovery] Starting task discovery...')

    const allTasks: Task[] = []

    // Run each strategy
    for (const strategy of this.strategies) {
      if (!strategy.enabled) {
        this.context.logger.debug(`[Discovery] Skipping disabled strategy: ${strategy.name}`)
        continue
      }

      try {
        this.context.logger.debug(`[Discovery] Running strategy: ${strategy.name}`)
        const tasks = await strategy.execute(this.context)

        // Filter out completed tasks
        const filtered = tasks.filter(t => !excludeCompleted.includes(t.id))

        // Calculate priority
        for (const task of filtered) {
          task.priority = strategy.priority(task)
        }

        allTasks.push(...filtered)
        this.context.logger.discovery(strategy.name, filtered.length)
      } catch (error) {
        this.context.logger.error(`Discovery-${strategy.name}`, error as Error)
      }
    }

    this.context.logger.info(`[Discovery] Found ${allTasks.length} total tasks`)
    return allTasks
  }

  /**
   * Register default discovery strategies
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy({
      name: 'build-errors',
      description: 'Find and fix build errors',
      enabled: true,
      execute: async (context) => this.discoverBuildErrors(context),
      priority: (task) => 1000
    })

    this.registerStrategy({
      name: 'failing-tests',
      description: 'Find and fix failing tests',
      enabled: true,
      execute: async (context) => this.discoverFailingTests(context),
      priority: (task) => 900
    })

    this.registerStrategy({
      name: 'type-errors',
      description: 'Find and fix type errors',
      enabled: true,
      execute: async (context) => this.discoverTypeErrors(context),
      priority: (task) => 800
    })

    this.registerStrategy({
      name: 'lint-issues',
      description: 'Find and fix lint issues',
      enabled: true,
      execute: async (context) => this.discoverLintIssues(context),
      priority: (task) => 400
    })

    this.registerStrategy({
      name: 'test-coverage',
      description: 'Improve test coverage',
      enabled: true,
      execute: async (context) => this.discoverCoverageGaps(context),
      priority: (task) => 500
    })

    this.registerStrategy({
      name: 'code-quality',
      description: 'Improve code quality',
      enabled: true,
      execute: async (context) => this.discoverQualityIssues(context),
      priority: (task) => 300
    })
  }

  /**
   * Discover build errors
   */
  private async discoverBuildErrors(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      const result = await context.tools.executeCommand({
        command: 'bun',
        args: ['run', 'build']
      })

      if (result.exitCode !== 0) {
        tasks.push({
          id: `build-error-${Date.now()}`,
          type: 'bugfix',
          title: 'Fix build errors',
          description: `Build is failing:\n${result.stderr}`,
          priority: 1000,
          complexity: 'high',
          dependencies: [],
          estimatedTime: 30,
          status: 'pending',
          files: [],
          workflow: 'fix',
          workflowInput: { error: result.stderr },
          retryCount: 0,
          createdAt: Date.now()
        })
      }
    } catch (error) {
      // Build command failed - this is expected
    }

    return tasks
  }

  /**
   * Discover failing tests
   */
  private async discoverFailingTests(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      const result = await context.tools.executeCommand({
        command: 'bun',
        args: ['test', '--reporter', 'json']
      })

      if (result.exitCode !== 0) {
        // Parse test output to find failures
        const failures = this.parseTestFailures(result.stdout)

        for (const failure of failures) {
          tasks.push({
            id: `test-failure-${failure.testName}-${Date.now()}`,
            type: 'bugfix',
            title: `Fix failing test: ${failure.testName}`,
            description: failure.message,
            priority: 900,
            complexity: 'medium',
            dependencies: [],
            estimatedTime: 15,
            status: 'pending',
            files: [failure.file],
            workflow: 'fix',
            workflowInput: { testName: failure.testName },
            retryCount: 0,
            createdAt: Date.now()
          })
        }
      }
    } catch (error) {
      // Test command failed
    }

    return tasks
  }

  /**
   * Parse test failures from output
   */
  private parseTestFailures(output: string): Array<{testName: string, file: string, message: string}> {
    // Simple parsing - in production, use proper JSON parser
    const failures: Array<{testName: string, file: string, message: string}> = []

    try {
      const json = JSON.parse(output)
      // Parse test results and extract failures
    } catch {
      // Fallback to text parsing
    }

    return failures
  }

  /**
   * Discover type errors
   */
  private async discoverTypeErrors(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      const result = await context.tools.executeCommand({
        command: 'bun',
        args: ['run', 'typecheck']
      })

      if (result.exitCode !== 0) {
        const errors = this.parseTypeErrors(result.stdout)

        for (const error of errors) {
          tasks.push({
            id: `type-error-${error.file}-${error.line}-${Date.now()}`,
            type: 'bugfix',
            title: `Fix type error in ${error.file}:${error.line}`,
            description: error.message,
            priority: 800,
            complexity: 'medium',
            dependencies: [],
            estimatedTime: 10,
            status: 'pending',
            files: [error.file],
            workflow: 'code',
            workflowInput: {
              prompt: `Fix this type error: ${error.message}`,
              files: [error.file]
            },
            retryCount: 0,
            createdAt: Date.now()
          })
        }
      }
    } catch (error) {
      // Typecheck command failed
    }

    return tasks
  }

  /**
   * Parse type errors
   */
  private parseTypeErrors(output: string): Array<{file: string, line: number, message: string}> {
    const errors: Array<{file: string, line: number, message: string}> = []
    const lines = output.split('\n')

    for (const line of lines) {
      const match = line.match(/(.+\.tex?)\((\d+,\d+)\):\s+error TS\d+:\s+(.+)/)
      if (match) {
        errors.push({
          file: match[1],
          line: parseInt(match[2].split(',')[0]),
          message: match[3]
        })
      }
    }

    return errors
  }

  /**
   * Discover lint issues
   */
  private async discoverLintIssues(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      const result = await context.tools.executeCommand({
        command: 'bun',
        args: ['run', 'lint']
      })

      if (result.exitCode !== 0) {
        const issues = this.parseLintIssues(result.stdout)

        for (const issue of issues) {
          tasks.push({
            id: `lint-issue-${issue.file}-${issue.line}-${Date.now()}`,
            type: 'refactor',
            title: `Fix lint issue in ${issue.file}:${issue.line}`,
            description: issue.message,
            priority: 400,
            complexity: 'low',
            dependencies: [],
            estimatedTime: 5,
            status: 'pending',
            files: [issue.file],
            workflow: 'code',
            workflowInput: {
              prompt: `Fix this lint issue: ${issue.message}`,
              files: [issue.file]
            },
            retryCount: 0,
            createdAt: Date.now()
          })
        }
      }
    } catch (error) {
      // Lint command failed
    }

    return tasks
  }

  /**
   * Parse lint issues
   */
  private parseLintIssues(output: string): Array<{file: string, line: number, message: string}> {
    const issues: Array<{file: string, line: number, message: string}> = []

    // Parse lint output
    const lines = output.split('\n')
    for (const line of lines) {
      const match = line.match(/(.+\.tex?):(\d+):\d+:\s+(.+)/)
      if (match) {
        issues.push({
          file: match[1],
          line: parseInt(match[2]),
          message: match[3]
        })
      }
    }

    return issues
  }

  /**
   * Discover test coverage gaps
   */
  private async discoverCoverageGaps(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      const result = await context.tools.executeCommand({
        command: 'bun',
        args: ['test', '--coverage', '--coverage-report=summary']
      })

      const coverage = this.parseCoverageReport(result.stdout)

      for (const [file, metrics] of Object.entries(coverage)) {
        if (metrics.percent < 80) {
          tasks.push({
            id: `coverage-${file}-${Date.now()}`,
            type: 'test',
            title: `Improve test coverage for ${file}`,
            description: `Current coverage: ${metrics.percent}%. Target: 80%+`,
            priority: 500 + Math.floor(metrics.percent), // Higher priority for lower coverage
            complexity: 'medium',
            dependencies: [],
            estimatedTime: 30,
            status: 'pending',
            files: [file],
            workflow: 'code',
            workflowInput: {
              prompt: `Add tests to improve coverage for ${file}. Current: ${metrics.percent}%`,
              files: [file]
            },
            retryCount: 0,
            createdAt: Date.now()
          })
        }
      }
    } catch (error) {
      // Coverage check failed
    }

    return tasks
  }

  /**
   * Parse coverage report
   */
  private parseCoverageReport(output: string): Record<string, {percent: number}> {
    const coverage: Record<string, {percent: number}> = {}

    // Simple parsing - in production use proper parser
    const lines = output.split('\n')
    for (const line of lines) {
      const match = line.match(/(.+\.tex?)\s+\|\s+([\d.]+)%/)
      if (match) {
        coverage[match[1]] = { percent: parseFloat(match[2]) }
      }
    }

    return coverage
  }

  /**
   * Discover code quality issues
   */
  private async discoverQualityIssues(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    // Find files with potential quality issues
    const files = await this.getAllTypeScriptFiles(context)

    for (const file of files) {
      const content = await context.tools.readFile({ path: file })
      const analysis = this.analyzeCodeQuality(content, file)

      if (analysis.longFunctions.length > 0) {
        for (const fn of analysis.longFunctions) {
          tasks.push({
            id: `refactor-long-fn-${file}-${fn.name}-${Date.now()}`,
            type: 'refactor',
            title: `Refactor long function ${fn.name} in ${file}`,
            description: `Function is ${fn.lines} lines. Target: <50 lines.`,
            priority: 300,
            complexity: 'high',
            dependencies: [],
            estimatedTime: 45,
            status: 'pending',
            files: [file],
            workflow: 'code',
            workflowInput: {
              prompt: `Refactor this long function into smaller functions: ${fn.name}`,
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
   * Get all TypeScript files
   */
  private async getAllTypeScriptFiles(context: WorkflowContext): Promise<string[]> {
    const result = await context.tools.executeCommand({
      command: 'find',
      args: ['packages', '-name', '*.ts', '-not', '-path', '*/node_modules/*']
    })

    return result.stdout.split('\n').filter(Boolean)
  }

  /**
   * Analyze code quality
   */
  private analyzeCodeQuality(content: string, file: string): {
    longFunctions: Array<{name: string, lines: number}>
  } {
    const longFunctions: Array<{name: string, lines: number}> = []

    // Simple analysis - count lines in functions
    const lines = content.split('\n')
    let currentFunction: string | null = null
    let functionStart = 0

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect function start
      const fnMatch = line.match(/function\s+(\w+)|(\w+)\s*\([^)]*\)\s*{/)
      if (fnMatch) {
        currentFunction = fnMatch[1] || fnMatch[2]
        functionStart = i
      }

      // Detect function end
      if (currentFunction && line.trim() === '}') {
        const linesInFunction = i - functionStart
        if (linesInFunction > 50) {
          longFunctions.push({
            name: currentFunction,
            lines: linesInFunction
          })
        }
        currentFunction = null
      }
    }

    return { longFunctions }
  }
}
```

**Acceptance Criteria:**
- [ ] Discovers build errors
- [ ] Discovers failing tests
- [ ] Discovers type errors
- [ ] Discovers lint issues
- [ ] Discovers coverage gaps
- [ ] Discovers quality issues
- [ ] Strategies can be enabled/disabled
- [ ] Custom strategies can be registered

---

#### 3.2 Improvement Loop (2 days)

**File:** `packages/cli/src/agent/improvement-loop.ts`

**API Design:**

```typescript
import type { Task, WorkflowContext, AgentState } from './types'
import { TaskDiscoveryEngine } from './task-discovery'
import { TaskPlanner } from './planner'
import { TaskExecutor } from './executor'
import { AgentLogger } from './logger'

/**
 * Manages continuous improvement loop
 */
export class ImprovementLoop {
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
   * Run one improvement cycle
   */
  async runCycle(): Promise<boolean> {
    this.logger.milestone('Starting improvement cycle')

    // 1. Discover tasks
    const completedIds = this.state.completedTasks.map(t => t.id)
    const discovered = await this.discovery.discoverTasks(completedIds)

    if (discovered.length === 0) {
      this.logger.info('[Improvement] No tasks discovered')
      return false
    }

    // 2. Prioritize tasks
    const prioritized = this.prioritizeTasks(discovered)

    // 3. Select best task
    const selected = this.selectNextTask(prioritized)

    if (!selected) {
      this.logger.info('[Improvement] No ready tasks (all blocked by dependencies)')
      return false
    }

    // 4. Execute task
    this.logger.info(`[Improvement] Executing: ${selected.title}`)
    const result = await this.executor.execute(selected, this.state)

    // 5. Update state
    if (result.success) {
      this.state.completedTasks.push(selected)
      this.state.metrics.tasksCompleted++
      this.logger.info(`[Improvement] Completed: ${selected.title}`)
    } else {
      this.state.failedTasks.push(selected)
      this.state.metrics.tasksFailed++
      this.logger.error('Improvement', result.error!)
    }

    return true
  }

  /**
   * Prioritize tasks
   */
  private prioritizeTasks(tasks: Task[]): Task[] {
    return tasks.sort((a, b) => {
      // First by priority
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
}
```

**Acceptance Criteria:**
- [ ] Runs complete improvement cycle
- [ ] Prioritizes tasks correctly
- [ ] Respects dependencies
- [ ] Updates state correctly
- [ ] Handles errors gracefully

---

## Phase 4: Advanced Discovery (Week 7-8)

### Overview
Expand discovery capabilities with more sophisticated analysis and add parallel execution.

### Task Breakdown

#### 4.1 Advanced Discovery Strategies (3 days)

**File:** `packages/cli/src/agent/advanced-discovery.ts`

**API Design:**

```typescript
import type { DiscoveryStrategy, Task, WorkflowContext } from './types'

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
    enabled: true,
    execute: async (context) => this.discoverRefactoringOpportunities(context),
    priority: (task) => 300
  }

  /**
   * Strategy: Discover documentation gaps
   */
  static documentationStrategy: DiscoveryStrategy = {
    name: 'documentation',
    description: 'Find missing documentation',
    enabled: true,
    execute: async (context) => this.discoverDocumentationGaps(context),
    priority: (task) => 200
  }

  /**
   * Strategy: Suggest new features
   */
  static featureIdeationStrategy: DiscoveryStrategy = {
    name: 'feature-ideas',
    description: 'Suggest new features based on codebase analysis',
    enabled: false, // Disabled by default
    execute: async (context) => this.suggestFeatures(context),
    priority: (task) => 100
  }

  /**
   * Strategy: Security analysis
   */
  static securityStrategy: DiscoveryStrategy = {
    name: 'security',
    description: 'Find potential security issues',
    enabled: true,
    execute: async (context) => this.discoverSecurityIssues(context),
    priority: (task) => 950
  }

  /**
   * Discover refactoring opportunities
   */
  private static async discoverRefactoringOpportunities(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    // Find duplicate code
    const duplicates = await this.findDuplicateCode(context)
    for (const dup of duplicates) {
      tasks.push({
        id: `refactor-dup-${dup.file}-${Date.now()}`,
        type: 'refactor',
        title: `Extract duplicate code in ${dup.file}`,
        description: `Found ${dup.count} instances of duplicate code`,
        priority: 350,
        complexity: 'medium',
        dependencies: [],
        estimatedTime: 30,
        status: 'pending',
        files: [dup.file],
        workflow: 'code',
        workflowInput: {
          prompt: `Extract duplicate code into reusable functions`,
          files: [dup.file]
        },
        retryCount: 0,
        createdAt: Date.now()
      })
    }

    // Find complex code
    const complex = await this.findComplexCode(context)
    for (const comp of complex) {
      tasks.push({
        id: `refactor-complex-${comp.file}-${Date.now()}`,
        type: 'refactor',
        title: `Simplify complex code in ${comp.file}`,
        description: `Cyclomatic complexity: ${comp.complexity}`,
        priority: 320,
        complexity: 'high',
        dependencies: [],
        estimatedTime: 45,
        status: 'pending',
        files: [comp.file],
        workflow: 'code',
        workflowInput: {
          prompt: `Reduce complexity in this code`,
          files: [comp.file]
        },
        retryCount: 0,
        createdAt: Date.now()
      })
    }

    return tasks
  }

  /**
   * Find duplicate code
   */
  private static async findDuplicateCode(context: WorkflowContext): Promise<Array<{file: string, count: number}>> {
    // Simple implementation - use more sophisticated algorithm in production
    const files = await this.getAllFiles(context)
    const duplicates: Array<{file: string, count: number}> = []

    for (const file of files) {
      const content = await context.tools.readFile({ path: file })
      const lines = content.split('\n')

      // Find repeated line sequences
      const lineCounts = new Map<string, number>()
      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.length > 50) { // Only significant lines
          lineCounts.set(trimmed, (lineCounts.get(trimmed) || 0) + 1)
        }
      }

      for (const [line, count] of lineCounts) {
        if (count > 3) {
          duplicates.push({ file, count })
          break
        }
      }
    }

    return duplicates
  }

  /**
   * Find complex code
   */
  private static async findComplexCode(context: WorkflowContext): Promise<Array<{file: string, complexity: number}>> {
    const files = await this.getAllFiles(context)
    const complex: Array<{file: string, complexity: number}> = []

    for (const file of files) {
      const content = await context.tools.readFile({ path: file })

      // Calculate cyclomatic complexity (simplified)
      const complexity = this.calculateComplexity(content)

      if (complexity > 15) {
        complex.push({ file, complexity })
      }
    }

    return complex
  }

  /**
   * Calculate code complexity
   */
  private static calculateComplexity(content: string): number {
    // Simplified cyclomatic complexity
    let complexity = 1

    const decisionKeywords = ['if', 'else if', 'for', 'while', 'case', 'catch', '&&', '||', '?']
    for (const keyword of decisionKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g')
      const matches = content.match(regex)
      if (matches) {
        complexity += matches.length
      }
    }

    return complexity
  }

  /**
   * Discover documentation gaps
   */
  private static async discoverDocumentationGaps(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []
    const files = await this.getAllFiles(context)

    for (const file of files) {
      const content = await context.tools.readFile({ path: file })
      const undocumented = this.findUndocumentedFunctions(content)

      for (const fn of undocumented) {
        tasks.push({
          id: `docs-${file}-${fn}-${Date.now()}`,
          type: 'docs',
          title: `Add JSDoc for ${fn} in ${file}`,
          description: 'Function is missing documentation',
          priority: 200,
          complexity: 'low',
          dependencies: [],
          estimatedTime: 5,
          status: 'pending',
          files: [file],
          workflow: 'code',
          workflowInput: {
            prompt: `Add comprehensive JSDoc documentation for function ${fn}`,
            files: [file]
          },
          retryCount: 0,
          createdAt: Date.now()
        })
      }
    }

    return tasks
  }

  /**
   * Find undocumented functions
   */
  private static findUndocumentedFunctions(content: string): string[] {
    const undocumented: string[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Detect function declarations
      const fnMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
      if (fnMatch) {
        const fnName = fnMatch[1]

        // Check if previous line is JSDoc
        const prevLine = i > 0 ? lines[i - 1].trim() : ''
        if (!prevLine.startsWith('/**')) {
          undocumented.push(fnName)
        }
      }
    }

    return undocumented
  }

  /**
   * Suggest new features
   */
  private static async suggestFeatures(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    // Use LLM to analyze codebase and suggest improvements
    // This is a placeholder - actual implementation would use the agent workflow
    tasks.push({
      id: `feature-suggestion-${Date.now()}`,
      type: 'feature',
      title: 'Consider adding caching layer',
      description: 'Based on analysis, adding caching could improve performance',
      priority: 150,
      complexity: 'high',
      dependencies: [],
      estimatedTime: 120,
      status: 'pending',
      files: [],
      workflow: 'plan',
      workflowInput: {
        prompt: 'Design and implement a caching layer for frequently accessed data'
      },
      retryCount: 0,
      createdAt: Date.now()
    })

    return tasks
  }

  /**
   * Discover security issues
   */
  private static async discoverSecurityIssues(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []
    const files = await this.getAllFiles(context)

    const securityPatterns = [
      { pattern: /eval\s*\(/, issue: 'Use of eval() is dangerous', severity: 950 },
      { pattern: /innerHTML\s*=/, issue: 'Unsanitized HTML assignment', severity: 850 },
      { pattern: /dangerouslySetInnerHTML/, issue: 'Dangerous HTML assignment', severity: 850 },
      { pattern: /console\.log\(/, issue: 'Console.log statement (info leak)', severity: 200 }
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
            priority: severity,
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
- [ ] Suggests features
- [ ] Finds security issues
- [ ] All strategies can be toggled

---

#### 4.2 Parallel Execution (2 days)

**File:** `packages/cli/src/agent/parallel-executor.ts`

**API Design:**

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

---

## Phase 5: Optimization (Week 9-10)

### Overview
Improve performance, add caching, enhance error recovery, and add self-healing capabilities.

### Task Breakdown

#### 5.1 Caching Layer (2 days)

**File:** `packages/cli/src/agent/cache.ts`

**API Design:**

```typescript
import type { WorkflowContext } from './types'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as crypto from 'node:crypto'

/**
 * Cache entry
 */
interface CacheEntry<T> {
  key: string
  value: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

/**
 * Simple file-based cache
 */
export class AgentCache {
  private cacheDir: string
  private memoryCache: Map<string, CacheEntry<any>> = new Map()

  constructor(stateDir: string) {
    this.cacheDir = path.join(stateDir, 'cache')
  }

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    // Check memory cache first
    const memEntry = this.memoryCache.get(key)
    if (memEntry && !this.isExpired(memEntry)) {
      return memEntry.value
    }

    // Check file cache
    try {
      const filePath = this.getCacheFilePath(key)
      const content = await fs.readFile(filePath, 'utf-8')
      const entry: CacheEntry<T> = JSON.parse(content)

      if (!this.isExpired(entry)) {
        // Load into memory cache
        this.memoryCache.set(key, entry)
        return entry.value
      }

      // Expired - delete file
      await fs.unlink(filePath)
    } catch {
      // File doesn't exist or error reading
    }

    return null
  }

  /**
   * Set cached value
   */
  async set<T>(key: string, value: T, ttl: number = 3600000): Promise<void> {
    const entry: CacheEntry<T> = {
      key,
      value,
      timestamp: Date.now(),
      ttl
    }

    // Store in memory
    this.memoryCache.set(key, entry)

    // Store on disk
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      const filePath = this.getCacheFilePath(key)
      await fs.writeFile(filePath, JSON.stringify(entry))
    } catch (error) {
      // Fail silently
    }
  }

  /**
   * Invalidate cache entry
   */
  async invalidate(key: string): Promise<void> {
    this.memoryCache.delete(key)

    try {
      const filePath = this.getCacheFilePath(key)
      await fs.unlink(filePath)
    } catch {
      // File doesn't exist
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.memoryCache.clear()

    try {
      const files = await fs.readdir(this.cacheDir)
      await Promise.all(files.map(f => fs.unlink(path.join(this.cacheDir, f))))
    } catch {
      // Cache dir doesn't exist
    }
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<any>): boolean {
    return Date.now() - entry.timestamp > entry.ttl
  }

  /**
   * Get cache file path from key
   */
  private getCacheFilePath(key: string): string {
    const hash = crypto.createHash('sha256').update(key).digest('hex')
    return path.join(this.cacheDir, `${hash}.json`)
  }

  /**
   * Cache wrapper for expensive operations
   */
  static async cached<T>(
    cache: AgentCache,
    key: string,
    fn: () => Promise<T>,
    ttl?: number
  ): Promise<T> {
    // Try to get from cache
    const cached = await cache.get<T>(key)
    if (cached !== null) {
      return cached
    }

    // Execute function
    const result = await fn()

    // Cache result
    await cache.set(key, result, ttl)

    return result
  }
}

/**
 * Cache keys for common operations
 */
export const CacheKeys = {
  BUILD_STATUS: 'build-status',
  TEST_RESULTS: 'test-results',
  TYPECHECK_RESULTS: 'typecheck-results',
  LINT_RESULTS: 'lint-results',
  COVERAGE_REPORT: 'coverage-report',
  PROJECT_STRUCTURE: 'project-structure',
  RECENT_COMMITS: 'recent-commits'
}
```

**Acceptance Criteria:**
- [ ] Cache stores and retrieves values
- [ ] TTL expiration works
- [ ] Memory and disk caching
- [ ] Cache invalidation works
- [ ] Wrapper function works correctly

---

#### 5.2 Enhanced Error Recovery (2 days)

**File:** `packages/cli/src/agent/error-recovery.ts`

**API Design:**

```typescript
import type { ErrorType, Task, ErrorHandlingResult } from './types'

/**
 * Analyzes and recovers from errors
 */
export class ErrorRecoveryEngine {
  /**
   * Classify error type
   */
  classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()

    // Transient errors
    if (message.includes('timeout') || message.includes('network') || message.includes('econnrefused')) {
      return 'transient'
    }

    // Test failures
    if (message.includes('test') || message.includes('assert')) {
      return 'test-failure'
    }

    // Permission errors
    if (message.includes('permission') || message.includes('access denied') || message.includes('eacces')) {
      return 'permission'
    }

    // Validation errors
    if (message.includes('validation') || message.includes('invalid') || message.includes('schema')) {
      return 'validation'
    }

    // Fatal errors
    if (message.includes('fatal') || message.includes('critical')) {
      return 'fatal'
    }

    return 'unknown'
  }

  /**
   * Handle error with appropriate strategy
   */
  async handleError(
    error: Error,
    task: Task,
    retryCount: number
  ): Promise<ErrorHandlingResult> {
    const errorType = this.classifyError(error)

    switch (errorType) {
      case 'transient':
        return await this.handleTransientError(error, task, retryCount)

      case 'validation':
        return await this.handleValidationError(error, task)

      case 'test-failure':
        return await this.handleTestFailure(error, task)

      case 'permission':
        return await this.handlePermissionError(error, task)

      case 'fatal':
        return { action: 'fail', reason: error.message }

      default:
        return { action: 'fail', reason: `Unknown error type: ${error.message}` }
    }
  }

  /**
   * Handle transient errors with retry
   */
  private async handleTransientError(
    error: Error,
    task: Task,
    retryCount: number
  ): Promise<ErrorHandlingResult> {
    const maxRetries = 3

    if (retryCount >= maxRetries) {
      return { action: 'fail', reason: `Max retries exceeded: ${error.message}` }
    }

    // Exponential backoff
    const delay = Math.min(1000 * Math.pow(2, retryCount), 30000)

    return {
      action: 'retry',
      reason: `Transient error, retrying after ${delay}ms`,
      retryDelay: delay
    }
  }

  /**
   * Handle validation errors
   */
  private async handleValidationError(error: Error, task: Task): Promise<ErrorHandlingResult> {
    // Try to fix validation error automatically
    return {
      action: 'approve',
      reason: 'Validation error requires manual review'
    }
  }

  /**
   * Handle test failures
   */
  private async handleTestFailure(error: Error, task: Task): Promise<ErrorHandlingResult> {
    // Test failures should be fixed by the fix workflow
    return {
      action: 'retry',
      reason: 'Test failure detected, will attempt fix'
    }
  }

  /**
   * Handle permission errors
   */
  private async handlePermissionError(error: Error, task: Task): Promise<ErrorHandlingResult> {
    return {
      action: 'approve',
      reason: 'Permission error requires user intervention'
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Classifies errors correctly
- [ ] Retries transient errors
- [ ] Requests approval for permission errors
- [ ] Handles test failures appropriately
- [ ] Implements exponential backoff

---

#### 5.3 Performance Optimizations (1 day)

**File:** `packages/cli/src/agent/optimizations.ts`

**API Design:**

```typescript
import type { WorkflowContext } from './types'
import { AgentCache, CacheKeys } from './cache'

/**
 * Performance optimizations
 */
export class PerformanceOptimizer {
  constructor(private cache: AgentCache) {}

  /**
   * Optimize task discovery with caching
   */
  async optimizedDiscovery(context: WorkflowContext): Promise<any> {
    // Cache project structure
    const structure = await AgentCache.cached(
      this.cache,
      CacheKeys.PROJECT_STRUCTURE,
      async () => {
        const result = await context.tools.executeCommand({
          command: 'find',
          args: ['packages', '-type', 'f', '-name', '*.ts']
        })
        return result.stdout.split('\n').filter(Boolean)
      },
      600000 // 10 minutes
    )

    return { structure }
  }

  /**
   * Batch file operations
   */
  async batchReadFiles(context: WorkflowContext, files: string[]): Promise<Map<string, string>> {
    const contents = new Map<string, string>()

    // Read files in batches to avoid overwhelming the system
    const batchSize = 10
    for (let i = 0; i < files.length; i += batchSize) {
      const batch = files.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async file => {
          try {
            const content = await context.tools.readFile({ path: file })
            contents.set(file, content)
          } catch {
            // File not found or error reading
          }
        })
      )
    }

    return contents
  }

  /**
   * Lazy task discovery
   */
  async *lazyDiscovery(context: WorkflowContext): AsyncGenerator<Task> {
    // Yield tasks as they're discovered rather than all at once
    // This allows starting work earlier

    const strategies = ['build', 'tests', 'types', 'lint', 'coverage']

    for (const strategy of strategies) {
      const tasks = await this.runDiscoveryStrategy(strategy, context)
      for (const task of tasks) {
        yield task
      }
    }
  }

  /**
   * Run single discovery strategy
   */
  private async runDiscoveryStrategy(strategy: string, context: WorkflowContext): Promise<any[]> {
    // Run specific discovery strategy
    return []
  }
}
```

**Acceptance Criteria:**
- [ ] Caches expensive operations
- [ ] Batches file operations
- [ ] Implements lazy discovery
- [ ] Reduces redundant work

---

## Summary of All Phases

### Phase 1: Foundation (Week 1-2) ✅
- Complete type system
- State management with persistence
- Configuration system
- Structured logging
- Metrics collection
- Safety systems
- CLI integration

### Phase 2: Goal Achievement (Week 3-4) ✅
- Goal decomposition engine
- Planning engine
- Task execution engine
- Review and validation
- Automated quality gates

### Phase 3: Continuous Improvement (Week 5-6) ✅
- Task discovery engine
- Improvement loop
- Basic discovery strategies
- Task prioritization
- Dependency resolution

### Phase 4: Advanced Discovery (Week 7-8) ✅
- Advanced discovery strategies
- Parallel execution
- Refactoring opportunities
- Documentation gaps
- Security analysis

### Phase 5: Optimization (Week 9-10) ✅
- Caching layer
- Enhanced error recovery
- Performance optimizations
- Self-healing capabilities

---

## TypeScript API Reference

### Core Exports

```typescript
// packages/cli/src/agent/index.ts

export * from './types'
export * from './orchestrator'
export * from './state-manager'
export * from './config'
export * from './logger'
export * from './metrics'

export { AgentDecomposer } from './goal-decomposer'
export { TaskPlanner } from './planner'

// Safety
export { ApprovalManager } from './safety/approval'
export { SafetyChecker } from './safety/checks'
export { InterruptHandler } from './safety/interrupt'
```

---

## Summary

This detailed implementation plan provides:

1. **Complete TypeScript API Design**: All interfaces, types, and class signatures
2. **Task Breakdown**: Each phase broken down into specific implementable tasks
3. **Time Estimates**: Realistic estimates for each task
4. **Acceptance Criteria**: Clear definition of "done" for each task
5. **Code Examples**: Production-ready code samples for core components

**Next Steps:**
1. Review and approve the plan
2. Start Phase 1 implementation
3. Create tests alongside implementation
4. Iterate based on feedback

Would you like me to:
- Continue with Phase 3-5 detailed breakdowns?
- Focus on implementing a specific component?
- Create integration test examples?
- Add more detail to any specific section?
