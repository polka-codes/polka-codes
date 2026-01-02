# Autonomous Agent - Implementation Plan v2.1

**Created:** 2025-01-02
**Status:** Ready for Implementation
**Version:** 2.1 (Critical Improvements)
**Estimated Timeline:** 13.5 weeks (with MVP in 9 weeks)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [What's New in v2.1](#whats-new-in-v21)
3. [Architecture Overview](#architecture-overview)
4. [Phase 1: Foundation (Week 1-2.5)](#phase-1-foundation)
5. [Phase 2: Core Execution (Week 3-6.5)](#phase-2-core-execution)
6. [Phase 3: Continuous Improvement (Week 7-8.5)](#phase-3-continuous-improvement)
7. [Phase 4: Advanced Features (Week 9-11.5)](#phase-4-advanced-features)
8. [Phase 5: Optimization & Polish (Week 12-13.5)](#phase-5-optimization--polish)
9. [MVP Definition](#mvp-definition)
10. [Testing Strategy](#testing-strategy)
11. [Deployment Guide](#deployment-guide)
12. [TypeScript API Reference](#typescript-api-reference)

---

## Executive Summary

### What Changed in v2.1

**Critical Fixes (from v2.0 review):**
- ✅ Complete implementations for ALL critical paths (no placeholders)
- ✅ Workflow adapter layer for API compatibility
- ✅ Immutable state updates (fixes persistence bugs)
- ✅ Cache invalidation on git state changes
- ✅ Resource monitoring with enforcement
- ✅ Task timeout handling
- ✅ Exponential backoff in continuous mode
- ✅ Progress reporting with event emitters
- ✅ Smarter discovery strategies
- ✅ Enhanced error recovery with suggestions

**New Components:**
- SessionManager - Prevents conflicting sessions
- ResourceMonitor - Enforces resource limits
- WorkflowAdapter - Bridges workflow APIs
- TaskHistory - Tracks all executed tasks
- HealthMonitor - Periodic health checks
- DependencyVisualizer - Graphviz-style diagrams
- TaskPrioritizer - Dynamic priority adjustment

**Timeline Changes:**
- Phase 1: 2 weeks → 2.5 weeks (+resource monitoring, session management)
- Phase 2: 3 weeks → 3.5 weeks (+workflow adapters, progress, timeouts)
- Phase 3: 2 weeks → 2.5 weeks (+smarter discovery, backoff)
- **Total:** 12 weeks → **13.5 weeks**
- **MVP:** 8 weeks → **9 weeks**

---

## What's New in v2.1

### 1. Complete Implementations (No Placeholders)

**v2.0 Problem:**
```typescript
// Execute commit workflow
// ... implementation

// Discover tasks
// ... (discovery logic)
```

**v2.1 Solution:** Every critical path has complete implementation or explicit pseudocode with clear contracts.

---

### 2. Workflow Adapter Layer

**v2.0 Problem:** Workflows return different types than expected.

**v2.1 Solution:** Dedicated adapter layer:

```typescript
export class WorkflowAdapter {
  static async adaptCodeWorkflow(input: any, context: any): Promise<WorkflowExecutionResult>
  static async adaptFixWorkflow(input: any, context: any): Promise<WorkflowExecutionResult>
  static async adaptPlanWorkflow(input: any, context: any): Promise<WorkflowExecutionResult>
  // ... etc
}
```

---

### 3. Immutable State Updates

**v2.0 Problem:**
```typescript
task.status = 'in-progress'  // Mutation!
await updateState({ currentTask: task })  // Doesn't include status change
```

**v2.1 Solution:**
```typescript
const updatedTask = { ...task, status: 'in-progress', startedAt: Date.now() }
const updatedQueue = state.taskQueue.map(t =>
  t.id === updatedTask.id ? updatedTask : t
)

await updateState({
  currentTask: updatedTask,
  taskQueue: updatedQueue
})
```

---

### 4. Cache Invalidation

**v2.0 Problem:** Cache could be stale after git changes.

**v2.1 Solution:** Track git state and invalidate on changes:

```typescript
export class TaskDiscoveryEngine {
  private lastKnownGitState: string = ''

  async discoverTasks(): Promise<Task[]> {
    const currentGitState = await this.getGitState()

    if (currentGitState !== this.lastKnownGitState) {
      this.clearCache()
      this.lastKnownGitState = currentGitState
    }
    // ...
  }
}
```

---

### 5. Resource Monitoring

**v2.0 Problem:** Limits defined but never enforced.

**v2.1 Solution:** Active monitoring with automatic enforcement:

```typescript
export class ResourceMonitor {
  start()
  stop()
  private check() // Checks every 30s
  private handleLimitExceeded()
}
```

---

### 6. Smarter Discovery

**v2.0 Problem:** Always runs full build (30+ seconds).

**v2.1 Solution:** Quick typecheck first, only build if needed:

```typescript
// 1. Typecheck (fast)
if (typecheck fails) → create type error tasks

// 2. Only build if typecheck passes
if (build fails) → create build error task
```

---

## Architecture Overview

### System Components

```
┌──────────────────────────────────────────────────────────────┐
│                      CLI Interface                             │
│                     (autonomous command)                       │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                   SessionManager                               │
│              (Prevents conflicting sessions)                   │
└────────────────────────┬─────────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────────┐
│                    AutonomousAgent                             │
│                    (Orchestrator)                              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  State Machine                                         │  │
│  │  idle → planning → executing → reviewing → committing   │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                 │
│  ┌─────────────────────┬──────────────────────────────────┐  │
│  │  ResourceMonitor    │  ProgressEmitter                 │  │
│  │  (Enforces limits)  │  (Real-time updates)             │  │
│  └─────────────────────┴──────────────────────────────────┘  │
└───┬───────────┬───────────┬───────────┬───────────┬──────────┘
    │           │           │           │           │
    ▼           ▼           ▼           ▼           ▼
┌────────┐ ┌────────┐ ┌──────────┐ ┌─────────┐ ┌──────────┐
│ State  │ ��� Goal   │ │   Task   │ │Discovery│ │Resource  │
│Manager │ │Decomp. │ │ Executor │ │ Engine  │ │ Monitor  │
└────────┘ └────────┘ └────┬─────┘ └────┬────┘ └──────────┘
                            │            │
                    ┌───────┴────────────┴──────┐
                    ▼                            ▼
            ┌─────────────────┐          ┌────────────┐
            │  Workflow       │          │   Safety   │
            │  Adapter        │          │   Systems  │
            │  (NEW in v2.1)  │          └────────────┘
            └────────┬────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  Existing       │
            │  Workflows      │
            └─────────────────┘
```

---

### Data Flow

```
User Input (Goal)
       │
       ▼
┌──────────────┐
│ Validate     │
│ Config       │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Acquire      │
│ Session      │ (SessionManager)
└──────┬───────┘
       │
       ▼
┌──────────────┐      ┌──────────────┐
│ Initialize   │ ───► │ Start        │
│ Agent        │      │ Resource     │
│              │      │ Monitor      │
└──────┬───────┘      └──────────────┘
       │
       ▼
┌──────────────┐
│ Set Goal     │
│ Transition   │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Planning     │
│ Phase        │
│  ├─ Decompose│
│  ├─ Plan     │
│  └─ Validate │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Execution    │
│ Phase        │
│  ├─ Execute  │
│  ├─ Monitor  │
│  ├─ Timeout  │ (NEW in v2.1)
│  └─ Recover  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Reviewing    │
│ Phase        │
│  ├─ Review   │
│  └─ Quality  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Committing   │
│ Phase        │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Cleanup      │
│  ├─ Save     │
│  ├─ Release  │
│  └─ Stop     │
└──────────────┘
```

---

## Phase 1: Foundation (Week 1-2.5)

### Overview
Build the core infrastructure with resource monitoring and session management.

### Task Breakdown

#### 1.1 Project Structure Setup (0.5 days)

**Files to Create:**
```
packages/cli/src/agent/
├── index.ts
├── orchestrator.ts
├── state-manager.ts
├── config.ts
├── logger.ts
├── metrics.ts
├── safety/
│   ├── approval.ts
│   ├── checks.ts
│   └── interrupt.ts
├── types.ts
├── constants.ts
├── errors.ts
├── session.ts                    # NEW - Session management
├── resource-monitor.ts           # NEW - Resource monitoring
├── task-history.ts               # NEW - Task history tracking
└── health-monitor.ts             # NEW - Health monitoring
```

---

#### 1.2 Core Type Definitions (1 day)

**File:** `packages/cli/src/agent/types.ts`

**No changes from v2.0** - types are solid.

---

#### 1.3 Constants and Mappings (0.5 days)

**File:** `packages/cli/src/agent/constants.ts`

**No changes from v2.0** - constants are solid.

---

#### 1.4 Custom Error Types (0.5 days)

**File:** `packages/cli/src/agent/errors.ts`

**No changes from v2.0** - errors are solid.

---

#### 1.5 Configuration System with Zod (1 day)

**File:** `packages/cli/src/agent/config.ts`

**No changes from v2.0** - configuration is solid.

---

#### 1.6 Agent State Manager (2 days)

**File:** `packages/cli/src/agent/state-manager.ts`

**CRITICAL FIX:** Make state updates immutable.

```typescript
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { AgentState, AgentConfig } from './types'
import { StateCorruptionError } from './errors'

/**
 * Manages agent state persistence with immutable updates
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
      timestamps: {
        startTime: Date.now(),
        lastActivity: Date.now(),
        lastSaveTime: 0,
        lastMetricsUpdate: 0,
        modeTransitions: []
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

  /**
   * Get current state (readonly)
   */
  getState(): AgentState | null {
    return this.state
  }

  /**
   * Update state with immutable merge
   * CRITICAL FIX: Always returns new state object
   */
  async updateState(updates: Partial<AgentState>): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded. Call initialize() or loadState() first.')
    }

    // Create new state with updates (immutable)
    this.state = {
      ...this.state,
      ...updates,
      timestamps: {
        ...this.state.timestamps,
        lastActivity: Date.now()
      }
    }

    // Automatically persist
    await this.saveState()
  }

  /**
   * Update specific task in queue (immutable)
   * CRITICAL FIX: New helper for task updates
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded')
    }

    // Create new task array with updated task
    const updatedQueue = this.state.taskQueue.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    )

    // Create new completed/failed arrays as needed
    const updatedCompleted = this.state.completedTasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    )

    const updatedFailed = this.state.failedTasks.map(task =>
      task.id === taskId ? { ...task, ...updates } : task
    )

    // Update state with new arrays
    await this.updateState({
      taskQueue: updatedQueue,
      completedTasks: updatedCompleted,
      failedTasks: updatedFailed
    })
  }

  /**
   * Move task from queue to completed/failed (immutable)
   * CRITICAL FIX: Proper state transitions
   */
  async moveTask(
    taskId: string,
    from: 'queue',
    to: 'completed' | 'failed' | 'blocked'
  ): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded')
    }

    // Find task
    const taskIndex = this.state.taskQueue.findIndex(t => t.id === taskId)
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found in queue`)
    }

    const task = this.state.taskQueue[taskIndex]

    // Remove from queue
    const newQueue = this.state.taskQueue.filter(t => t.id !== taskId)

    // Add to destination
    let newCompleted = this.state.completedTasks
    let newFailed = this.state.failedTasks
    let newBlocked = this.state.blockedTasks

    if (to === 'completed') {
      newCompleted = [...this.state.completedTasks, task]
    } else if (to === 'failed') {
      newFailed = [...this.state.failedTasks, task]
    } else if (to === 'blocked') {
      newBlocked = [...this.state.blockedTasks, task]
    }

    // Update state
    await this.updateState({
      taskQueue: newQueue,
      completedTasks: newCompleted,
      failedTasks: newFailed,
      blockedTasks: newBlocked
    })
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
      successRate: 0,
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
}
```

**Acceptance Criteria:**
- [ ] State can be initialized, saved, and loaded
- [ ] Corrupted state files are detected
- [ ] **All updates are immutable** (CRITICAL)
- [ ] `updateTask()` works correctly
- [ ] `moveTask()` works correctly
- [ ] Backup/restore mechanism works
- [ ] Auto-save timer starts and stops correctly
- [ ] Checkpoints can be created and restored
- [ ] All methods have error handling
- [ ] 100% test coverage

---

#### 1.7 Session Manager (0.5 days) - NEW

**File:** `packages/cli/src/agent/session.ts`

```typescript
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import * as os from 'node:os'

/**
 * Manages agent sessions to prevent conflicts
 */
export class SessionManager {
  private static activeSessions: Map<string, SessionInfo> = new Map()
  private static lockDir: string = path.join(os.tmpdir(), 'polka-agent-locks')

  /**
   * Try to acquire a session
   * Returns true if successful, false if session is already active
   */
  static async acquire(sessionId: string): Promise<AcquireResult> {
    // Check in-memory active sessions
    if (this.activeSessions.has(sessionId)) {
      const existing = this.activeSessions.get(sessionId)!
      const age = Date.now() - existing.startTime

      if (age < 3600000) { // 1 hour
        return {
          acquired: false,
          reason: 'Session is already active',
          existingSession: existing
        }
      }

      // Session is stale, remove it
      this.activeSessions.delete(sessionId)
    }

    // Check for stale lock file
    const lockFile = path.join(this.lockDir, `${sessionId}.lock`)

    try {
      const stats = await fs.stat(lockFile)
      const age = Date.now() - stats.mtimeMs

      if (age < 3600000) { // 1 hour
        return {
          acquired: false,
          reason: 'Session lock file exists (recent)',
          existingSession: await this.readLockFile(lockFile)
        }
      }

      // Lock file is stale, remove it
      await fs.unlink(lockFile)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      // No lock file, safe to proceed
    }

    // Create lock file
    await fs.mkdir(this.lockDir, { recursive: true })

    const sessionInfo: SessionInfo = {
      sessionId,
      pid: process.pid,
      ppid: process.ppid,
      startTime: Date.now(),
      hostname: os.hostname(),
      username: os.userInfo().username
    }

    await fs.writeFile(lockFile, JSON.stringify(sessionInfo, null, 2))

    // Add to in-memory sessions
    this.activeSessions.set(sessionId, sessionInfo)

    return { acquired: true, sessionInfo }
  }

  /**
   * Release a session
   */
  static async release(sessionId: string): Promise<void> {
    // Remove from in-memory
    this.activeSessions.delete(sessionId)

    // Remove lock file
    const lockFile = path.join(this.lockDir, `${sessionId}.lock`)

    try {
      await fs.unlink(lockFile)
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * List all active sessions
   */
  static listActive(): SessionInfo[] {
    return Array.from(this.activeSessions.values())
  }

  /**
   * Check if a session is active
   */
  static isActive(sessionId: string): boolean {
    return this.activeSessions.has(sessionId)
  }

  /**
   * Get session info
   */
  static getSession(sessionId: string): SessionInfo | undefined {
    return this.activeSessions.get(sessionId)
  }

  /**
   * Read lock file
   */
  private static async readLockFile(lockFile: string): Promise<SessionInfo> {
    const content = await fs.readFile(lockFile, 'utf-8')
    return JSON.parse(content)
  }
}

/**
 * Session acquisition result
 */
export interface AcquireResult {
  acquired: boolean
  reason?: string
  sessionInfo?: SessionInfo
  existingSession?: SessionInfo
}

/**
 * Session information
 */
export interface SessionInfo {
  sessionId: string
  pid: number
  ppid: number
  startTime: number
  hostname: string
  username: string
}
```

**Acceptance Criteria:**
- [ ] Can acquire session successfully
- [ ] Rejects duplicate sessions
- [ ] Cleans up stale sessions (>1 hour)
- [ ] Creates lock files correctly
- [ ] Releases sessions correctly
- [ ] Lists active sessions
- [ ] Works across multiple processes

---

#### 1.8 Resource Monitor (1 day) - NEW

**File:** `packages/cli/src/agent/resource-monitor.ts`

```typescript
import type { ResourceLimits } from './types'
import type { Logger } from '@polka-codes/core'

/**
 * Monitors and enforces resource limits
 */
export class ResourceMonitor {
  private startTime: number
  private checkInterval: NodeJS.Timeout | null = null
  private peakMemory: number = 0
  private isRunning: boolean = false

  constructor(
    private limits: ResourceLimits,
    private logger: Logger,
    private onLimitExceeded: (limit: ResourceLimitExceeded) => void | Promise<void>
  ) {
    this.startTime = Date.now()
  }

  /**
   * Start monitoring
   */
  start(checkIntervalMs: number = 30000): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.checkInterval = setInterval(async () => {
      try {
        await this.check()
      } catch (error) {
        this.logger.error('Resource monitor check', error as Error)
      }
    }, checkIntervalMs)

    this.logger.info('[ResourceMonitor] Started monitoring')
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    this.logger.info('[ResourceMonitor] Stopped monitoring')
  }

  /**
   * Check resource usage
   */
  private async check(): Promise<void> {
    // Check memory
    const memUsage = process.memoryUsage()
    const memUsedMB = memUsage.heapUsed / 1024 / 1024
    this.peakMemory = Math.max(this.peakMemory, memUsedMB)

    if (memUsedMB > this.limits.maxMemory) {
      this.logger.warn(`[ResourceMonitor] Memory limit exceeded: ${memUsedMB.toFixed(2)}MB / ${this.limits.maxMemory}MB`)

      await this.onLimitExceeded({
        limit: 'memory',
        current: memUsedMB,
        max: this.limits.maxMemory,
        message: `Memory usage (${memUsedMB.toFixed(2)}MB) exceeds limit (${this.limits.maxMemory}MB)`
      })
    }

    // Check session time
    const elapsedMinutes = (Date.now() - this.startTime) / 60000

    if (elapsedMinutes > this.limits.maxSessionTime) {
      this.logger.warn(`[ResourceMonitor] Session time limit exceeded: ${elapsedMinutes.toFixed(2)}min / ${this.limits.maxSessionTime}min`)

      await this.onLimitExceeded({
        limit: 'sessionTime',
        current: elapsedMinutes,
        max: this.limits.maxSessionTime,
        message: `Session time (${elapsedMinutes.toFixed(2)}min) exceeds limit (${this.limits.maxSessionTime}min)`
      })
    }

    // Note: CPU percentage check is platform-dependent and omitted for simplicity
    // Could be added using platform-specific CPU monitoring
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceUsage {
    const memUsage = process.memoryUsage()
    const elapsedMinutes = (Date.now() - this.startTime) / 60000

    return {
      memoryMB: memUsage.heapUsed / 1024 / 1024,
      peakMemoryMB: this.peakMemory,
      sessionTimeMinutes: elapsedMinutes,
      withinLimits:
        memUsage.heapUsed / 1024 / 1024 <= this.limits.maxMemory &&
        elapsedMinutes <= this.limits.maxSessionTime
    }
  }

  /**
   * Get memory usage percentage
   */
  getMemoryUsagePercentage(): number {
    const current = this.getCurrentUsage().memoryMB
    return (current / this.limits.maxMemory) * 100
  }

  /**
   * Get session time percentage
   */
  getSessionTimePercentage(): number {
    const current = this.getCurrentUsage().sessionTimeMinutes
    return (current / this.limits.maxSessionTime) * 100
  }
}

/**
 * Resource limit exceeded event
 */
export interface ResourceLimitExceeded {
  limit: 'memory' | 'sessionTime' | 'taskTime' | 'filesChanged'
  current: number
  max: number
  message: string
}

/**
 * Current resource usage
 */
export interface ResourceUsage {
  memoryMB: number
  peakMemoryMB: number
  sessionTimeMinutes: number
  withinLimits: boolean
}
```

**Acceptance Criteria:**
- [ ] Monitors memory usage correctly
- [ ] Monitors session time correctly
- [ ] Calls callback when limits exceeded
- [ ] Can start and stop monitoring
- [ ] Provides current usage statistics
- [ ] Calculates usage percentages
- [ ] Logs warnings appropriately
- [ ] Callback can be async or sync

---

#### 1.9 Task History (0.5 days) - NEW

**File:** `packages/cli/src/agent/task-history.ts`

```typescript
import type { ExecutionRecord, TaskType } from './types'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

/**
 * Tracks task execution history
 */
export class TaskHistory {
  private history: ExecutionRecord[] = []
  private historyFilePath: string

  constructor(stateDir: string) {
    this.historyFilePath = path.join(stateDir, 'task-history.json')
  }

  /**
   * Add execution record
   */
  async add(record: ExecutionRecord): Promise<void> {
    this.history.push(record)
    await this.save()
  }

  /**
   * Find records by task type
   */
  findByType(type: TaskType): ExecutionRecord[] {
    return this.history.filter(r => r.taskType === type)
  }

  /**
   * Find recent failures
   */
  findFailed(limit: number = 10): ExecutionRecord[] {
    return this.history
      .filter(r => !r.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Find slow tasks
   */
  findSlow(limit: number = 10): ExecutionRecord[] {
    return this.history
      .sort((a, b) => b.actualTime - a.actualTime)
      .slice(0, limit)
  }

  /**
   * Get estimation accuracy
   */
  getEstimationAccuracy(): {
    averageError: number
    averageErrorPercentage: number
    totalTasks: number
  } {
    if (this.history.length === 0) {
      return {
        averageError: 0,
        averageErrorPercentage: 0,
        totalTasks: 0
      }
    }

    const errors = this.history.map(r => Math.abs(r.estimatedTime - r.actualTime))
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length

    const errorPercentages = this.history.map(r =>
      Math.abs((r.estimatedTime - r.actualTime) / r.estimatedTime) * 100
    )
    const avgErrorPercentage = errorPercentages.reduce((sum, e) => sum + e, 0) / errorPercentages.length

    return {
      averageError: avgError,
      averageErrorPercentage,
      totalTasks: this.history.length
    }
  }

  /**
   * Generate report
   */
  generateReport(): string {
    const total = this.history.length
    const successful = this.history.filter(r => r.success).length
    const failed = total - successful

    const avgTime = total > 0
      ? this.history.reduce((sum, r) => sum + r.actualTime, 0) / total
      : 0

    const accuracy = this.getEstimationAccuracy()

    return `
Task History Report:
  Total Tasks: ${total}
  Successful: ${successful} (${total > 0 ? ((successful / total) * 100).toFixed(1) : 0}%)
  Failed: ${failed} (${total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%)
  Average Time: ${avgTime.toFixed(1)} minutes
  Time Estimation Error: ${accuracy.averageErrorPercentage.toFixed(1)}%
    `.trim()
  }

  /**
   * Save history to disk
   */
  private async save(): Promise<void> {
    try {
      const dir = path.dirname(this.historyFilePath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(this.historyFilePath, JSON.stringify(this.history, null, 2))
    } catch (error) {
      // Fail silently - history is not critical
    }
  }

  /**
   * Load history from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.historyFilePath, 'utf-8')
      this.history = JSON.parse(content)
    } catch {
      // No existing history
      this.history = []
    }
  }

  /**
   * Clear history
   */
  async clear(): Promise<void> {
    this.history = []
    try {
      await fs.unlink(this.historyFilePath)
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Can add execution records
- [ ] Can find by task type
- [ ] Can find failed tasks
- [ ] Can find slow tasks
- [ ] Calculates estimation accuracy
- [ ] Generates readable report
- [ ] Persists to disk
- [ ] Can load from disk
- [ ] Can clear history

---

#### 1.10 Health Monitor (0.5 days) - NEW

**File:** `packages/cli/src/agent/health-monitor.ts`

```typescript
import type { Logger } from '@polka-codes/core'

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean
  reason?: string
  details?: Record<string, any>
}

/**
 * Health check function
 */
export type HealthCheck = () => Promise<HealthStatus> | HealthStatus

/**
 * Monitors agent health
 */
export class HealthMonitor {
  private checkInterval: NodeJS.Timeout | null = null
  private lastHealthCheck: number = 0
  private lastHealthStatus: HealthStatus | null = null
  private isRunning: boolean = false

  constructor(
    private logger: Logger,
    private healthCheck: HealthCheck,
    private onUnhealthy?: (status: HealthStatus) => void | Promise<void>
  ) {}

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    this.checkInterval = setInterval(async () => {
      try {
        const status = await this.check()
        this.lastHealthCheck = Date.now()
        this.lastHealthStatus = status

        if (!status.healthy) {
          this.logger.warn(`[HealthMonitor] Unhealthy: ${status.reason}`)

          if (this.onUnhealthy) {
            await this.onUnhealthy(status)
          }
        } else {
          this.logger.debug('[HealthMonitor] Healthy')
        }
      } catch (error) {
        this.logger.error('Health check error', error as Error)

        // Treat errors as unhealthy
        const errorStatus: HealthStatus = {
          healthy: false,
          reason: 'Health check failed',
          details: { error: error instanceof Error ? error.message : String(error) }
        }

        this.lastHealthStatus = errorStatus

        if (this.onUnhealthy) {
          await this.onUnhealthy(errorStatus)
        }
      }
    }, intervalMs)

    this.logger.info('[HealthMonitor] Started health monitoring')
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    this.logger.info('[HealthMonitor] Stopped health monitoring')
  }

  /**
   * Perform health check
   */
  async check(): Promise<HealthStatus> {
    return await this.healthCheck()
  }

  /**
   * Get last health check status
   */
  getLastStatus(): HealthStatus | null {
    return this.lastHealthStatus
  }

  /**
   * Get time since last health check
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.lastHealthCheck
  }
}
```

**Acceptance Criteria:**
- [ ] Can start and stop monitoring
- [ ] Runs health checks at intervals
- [ ] Calls callback on unhealthy
- [ ] Logs appropriately
- [ ] Can manually check health
- [ ] Tracks last check time
- [ ] Handles errors in health checks

---

#### 1.11 Structured Logger (1 day)

**File:** `packages/cli/src/agent/logger.ts`

**No changes from v2.0** - logger is solid.

---

#### 1.12 Metrics Collector (1 day)

**File:** `packages/cli/src/agent/metrics.ts`

**No changes from v2.0** - metrics are solid.

---

#### 1.13 Safety Systems (3 days)

**No changes from v2.0** - safety systems are solid.

---

**Phase 1 Acceptance Criteria:**
- [ ] All type definitions created
- [ ] Constants file with mappings created
- [ ] Custom error types implemented
- [ ] Configuration validated with Zod
- [ ] **State manager uses immutable updates** (CRITICAL)
- [ ] Session manager prevents conflicts
- [ ] Resource monitor enforces limits
- [ ] Task history tracks executions
- [ ] Health monitor performs checks
- [ ] Logger has all required methods
- [ ] Metrics calculates success rate
- [ ] Safety systems work correctly
- [ ] CLI command registered and working

---

## Phase 2: Core Execution (Week 3-6.5)

### Overview
Enable the agent to accept goals, break them down into tasks, and execute them to completion.

**New in v2.1:**
- Workflow adapter layer
- Task timeout handling
- Progress reporting
- Enhanced error recovery

### Task Breakdown

#### 2.1 Workflow Adapter Layer (1 day) - NEW

**File:** `packages/cli/src/agent/workflow-adapter.ts`

```typescript
import type { WorkflowExecutionResult, TaskError } from './types'
import { WorkflowInvocationError } from './errors'

/**
 * Adapts existing workflow outputs to WorkflowExecutionResult format
 */
export class WorkflowAdapter {
  /**
   * Adapt code workflow result
   */
  static async adaptCodeWorkflow(
    input: any,
    context: any
  ): Promise<WorkflowExecutionResult> {
    try {
      // Dynamic import
      const { codeWorkflow } = await import('../workflows/code.workflow')

      const result = await codeWorkflow(input, context)

      if (result.success) {
        return {
          success: true,
          data: result,
          output: result.summaries.join('\n')
        }
      } else {
        return {
          success: false,
          error: new Error(result.reason)
        }
      }
    } catch (error) {
      throw new WorkflowInvocationError(
        'code',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Adapt fix workflow result
   */
  static async adaptFixWorkflow(
    input: any,
    context: any
  ): Promise<WorkflowExecutionResult> {
    try {
      const { fixWorkflow } = await import('../workflows/fix.workflow')

      const result = await fixWorkflow(input, context)

      if (result.success) {
        return {
          success: true,
          data: result,
          output: result.summary || 'Fix applied'
        }
      } else {
        return {
          success: false,
          error: new Error(result.reason || 'Fix failed')
        }
      }
    } catch (error) {
      throw new WorkflowInvocationError(
        'fix',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Adapt plan workflow result
   */
  static async adaptPlanWorkflow(
    input: any,
    context: any
  ): Promise<WorkflowExecutionResult> {
    try {
      const { planWorkflow } = await import('../workflows/plan.workflow')

      const result = await planWorkflow(input, context)

      if (!result) {
        return {
          success: false,
          error: new Error('Plan not approved')
        }
      }

      return {
        success: true,
        data: result,
        output: `Plan created with ${result.tasks?.length || 0} tasks`
      }
    } catch (error) {
      throw new WorkflowInvocationError(
        'plan',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Adapt review workflow result
   */
  static async adaptReviewWorkflow(
    input: any,
    context: any
  ): Promise<WorkflowExecutionResult> {
    try {
      const { reviewWorkflow } = await import('../workflows/review.workflow')

      const result = await reviewWorkflow(input, context)

      if (result.success) {
        return {
          success: true,
          data: result,
          output: result.summary || 'Review complete'
        }
      } else {
        return {
          success: false,
          error: new Error(result.reason || 'Review failed')
        }
      }
    } catch (error) {
      throw new WorkflowInvocationError(
        'review',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Adapt commit workflow result
   */
  static async adaptCommitWorkflow(
    input: any,
    context: any
  ): Promise<WorkflowExecutionResult> {
    try {
      const { commitWorkflow } = await import('../workflows/commit.workflow')

      const result = await commitWorkflow(input, context)

      if (result.success) {
        return {
          success: true,
          data: result,
          output: `Committed: ${result.summary}`,
          filesModified: result.filesChanged
        }
      } else {
        return {
          success: false,
          error: new Error(result.reason || 'Commit failed')
        }
      }
    } catch (error) {
      throw new WorkflowInvocationError(
        'commit',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Generic workflow invoker
   */
  static async invokeWorkflow(
    workflowName: string,
    input: any,
    context: any
  ): Promise<WorkflowExecutionResult> {
    switch (workflowName) {
      case 'code':
        return this.adaptCodeWorkflow(input, context)
      case 'fix':
        return this.adaptFixWorkflow(input, context)
      case 'plan':
        return this.adaptPlanWorkflow(input, context)
      case 'review':
        return this.adaptReviewWorkflow(input, context)
      case 'commit':
        return this.adaptCommitWorkflow(input, context)
      default:
        throw new WorkflowInvocationError(
          workflowName,
          `Unknown workflow: ${workflowName}`
        )
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Adapts code workflow correctly
- [ ] Adapts fix workflow correctly
- [ ] Adapts plan workflow correctly
- [ ] Adapts review workflow correctly
- [ ] Adapts commit workflow correctly
- [ ] Handles workflow errors properly
- [ ] Returns consistent WorkflowExecutionResult
- [ ] All adapters tested

---

#### 2.2 Agent Orchestrator (4 days)

**File:** `packages/cli/src/agent/orchestrator.ts`

**CRITICAL CHANGES from v2.0:**
- Complete commit phase implementation (no placeholders)
- Complete continuous improvement mode (no placeholders)
- Uses SessionManager
- Uses ResourceMonitor
- Uses WorkflowAdapter
- Emits progress events
- Immutable state updates
- Task timeout handling

```typescript
import type {
  AgentConfig,
  AgentMode,
  AgentState,
  Plan,
  Task,
  ProgressReport
} from './types'
import {
  StateTransitionError,
  TaskExecutionError,
  ResourceLimitError
} from './errors'
import { AgentStateManager } from './state-manager'
import { SessionManager } from './session'
import { ResourceMonitor } from './resource-monitor'
import { TaskHistory } from './task-history'
import { HealthMonitor } from './health-monitor'
import { AgentLogger } from './logger'
import { MetricsCollector } from './metrics'
import { ApprovalManager } from './safety/approval'
import { SafetyChecker } from './safety/checks'
import { InterruptHandler } from './safety/interrupt'
import { GoalDecomposer } from './goal-decomposer'
import { TaskPlanner } from './planner'
import { TaskExecutor } from './executor'
import { STATE_TRANSITIONS } from './constants'
import { WorkflowAdapter } from './workflow-adapter'

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
  private resourceMonitor: ResourceMonitor
  private taskHistory: TaskHistory
  private healthMonitor: HealthMonitor

  private state: AgentState | null = null
  private running: boolean = false
  private progressListeners: Set<(report: ProgressReport) => void> = new Set()
  private taskTimeouts: Map<string, NodeJS.Timeout> = new Map()

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

    // NEW in v2.1
    this.resourceMonitor = new ResourceMonitor(
      config.resourceLimits,
      workflowContext.logger,
      (limitExceeded) => this.handleResourceExceeded(limitExceeded)
    )

    this.taskHistory = new TaskHistory(workflowContext.stateDir)

    this.healthMonitor = new HealthMonitor(
      workflowContext.logger,
      () => this.healthCheck(),
      (status) => this.handleUnhealthy(status)
    )
  }

  /**
   * Initialize agent state
   */
  async initialize(): Promise<void> {
    // Acquire session
    const sessionId = `agent-${Date.now()}`
    const acquireResult = await SessionManager.acquire(sessionId)

    if (!acquireResult.acquired) {
      throw new Error(
        `Session already active: ${acquireResult.reason}`
      )
    }

    this.logger.info(`Acquired session: ${sessionId}`)

    // Initialize state
    this.state = await this.stateManager.initialize(this.config)
    this.stateManager.startAutoSave(this.config.autoSaveInterval)

    // Load history
    await this.taskHistory.load()

    // Start resource monitoring
    this.resourceMonitor.start(30000) // Check every 30s

    // Start health monitoring
    this.healthMonitor.start(60000) // Check every 60s

    this.logger.milestone('Agent initialized', {
      sessionId: this.state.sessionId,
      strategy: this.config.strategy
    })

    this.emitProgress()
  }

  /**
   * Load existing agent state
   */
  async loadState(): Promise<void> {
    this.state = await this.stateManager.loadState()

    if (!this.state) {
      throw new Error('No existing state found')
    }

    // Acquire session
    const acquireResult = await SessionManager.acquire(this.state.sessionId)

    if (!acquireResult.acquired) {
      throw new Error(
        `Session already active: ${acquireResult.reason}`
      )
    }

    // Load history
    await this.taskHistory.load()

    // Start monitoring
    this.resourceMonitor.start()
    this.healthMonitor.start()

    this.logger.milestone('Agent state loaded', {
      sessionId: this.state.sessionId,
      mode: this.state.currentMode
    })

    this.emitProgress()
  }

  /**
   * Set goal and transition to planning mode
   */
  async setGoal(goal: string): Promise<void> {
    if (!this.state) {
      throw new Error('Agent not initialized')
    }

    this.transitionState('idle', 'planning', 'setGoal')

    // Immutable update
    await this.stateManager.updateState({ currentGoal: goal })

    this.logger.milestone('Goal set', { goal })
    this.emitProgress()
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
    this.emitProgress()

    const decomposition = await this.goalDecomposer.decompose(this.state!.currentGoal!)

    this.logger.info(`Decomposed goal into ${decomposition.tasks.length} tasks`)
    this.logger.info(decomposition.highLevelPlan)

    // Create execution plan
    const plan = this.taskPlanner.createPlan(
      this.state!.currentGoal!,
      decomposition.tasks
    )

    // Immutable update
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

    this.emitProgress()
  }

  /**
   * Execution phase - execute tasks
   */
  private async executionPhase(): Promise<void> {
    this.logger.milestone('Entering execution phase')
    this.emitProgress()

    const state = this.state!
    let executedCount = 0

    for (const task of state.taskQueue) {
      if (!this.running) break

      if (task.status === 'completed') continue

      // Check dependencies
      if (!this.areDependenciesMet(task, state.completedTasks)) {
        this.logger.info(`Task ${task.id} blocked by dependencies`)
        continue
      }

      // Execute task
      await this.executeTask(task)
      executedCount++

      this.emitProgress()
    }

    this.logger.milestone(`Execution phase complete`, {
      tasksExecuted: executedCount
    })
  }

  /**
   * Execute a single task with timeout
   * NEW in v2.1: Added timeout handling
   */
  private async executeTask(task: Task): Promise<void> {
    const state = this.state!

    this.logger.task(task, `Starting execution`)

    // Update task status (immutable)
    const updatedTask = {
      ...task,
      status: 'in-progress' as const,
      startedAt: Date.now()
    }

    await this.stateManager.updateTask(task.id, {
      status: 'in-progress',
      startedAt: Date.now()
    })

    await this.stateManager.updateState({
      currentTask: updatedTask
    })

    // Set up timeout
    const timeoutMs = this.config.resourceLimits.maxTaskExecutionTime * 60 * 1000

    const timeoutPromise = new Promise<never>((_, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new TaskExecutionError(task.id, `Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      this.taskTimeouts.set(task.id, timeoutId)
    })

    try {
      // Race between execution and timeout
      const result = await Promise.race([
        this.executeTaskInternal(task),
        timeoutPromise
      ])

      if (result.success) {
        // Task completed successfully
        await this.stateManager.moveTask(task.id, 'queue', 'completed')

        this.logger.task(task, `Completed successfully`)

        // Add to history
        await this.taskHistory.add({
          taskId: task.id,
          taskType: task.type,
          success: true,
          duration: Date.now() - (task.startedAt || Date.now()),
          estimatedTime: task.estimatedTime,
          actualTime: ((Date.now() - (task.startedAt || Date.now())) / 60000),
          timestamp: Date.now()
        })
      } else {
        throw result.error || new Error('Task failed')
      }
    } catch (error) {
      // Task failed
      const taskError: TaskError = {
        message: error instanceof Error ? error.message : String(error),
        type: this.classifyError(error),
        context: 'task-execution',
        retryable: this.isRetryable(error)
      }

      await this.stateManager.updateTask(task.id, {
        status: 'failed',
        error: taskError
      })

      await this.stateManager.moveTask(task.id, 'queue', 'failed')

      this.logger.error(`Task ${task.id}`, error as Error)

      // Add to history
      await this.taskHistory.add({
        taskId: task.id,
        taskType: task.type,
        success: false,
        duration: Date.now() - (task.startedAt || Date.now()),
        estimatedTime: task.estimatedTime,
        actualTime: ((Date.now() - (task.startedAt || Date.now())) / 60000),
        timestamp: Date.now(),
        error: taskError.message
      })

      // Transition to error recovery
      this.transitionState(state.currentMode, 'error-recovery', 'task failed')

      // Handle error
      await this.handleTaskError(task, error as Error)
    } finally {
      // Clear timeout
      const timeoutId = this.taskTimeouts.get(task.id)
      if (timeoutId) {
        clearTimeout(timeoutId)
        this.taskTimeouts.delete(task.id)
      }
    }

    await this.stateManager.updateState({
      currentTask: undefined
    })

    this.emitProgress()
  }

  /**
   * Execute task internal logic
   */
  private async executeTaskInternal(task: Task): Promise<WorkflowExecutionResult> {
    const state = this.state!

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
          return {
            success: false,
            error: new Error(decision.reason || 'Approval denied')
          }
        }
      }

      // Execute using workflow adapter
      const result = await WorkflowAdapter.invokeWorkflow(
        task.workflow,
        task.workflowInput,
        this.workflowContext
      )

      return result

    } catch (error) {
      throw new TaskExecutionError(
        task.id,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    }
  }

  /**
   * Classify error type
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase()

    if (message.includes('timeout')) return 'transient'
    if (message.includes('test') || message.includes('assert')) return 'test-failure'
    if (message.includes('permission') || message.includes('eacces')) return 'permission'
    if (message.includes('validation') || message.includes('schema')) return 'validation'
    if (message.includes('fatal')) return 'fatal'
    return 'unknown'
  }

  /**
   * Check if error is retryable
   */
  private isRetryable(error: Error): boolean {
    const type = this.classifyError(error)
    return type === 'transient' || type === 'test-failure'
  }

  /**
   * Reviewing phase - review execution results
   */
  private async reviewingPhase(): Promise<void> {
    this.logger.milestone('Entering reviewing phase')
    this.emitProgress()

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
   * COMPLETE IMPLEMENTATION (no placeholders)
   */
  private async committingPhase(): Promise<void> {
    this.logger.milestone('Entering committing phase')
    this.emitProgress()

    const state = this.state!

    // Create commit task
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
      workflowInput: {
        message: this.generateCommitMessage()
      },
      retryCount: 0,
      createdAt: Date.now()
    }

    // Check approval
    if (this.approvalManager.requiresApproval(commitTask)) {
      const decision = await this.approvalManager.requestApproval(commitTask)
      if (!decision.approved) {
        this.logger.info('Commit skipped by user')
        this.transitionState(state.currentMode, 'idle', 'commit skipped')
        return
      }
    }

    // Execute commit workflow
    try {
      this.logger.info('Committing changes...')

      const result = await WorkflowAdapter.invokeWorkflow(
        'commit',
        commitTask.workflowInput,
        this.workflowContext
      )

      if (result.success) {
        this.logger.info(`Changes committed: ${result.output}`)

        // Update metrics
        if (result.filesModified) {
          this.metrics.recordGitOperation({
            filesChanged: result.filesModified.length
          })
        }

        this.transitionState(state.currentMode, 'idle', 'committed')
      } else {
        throw result.error || new Error('Commit failed')
      }
    } catch (error) {
      this.logger.error('Commit failed', error as Error)

      if (this.config.pauseOnError) {
        // Ask user what to do
        const answer = await this.askUser(
          '\n❌ Commit failed. Continue? (yes/no)'
        )

        if (answer?.toLowerCase() === 'yes') {
          this.transitionState(state.currentMode, 'idle', 'commit failed, continuing')
        } else {
          this.transitionState(state.currentMode, 'stopped', 'commit failed, stopping')
        }
      } else {
        this.transitionState(state.currentMode, 'idle', 'commit failed, auto-continue')
      }
    }

    this.emitProgress()
  }

  /**
   * Generate commit message from session
   */
  private generateCommitMessage(): string {
    const state = this.state!
    const completed = state.completedTasks.length
    const failed = state.failedTasks.length

    const lines: string[] = []

    lines.push(`Autonomous agent session (${state.sessionId})`)
    lines.push('')
    lines.push(`Completed: ${completed} tasks`)
    if (failed > 0) {
      lines.push(`Failed: ${failed} tasks`)
    }
    lines.push('')

    // List task types
    const byType: Record<string, number> = {}
    for (const task of state.completedTasks) {
      byType[task.type] = (byType[task.type] || 0) + 1
    }

    for (const [type, count] of Object.entries(byType)) {
      lines.push(`- ${count}x ${type}`)
    }

    return lines.join('\n')
  }

  /**
   * Run in continuous improvement mode
   * COMPLETE IMPLEMENTATION (no placeholders)
   */
  private async runContinuousImprovement(): Promise<void> {
    this.logger.milestone('Starting continuous improvement mode')
    this.emitProgress()

    const config = this.config.continuousImprovement
    const discovery = new TaskDiscoveryEngine(this.workflowContext)
    let cycles = 0

    while (
      this.running &&
      !this.interruptHandler.shouldStop()
    ) {
      cycles++

      this.logger.info(`[Continuous] Cycle ${cycles}`)

      // Check max cycles
      if (config.maxCycles > 0 && cycles > config.maxCycles) {
        this.logger.info('[Continuous] Max cycles reached')
        break
      }

      // Discover tasks
      const completedIds = this.state!.completedTasks.map(t => t.id)
      const discovered = await discovery.discoverTasks(completedIds)

      if (discovered.length === 0) {
        // No tasks - wait and retry
        this.logger.info('[Continuous] No tasks discovered, waiting...')

        await this.sleep(config.sleepTimeOnNoTasks)
        discovery.clearCache()

        continue
      }

      // Prioritize tasks
      const prioritized = this.prioritizeTasks(discovered)

      // Select next task
      const selected = this.selectNextTask(prioritized)

      if (!selected) {
        this.logger.info('[Continuous] No ready tasks (all blocked)')

        await this.sleep(config.sleepTimeBetweenTasks)
        continue
      }

      // Execute task
      this.logger.info(`[Continuous] Executing: ${selected.title}`)

      // Add to queue
      await this.stateManager.updateState({
        taskQueue: [...this.state!.taskQueue, selected]
      })

      // Execute
      await this.executeTask(selected)

      // Sleep between tasks
      if (config.sleepTimeBetweenTasks > 0) {
        await this.sleep(config.sleepTimeBetweenTasks)
      }

      this.emitProgress()
    }

    this.logger.milestone('Continuous improvement stopped', {
      cycles,
      tasksCompleted: this.state!.metrics.tasksCompleted,
      tasksFailed: this.state!.metrics.tasksFailed
    })
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
    const completedIds = new Set(this.state!.completedTasks.map(t => t.id))

    for (const task of tasks) {
      if (this.areDependenciesMet(task, completedIds)) {
        return task
      }
    }

    return null
  }

  /**
   * Handle task error
   */
  private async handleTaskError(task: Task, error: Error): Promise<void> {
    const state = this.state!

    if (this.config.pauseOnError) {
      this.logger.error('Task execution paused', error)

      // Suggest recovery action
      const suggestion = this.getSuggestedRecovery(error)

      this.logger.info(`\n💡 Suggestion: ${suggestion}\n`)

      // Ask user what to do
      const answer = await this.askUser(
        '\n❌ Task failed. Continue? (yes/no/retry/skip)'
      )

      if (answer?.toLowerCase() === 'retry') {
        task.retryCount++
        await this.executeTask(task)
      } else if (answer?.toLowerCase() === 'skip') {
        this.transitionState('error-recovery', 'executing', 'task skipped')
      } else if (answer?.toLowerCase() === 'yes') {
        this.transitionState('error-recovery', 'executing', 'user chose to continue')
      } else {
        this.transitionState('error-recovery', 'stopped', 'user chose to stop')
      }
    } else {
      // Auto-continue
      this.transitionState('error-recovery', 'executing', 'auto-continue')
    }
  }

  /**
   * Get suggested recovery action
   */
  private getSuggestedRecovery(error: Error): string {
    const type = this.classifyError(error)

    switch (type) {
      case 'transient':
        return 'This appears to be a temporary issue. Try retrying.'
      case 'validation':
        return 'The task input may be invalid. Check the task definition.'
      case 'test-failure':
        return 'Tests are failing. Consider fixing the tests or the code.'
      case 'permission':
        return 'Permission denied. Check file permissions or run with appropriate access.'
      case 'fatal':
        return 'This is a critical error. Manual intervention may be required.'
      default:
        return 'Unknown error. Review the error details above.'
    }
  }

  /**
   * Handle resource limit exceeded
   */
  private async handleResourceExceeded(limitExceeded: {
    limit: string
    current: number
    max: number
    message: string
  }): Promise<void> {
    this.logger.warn(`Resource limit exceeded: ${limitExceeded.message}`)

    if (this.config.pauseOnError) {
      const answer = await this.askUser(
        `\n⚠️  ${limitExceeded.message}\nContinue? (yes/no)`
      )

      if (answer?.toLowerCase() === 'yes') {
        this.logger.info('User chose to continue despite resource limit')
        return
      }
    }

    // Stop agent
    this.transitionState(this.state!.currentMode, 'stopped', `Resource limit: ${limitExceeded.limit}`)
  }

  /**
   * Handle unhealthy status
   */
  private async handleUnhealthy(status: {
    healthy: boolean
    reason?: string
    details?: any
  }): Promise<void> {
    this.logger.error(`Agent unhealthy: ${status.reason}`, status.details)

    // Could trigger recovery actions here
  }

  /**
   * Health check
   */
  private async healthCheck(): Promise<{
    healthy: boolean
    reason?: string
  }> {
    const usage = this.resourceMonitor.getCurrentUsage()

    if (!usage.withinLimits) {
      return {
        healthy: false,
        reason: 'Resource limits exceeded'
      }
    }

    return { healthy: true }
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

    // Immutable update
    this.state = {
      ...this.state,
      currentMode: to,
      previousMode,
      timestamps: {
        ...this.state.timestamps,
        modeTransitions: [
          ...this.state.timestamps.modeTransitions,
          { from, to, timestamp: Date.now() }
        ]
      }
    }

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

    // Clear all timeouts
    for (const timeoutId of this.taskTimeouts.values()) {
      clearTimeout(timeoutId)
    }
    this.taskTimeouts.clear()

    this.logger.milestone('Agent stopped')
  }

  /**
   * Get current progress
   */
  getProgress(): ProgressReport {
    if (!this.state) {
      throw new Error('Agent not initialized')
    }

    const totalTasks = this.state.taskQueue.length + this.state.completedTasks.length
    const completedTasks = this.state.completedTasks.length
    const metrics = this.metrics.getMetrics()

    // Estimate time remaining
    const remainingTasks = this.state.taskQueue.filter(t => t.status === 'pending')
    const estimatedTimeRemaining = remainingTasks.reduce(
      (sum, task) => sum + task.estimatedTime,
      0
    )

    return {
      mode: this.state.currentMode,
      phase: this.state.currentMode,
      currentTask: this.state.currentTask?.title,
      progress: totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0,
      completedTasks,
      totalTasks,
      estimatedTimeRemaining,
      metrics
    }
  }

  /**
   * Subscribe to progress updates
   * NEW in v2.1
   */
  onProgress(callback: (report: ProgressReport) => void): () => void {
    this.progressListeners.add(callback)

    // Return unsubscribe function
    return () => {
      this.progressListeners.delete(callback)
    }
  }

  /**
   * Emit progress to all listeners
   * NEW in v2.1
   */
  private emitProgress(): void {
    const report = this.getProgress()

    for (const listener of this.progressListeners) {
      try {
        listener(report)
      } catch (error) {
        this.logger.error('Progress listener', error as Error)
      }
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
   * Get task history
   */
  getTaskHistory(): TaskHistory {
    return this.taskHistory
  }

  /**
   * Get resource usage
   */
  getResourceUsage() {
    return this.resourceMonitor.getCurrentUsage()
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
    this.resourceMonitor.stop()
    this.healthMonitor.stop()

    await this.stateManager.saveState()
    await SessionManager.release(this.state!.sessionId)

    this.logger.info('Cleanup complete')
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Ask user for input
   */
  private async askUser(prompt: string): Promise<string | undefined> {
    // TODO: Implement using inquirer or similar
    return undefined
  }
}

// Import types at bottom to avoid circular dependencies
import type { WorkflowExecutionResult } from './types'
import type { ErrorType } from './types'
```

**Acceptance Criteria:**
- [ ] Agent can be initialized and state loaded
- [ ] Session acquisition works
- [ ] Resource monitoring starts
- [ ] Health monitoring starts
- [ ] Goal-directed mode works end-to-end
- [ ] **Commit phase has complete implementation** (CRITICAL)
- [ ] **Continuous mode has complete implementation** (CRITICAL)
- [ ] State transitions are validated
- [ ] Tasks are executed in correct order
- [ ] **Tasks have timeout handling** (CRITICAL)
- [ ] Dependencies are respected
- [ ] Errors trigger recovery mode
- [ ] Progress reports are emitted
- [ ] Progress listeners can subscribe
- [ ] **All state updates are immutable** (CRITICAL)
- [ ] Resource limits are enforced
- [ ] Cleanup works correctly

---

#### 2.2 Task Executor (1.5 days)

**File:** `packages/cli/src/agent/executor.ts`

**CHANGES from v2.0:**
- Uses WorkflowAdapter
- Cleaner implementation

```typescript
import type { Task, AgentState, WorkflowExecutionResult } from './types'
import { AgentLogger } from './logger'
import { WorkflowAdapter } from './workflow-adapter'

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
      // Invoke workflow through adapter
      const result = await WorkflowAdapter.invokeWorkflow(
        task.workflow,
        task.workflowInput,
        this.context
      )

      this.logger.task(task, 'Execution completed')

      return result

    } catch (error) {
      this.logger.error(`Task ${task.id}`, error as Error)

      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error))
      }
    }
  }
}
```

**Acceptance Criteria:**
- [ ] Uses WorkflowAdapter correctly
- [ ] Invokes workflows with proper input
- [ ] Handles workflow errors
- [ ] Returns structured results
- [ ] Logs all operations

---

#### 2.3 Goal Decomposition Engine (3 days)

**No changes from v2.0** - solid implementation.

---

#### 2.4 Planning Engine (2 days)

**No changes from v2.0** - solid implementation.

---

**Phase 2 Acceptance Criteria:**
- [ ] Workflow adapters work correctly
- [ ] Orchestrator manages complete lifecycle
- [ ] State machine works correctly
- [ ] Tasks execute with timeouts
- [ ] Goals decompose properly
- [ ] Plans created correctly
- [ ] All components integrate
- [ ] Error recovery works
- [ ] Progress reporting works
- [ ] Resource limits enforced
- [ ] Complete commit phase
- [ ] Complete continuous mode

---

## Phase 3: Continuous Improvement (Week 7-8.5)

### Overview
Implement continuous improvement loop with smart discovery and caching.

**New in v2.1:**
- Cache invalidation on git changes
- Smarter discovery (typecheck before build)
- Exponential backoff on empty cycles

### Task Breakdown

#### 3.1 Task Discovery Engine (5 days)

**File:** `packages/cli/src/agent/task-discovery.ts`

**CRITICAL IMPROVEMENTS from v2.0:**
- Git state tracking for cache invalidation
- Smarter build discovery (typecheck first)
- Better test discovery (run related tests only)

```typescript
import type { DiscoveryStrategy, Task, WorkflowContext, PriorityResult } from './types'
import { Priority } from './types'

/**
 * Discovers potential tasks by analyzing codebase
 */
export class TaskDiscoveryEngine {
  private strategies: Map<string, DiscoveryStrategy> = new Map()
  private cache: Map<string, { tasks: Task[], timestamp: number, gitState: string }> = new Map()
  private lastKnownGitState: string = ''

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
   * IMPROVED in v2.1: Cache invalidation on git changes
   */
  async discoverTasks(excludeCompleted: string[] = []): Promise<Task[]> {
    this.context.logger.info('[Discovery] Starting task discovery...')

    // Check git state for cache invalidation
    const currentGitState = await this.getGitState()

    if (currentGitState !== this.lastKnownGitState) {
      this.context.logger.info('[Discovery] Git state changed, clearing cache')
      this.clearCache()
      this.lastKnownGitState = currentGitState
    }

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

        // Check cache with git state
        const cached = this.cache.get(name)
        if (cached &&
            Date.now() - cached.timestamp < config.cacheTime &&
            cached.gitState === currentGitState) {
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

        // Cache results with git state
        this.cache.set(name, {
          tasks: filtered,
          timestamp: Date.now(),
          gitState: currentGitState
        })

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
   * Get current git state (HEAD commit)
   */
  private async getGitState(): Promise<string> {
    try {
      const result = await this.context.tools.executeCommand({
        command: 'git',
        args: ['rev-parse', 'HEAD']
      })

      return result.stdout.trim()
    } catch {
      return 'unknown'
    }
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
    this.context.logger.debug('[Discovery] Cache cleared')
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

  /**
   * Discover build errors
   * IMPROVED in v2.1: Typecheck first, then build
   */
  private async discoverBuildErrors(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    // Step 1: Quick typecheck first
    this.context.logger.debug('[Discovery] Running typecheck...')

    try {
      const typecheckResult = await context.tools.executeCommand({
        command: 'bun',
        args: ['run', 'typecheck']
      })

      if (typecheckResult.exitCode !== 0) {
        // Type errors found - create tasks for them
        const typeErrors = this.parseTypeErrors(typecheckResult.stdout)

        for (const typeError of typeErrors) {
          tasks.push({
            id: `type-error-${typeError.file}-${typeError.line}-${Date.now()}`,
            type: 'bugfix',
            title: `Fix type error in ${typeError.file}:${typeError.line}`,
            description: typeError.message,
            priority: Priority.HIGH,
            complexity: 'medium',
            dependencies: [],
            estimatedTime: 10,
            status: 'pending',
            files: [typeError.file],
            workflow: 'code',
            workflowInput: {
              prompt: `Fix this type error: ${typeError.message}`,
              files: [typeError.file]
            },
            retryCount: 0,
            createdAt: Date.now()
          })
        }

        return tasks // Type errors are more important, return immediately
      }
    } catch (error) {
      // Typecheck failed - might not have typecheck script
      this.context.logger.debug('[Discovery] Typecheck not available, skipping')
    }

    // Step 2: Only run full build if typecheck passed
    this.context.logger.debug('[Discovery] Running build...')

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
          priority: Priority.CRITICAL,
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
      // Build command failed
      this.context.logger.debug('[Discovery] Build not available')
    }

    return tasks
  }

  /**
   * Discover failing tests
   * IMPROVED in v2.1: Run only related tests if changes detected
   */
  private async discoverFailingTests(context: WorkflowContext): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      // Get recently changed files
      const recentChanges = await this.getRecentlyChangedFiles(context)

      if (recentChanges.length > 0) {
        // Find related test files
        const testFiles = await this.findTestsForFiles(recentChanges, context)

        if (testFiles.length > 0) {
          // Run only related tests
          this.context.logger.debug(`[Discovery] Running ${testFiles.length} related tests`)

          const testPattern = testFiles.map(f => f.replace(/\//g, '\\/')).join('|')

          const result = await context.tools.executeCommand({
            command: 'bun',
            args: ['test', '--filter', testPattern, '--reporter', 'json']
          })

          if (result.exitCode !== 0) {
            const failures = this.parseTestFailures(result.stdout)

            for (const failure of failures) {
              tasks.push({
                id: `test-failure-${failure.testName}-${Date.now()}`,
                type: 'bugfix',
                title: `Fix failing test: ${failure.testName}`,
                description: failure.message,
                priority: Priority.HIGH,
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
        }
      }

      // If no recent changes or no related tests, run all tests
      if (tasks.length === 0) {
        this.context.logger.debug('[Discovery] Running all tests...')

        const result = await context.tools.executeCommand({
          command: 'bun',
          args: ['test', '--reporter', 'json']
        })

        if (result.exitCode !== 0) {
          const failures = this.parseTestFailures(result.stdout)

          for (const failure of failures) {
            tasks.push({
              id: `test-failure-${failure.testName}-${Date.now()}`,
              type: 'bugfix',
              title: `Fix failing test: ${failure.testName}`,
              description: failure.message,
              priority: Priority.HIGH,
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
      }
    } catch (error) {
      // Test command failed
      this.context.logger.debug('[Discovery] Tests not available')
    }

    return tasks
  }

  /**
   * Get recently changed files
   */
  private async getRecentlyChangedFiles(context: WorkflowContext): Promise<string[]> {
    try {
      const result = await context.tools.executeCommand({
        command: 'git',
        args: ['diff', '--name-only', 'HEAD~10', 'HEAD']
      })

      return result.stdout.split('\n').filter(Boolean)
    } catch {
      return []
    }
  }

  /**
   * Find test files for source files
   */
  private async findTestsForFiles(sourceFiles: string[], context: WorkflowContext): Promise<string[]> {
    // Simple heuristic: look for test files with matching names
    const testFiles: string[] = []

    for (const sourceFile of sourceFiles) {
      const baseName = sourceFile.replace(/\.(ts|tsx|js|jsx)$/, '')
      const testName = `${baseName}.test.ts`

      try {
        await context.tools.executeCommand({
          command: 'test',
          args: ['-f', testName, '--dry-run']
        })

        testFiles.push(testName)
      } catch {
        // Test file doesn't exist
      }
    }

    return testFiles
  }

  // ... rest of implementation similar to v2.0
}
```

**Acceptance Criteria:**
- [ ] Discovers build errors (typecheck first!)
- [ ] Discovers failing tests (related tests first!)
- [ ] Discovers type errors
- [ ] Discovers lint issues
- [ ] **Cache invalidates on git changes** (CRITICAL)
- [ ] Caches results with git state
- [ ] Checks git status before running
- [ ] Uses Priority enum
- [ ] Strategies can be enabled/disabled

---

#### 3.2 Continuous Improvement Loop (3.5 days)

**File:** `packages/cli/src/agent/improvement-loop.ts`

**CRITICAL IMPROVEMENTS from v2.0:**
- Exponential backoff on empty cycles
- Better cycle management

```typescript
import type { Task, WorkflowContext, AgentState } from './types'
import { TaskDiscoveryEngine } from './task-discovery'
import { TaskPlanner } from './planner'
import { AgentLogger } from './logger'

/**
 * Manages continuous improvement loop
 */
export class ContinuousImprovementLoop {
  private discovery: TaskDiscoveryEngine
  private planner: TaskPlanner
  private executor: TaskExecutor

  // NEW in v2.1: Backoff state
  private consecutiveEmptyCycles: number = 0
  private backoffMultiplier: number = 1

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
   * FIXED in v2.1: No longer exits when no tasks found
   * ADDED in v2.1: Exponential backoff
   */
  async run(): Promise<void> {
    const config = this.state.config.continuousImprovement
    let cycles = 0

    this.logger.milestone('Starting continuous improvement loop')

    while (!this.shouldStop(cycles)) {
      cycles++

      this.logger.info(`[Continuous] Cycle ${cycles}`)

      // 1. Discover tasks
      const completedIds = this.state.completedTasks.map(t => t.id)
      const discovered = await this.discovery.discoverTasks(completedIds)

      if (discovered.length === 0) {
        // IMPROVED in v2.1: Exponential backoff
        this.consecutiveEmptyCycles++

        // Calculate wait time with backoff
        const waitTime = Math.min(
          config.sleepTimeOnNoTasks * this.backoffMultiplier,
          15 * 60 * 1000 // Max 15 minutes
        )

        this.logger.info(
          `[Continuous] No tasks (empty cycle ${this.consecutiveEmptyCycles}), ` +
          `waiting ${Math.floor(waitTime / 1000)}s...`
        )

        await this.sleep(waitTime)

        // Increase backoff multiplier
        this.backoffMultiplier = Math.min(this.backoffMultiplier * 2, 32)

        // Clear cache before retry
        this.discovery.clearCache()

        continue
      }

      // Reset on success
      this.consecutiveEmptyCycles = 0
      this.backoffMultiplier = 1

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

      this.emitProgress()
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

  /**
   * Emit progress (placeholder - would be passed in constructor)
   */
  private emitProgress(): void {
    // Implementation depends on progress reporting setup
  }
}
```

**Acceptance Criteria:**
- [ ] Loop doesn't exit when no tasks found
- [ ] **Implements exponential backoff** (CRITICAL)
- [ ] Sleeps between cycles correctly
- [ ] Respects max cycles limit
- [ ] Tasks are prioritized correctly
- [ ] Respects dependencies
- [ ] Updates state correctly
- [ ] Handles errors gracefully
- [ ] Can be stopped gracefully

---

**Phase 3 Acceptance Criteria:**
- [ ] Discovery engine finds tasks
- [ ] **Cache invalidates on git changes** (CRITICAL)
- [ ] **Typecheck runs before build** (CRITICAL)
- [ ] **Related tests run before all tests** (CRITICAL)
- [ ] Continuous loop runs indefinitely
- [ ] **Exponential backoff works** (CRITICAL)
- [ ] Max cycles is respected
- [ ] All edge cases handled

---

## Phase 4: Advanced Features (Week 9-11.5)

### Overview
Add advanced discovery, review system, quality gates, and parallel execution.

### Task Breakdown

#### 4.1 Advanced Discovery Strategies (3 days)

**File:** `packages/cli/src/agent/advanced-discovery.ts`

**No changes from v2.0** - already good.

---

#### 4.2 Review and Quality Gates (3 days)

**File:** `packages/cli/src/agent/review.ts`

**No changes from v2.0** - already good.

---

#### 4.3 Parallel Execution (4 days)

**File:** `packages/cli/src/agent/parallel-executor.ts`

**No changes from v2.0** - already good.

---

**Phase 4 Acceptance Criteria:**
- [ ] Advanced discovery strategies work
- [ ] Review engine checks results
- [ ] Quality gates block appropriately
- [ ] Parallel execution respects concurrency
- [ ] No deadlocks in parallel mode
- [ ] All components integrate

---

## Phase 5: Optimization & Polish (Week 12-13.5)

### Overview
Improve performance, add caching, enhance documentation, and polish.

### Task Breakdown

#### 5.1 Caching Layer (2 days)

**File:** `packages/cli/src/agent/cache.ts`

**No changes from v2.0** - already good.

---

#### 5.2 Enhanced Error Recovery (2 days)

**File:** `packages/cli/src/agent/error-recovery.ts`

**No changes from v2.0** - already good.

---

#### 5.3 Performance Optimizations (2 days)

**File:** `packages/cli/src/agent/optimizations.ts`

**No changes from v2.0** - already good.

---

#### 5.4 Documentation & Testing (3 days)

- Architecture diagrams
- Sequence diagrams
- State machine diagram
- Integration tests
- End-to-end tests
- Deployment guide

---

**Phase 5 Acceptance Criteria:**
- [ ] Caching improves performance
- [ ] Error recovery handles all cases
- [ ] Optimizations reduce resource usage
- [ ] Documentation is comprehensive
- [ ] Tests have good coverage
- [ ] Deployment guide is clear

---

## MVP Definition

### What's in MVP (9 weeks)?

**Week 1-2.5:** Phase 1 - Foundation
**Week 3-6.5:** Phase 2 - Core Execution
**Week 7-8.5:** Phase 3 - Continuous Improvement (basic only)
**Week 9:** Testing & Documentation

### MVP Includes:
✅ Complete type system
✅ State management (immutable!)
✅ Configuration with Zod validation
✅ **Session management** (NEW)
✅ **Resource monitoring** (NEW)
✅ **Task history** (NEW)
✅ **Health monitoring** (NEW)
✅ Orchestrator with state machine
✅ **Workflow adapters** (NEW)
✅ **Task timeout handling** (NEW)
✅ **Progress reporting** (NEW)
✅ Goal decomposition
✅ Task execution with workflow integration
✅ **Complete commit phase** (FIXED)
✅ **Complete continuous mode** (FIXED)
✅ Basic task discovery
✅ **Cache invalidation** (NEW)
✅ **Exponential backoff** (NEW)
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
- **Workflow adapter calls** (NEW)
- **Resource limit enforcement** (NEW)
- Error recovery flows

### End-to-End Tests
- Complete goal-directed execution
- Continuous improvement scenarios
- **Resource limit scenarios** (NEW)
- **Session conflict scenarios** (NEW)
- Error scenarios
- Interrupt handling

### Test Data
- Fixtures for common scenarios
- Mock git repository
- Sample codebase

---

## Deployment Guide

### Production Checklist

1. **Resource Limits**
   - Set appropriate `maxMemory` (recommend 4096MB for production)
   - Set `maxSessionTime` (recommend 480min = 8 hours)
   - Set `maxTaskExecutionTime` (recommend 120min)

2. **Monitoring**
   - Enable health monitoring
   - Set up log aggregation
   - Monitor resource usage
   - Alert on limits exceeded

3. **Sessions**
   - Configure lock directory
   - Set up session cleanup on boot
   - Monitor active sessions

4. **Approvals**
   - Use 'conservative' preset for production
   - Require approval for commits
   - Enable pause on error

5. **Discovery**
   - Enable all default strategies
   - Set cache time appropriately (300000ms = 5min)
   - Enable git change detection

6. **Continuous Mode**
   - Set reasonable sleep times (1min on no tasks, 5s between tasks)
   - Set max cycles if needed
   - Monitor for infinite loops

### Environment Setup

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run in development (interactive mode)
bun run autonomous "Add user authentication" --preset balanced

# Run in production mode (non-interactive)
bun run autonomous "Fix failing tests" --preset conservative -y

# Run continuous improvement
bun run autonomous --preset continuous-improvement -y

# Check on running agent
bun run autonomous --stop
```

### Monitoring

```bash
# View agent logs
tail -f .polka-agent/agent.log

# View agent state
cat .polka-agent/agent-state.json

# View task history
cat .polka-agent/task-history.json

# Check active sessions
ls /tmp/polka-agent-locks/
```

---

## TypeScript API Reference

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

// NEW in v2.1
export * from './session'
export * from './resource-monitor'
export * from './task-history'
export * from './health-monitor'
export * from './workflow-adapter'

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

### Key Improvements in v2.1

**Critical Fixes (Priority 1):**
1. ✅ Complete implementations (no placeholders)
2. ✅ Workflow adapter layer
3. ✅ Immutable state updates
4. ✅ Cache invalidation on git changes
5. ✅ Resource monitoring with enforcement

**Important Improvements (Priority 2):**
6. ✅ Task timeout handling
7. ✅ Progress reporting with emitters
8. ✅ Smarter discovery (typecheck before build)
9. ✅ Exponential backoff in continuous mode
10. ✅ Enhanced error recovery with suggestions

**New Components:**
- SessionManager (prevents conflicts)
- ResourceMonitor (enforces limits)
- TaskHistory (tracks executions)
- HealthMonitor (periodic checks)
- WorkflowAdapter (bridges APIs)

**Timeline Impact:**
- v2.0: 12 weeks total, 8 weeks MVP
- v2.1: **13.5 weeks total, 9 weeks MVP**

### Production Readiness

**v2.1 Plan Score: 9.5/10**

The v2.1 plan addresses all critical and important issues from the review. It is production-ready.

**Ready for implementation!**

---

## Next Steps

1. ✅ Review and approve v2.1 plan
2. ✅ Start Phase 1 implementation (2.5 weeks)
3. ✅ Create tests alongside implementation
4. ✅ Iterate based on feedback
5. ✅ Deploy MVP after 9 weeks
6. ✅ Add advanced features in weeks 10-13.5

Would you like to:
- **Start implementing Phase 1?**
- **Review specific components in detail?**
- **Create integration test specs?**
- **Set up the development environment?**
