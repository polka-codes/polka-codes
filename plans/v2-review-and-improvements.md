# Plan v2.0 - Further Review and Improvements

**Review Date:** 2025-01-02
**Reviewer:** AI System
**Status:** ✅ Strong Foundation, Several Improvements Possible

---

## Overall Assessment: 8.5/10

The v2.0 plan is **significantly improved** over v1 and addresses most critical concerns. However, there are still areas that can be enhanced.

---

## 🔴 Critical Issues (Must Fix Before Implementation)

### 1. **Incomplete Implementation References**

**Problem:** The plan has many placeholder comments like:
```typescript
// Execute commit workflow
// ... implementation

// Discover tasks
// ... (discovery logic)

// If no tasks found, wait and retry
// ... (wait logic)
```

**Impact:** Implementers won't know how to complete these sections.

**Solution:** Provide complete implementation for ALL critical paths, or mark clearly as "intentional placeholder for implementer to decide."

**Locations:**
- `orchestrator.ts` lines 2206, 2228-2231
- `goal-decomposer.ts` lines 1418, 1662, 2773, 2822
- `review.ts` lines 3480, 3482, 3514

**Recommendation:** Create complete implementation OR provide detailed pseudocode with clear API contracts.

---

### 2. **Workflow Integration API Mismatch**

**Problem:** The plan assumes workflows return `WorkflowExecutionResult` but actual workflows return different shapes:

**Actual Code:**
```typescript
// code.workflow.ts
export const codeWorkflow: WorkflowFn<...> = async (input, context) => {
  return {
    success: true,
    summaries: string[]
  } | {
    success: false,
    reason: string,
    summaries: string[]
  }
}
```

**Plan Assumption:**
```typescript
interface WorkflowExecutionResult {
  success: boolean
  data?: any
  output?: string
  filesModified?: string[]
  testsRun?: number
  testsPassed?: number
}
```

**Impact:** Task executor won't work correctly with actual workflows.

**Solution:** Create adapters/wrappers for each workflow:

```typescript
// packages/cli/src/agent/workflow-adapters.ts
export class WorkflowAdapter {
  static async adaptCodeWorkflow(input: any, context: any): Promise<WorkflowExecutionResult> {
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
  }

  // Similar adapters for other workflows...
}
```

**Recommendation:** Add explicit workflow adapter layer in Phase 2.

---

### 3. **Missing State Persistence in Orchestrator**

**Problem:** The orchestrator updates state in memory but doesn't persist it consistently.

**Example:**
```typescript
task.status = 'in-progress'
task.startedAt = Date.now()
state.currentTask = task

await this.stateManager.updateState({
  currentTask: task,
  taskQueue: state.taskQueue
})
```

**Issue:** `task.status` and `task.startedAt` are modified but not in the update object.

**Impact:** State file won't have accurate task status if agent crashes.

**Solution:**
```typescript
// Before modifying
const taskIndex = state.taskQueue.findIndex(t => t.id === task.id)
state.taskQueue[taskIndex] = { ...task, status: 'in-progress', startedAt: Date.now() }
state.currentTask = state.taskQueue[taskIndex]

await this.stateManager.updateState({
  currentTask: state.taskQueue[taskIndex],
  taskQueue: state.taskQueue
})
```

**Recommendation:** Ensure ALL state mutations go through `updateState()`.

---

### 4. **Circular Dependency Risk**

**Problem:** Task discovery → task execution → git changes → task discovery (cache invalidation)

**Scenario:**
1. Discovery finds build errors (cached)
2. Task fixes build errors
3. Agent commits changes
4. Discovery still uses old cache → thinks build still broken
5. Infinite loop or stale data

**Solution:** Implement cache invalidation on state changes:

```typescript
export class TaskDiscoveryEngine {
  private lastKnownGitState: string = ''

  async discoverTasks(excludeCompleted: string[] = []): Promise<Task[]> {
    // Check git state
    const currentGitState = await this.getGitState()

    if (currentGitState !== this.lastKnownGitState) {
      this.clearCache()
      this.lastKnownGitState = currentGitState
    }

    // ... rest of discovery
  }

  private async getGitState(): Promise<string> {
    const result = await this.context.tools.executeCommand({
      command: 'git',
      args: ['rev-parse', 'HEAD']
    })
    return result.stdout.trim()
  }
}
```

**Recommendation:** Add cache invalidation strategy in Phase 3.

---

## 🟡 Important Issues (Should Fix)

### 5. **No Retry Strategy with Backoff**

**Problem:** Continuous improvement loop retries failed tasks immediately without backoff.

**Current:**
```typescript
if (discovered.length === 0) {
  this.logger.info('[Continuous] No tasks discovered, waiting...')
  await this.sleep(config.sleepTimeOnNoTasks) // Fixed wait
  this.discovery.clearCache()
  continue // Immediate retry
}
```

**Issue:** If discovery is broken/expensive, will hammer it every 60 seconds.

**Solution:** Implement exponential backoff:

```typescript
private consecutiveEmptyCycles = 0
private backoffMultiplier = 1

async run(): Promise<void> {
  // ...

  if (discovered.length === 0) {
    this.consecutiveEmptyCycles++

    // Exponential backoff: 1min, 2min, 4min, 8min (max 15min)
    const waitTime = Math.min(
      config.sleepTimeOnNoTasks * this.backoffMultiplier,
      15 * 60 * 1000 // 15 minutes max
    )

    this.logger.info(`[Continuous] No tasks (cycle ${this.consecutiveEmptyCycles}), waiting ${waitTime}ms`)

    await this.sleep(waitTime)
    this.backoffMultiplier *= 2
    this.discovery.clearCache()
    continue
  }

  // Reset on success
  this.consecutiveEmptyCycles = 0
  this.backoffMultiplier = 1
}
```

---

### 6. **Missing Resource Monitoring**

**Problem:** Plan defines `ResourceLimits` but never enforces them.

**Config:**
```typescript
resourceLimits: {
  maxMemory: 2048,
  maxCpuPercent: 80,
  maxTaskExecutionTime: 60,
  maxSessionTime: 480
}
```

**Issue:** Agent could run for 10 hours, use 4GB memory, and never stop.

**Solution:** Add resource monitor:

```typescript
export class ResourceMonitor {
  private startTime: number
  private checkInterval: NodeJS.Timeout | null = null

  constructor(
    private limits: ResourceLimits,
    private onLimitExceeded: (limit: string, current: number, max: number) => void
  ) {
    this.startTime = Date.now()
  }

  start() {
    this.checkInterval = setInterval(() => this.check(), 30000) // Every 30s
  }

  stop() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }
  }

  private check() {
    // Check memory
    const memUsage = process.memoryUsage()
    const memUsedMB = memUsage.heapUsed / 1024 / 1024

    if (memUsedMB > this.limits.maxMemory) {
      this.onLimitExceeded('memory', memUsedMB, this.limits.maxMemory)
    }

    // Check session time
    const elapsedMinutes = (Date.now() - this.startTime) / 60000

    if (elapsedMinutes > this.limits.maxSessionTime) {
      this.onLimitExceeded('sessionTime', elapsedMinutes, this.limits.maxSessionTime)
    }
  }
}

// In orchestrator:
constructor(...) {
  // ...

  this.resourceMonitor = new ResourceMonitor(
    config.resourceLimits,
    (limit, current, max) => this.handleResourceExceeded(limit, current, max)
  )
}

private handleResourceExceeded(limit: string, current: number, max: number) {
  this.logger.error(`Resource limit exceeded: ${limit} (${current}/${max})`)

  if (this.config.pauseOnError) {
    // Ask user what to do
  } else {
    // Auto-stop
    this.transitionState(this.state.currentMode, 'stopped', `Resource limit: ${limit}`)
  }
}
```

**Recommendation:** Add resource monitoring in Phase 1 or 5.

---

### 7. **No Task Timeout Handling**

**Problem:** `maxTaskExecutionTime` is defined but not enforced.

**Issue:** A task could hang forever (e.g., network timeout, infinite loop).

**Solution:** Add timeout wrapper:

```typescript
async executeTask(task: Task): Promise<void> {
  const timeoutMs = this.config.resourceLimits.maxTaskExecutionTime * 60 * 1000

  const result = await Promise.race([
    this.executeTaskInternal(task),
    this.timeout(timeoutMs, task)
  ])

  // Handle result
}

private async timeout(ms: number, task: Task): Promise<never> {
  await new Promise(resolve => setTimeout(resolve, ms))

  throw new TaskExecutionError(
    task.id,
    `Task timed out after ${ms}ms`
  )
}
```

**Recommendation:** Add timeout handling in Phase 2.

---

### 8. **Missing Progress Reporting to User**

**Problem:** Plan defines `ProgressReport` but no mechanism to send it to user.

**Issue:** User has no idea what agent is doing during long-running tasks.

**Solution:** Add progress emitter:

```typescript
export class AutonomousAgent {
  private progressListeners: Set<(report: ProgressReport) => void> = new Set()

  onProgress(callback: (report: ProgressReport) => void): () => void {
    this.progressListeners.add(callback)

    // Return unsubscribe function
    return () => this.progressListeners.delete(callback)
  }

  private emitProgress() {
    const report = this.getProgress()

    for (const listener of this.progressListeners) {
      try {
        listener(report)
      } catch (error) {
        this.logger.error('Progress listener', error as Error)
      }
    }
  }

  // Call emitProgress() at key points:
  // - State transitions
  // - Task start/complete
  // - Every N seconds during long operations
}

// In CLI:
const agent = new AutonomousAgent(config, context)

agent.onProgress((report) => {
  console.clear()
  console.log(`
┌────────────────────────────────────┐
│ Agent Progress                     │
├────────────────────────────────────┤
│ Mode: ${report.mode.padEnd(25)} │
│ Task: ${report.currentTask || 'None'.padEnd(24)} │
│ Progress: ${Math.floor(report.progress)}% (${report.completedTasks}/${report.totalTasks}) │
│ Time Remaining: ${report.estimatedTimeRemaining}m │
└────────────────────────────────────┘
  `)
})
```

**Recommendation:** Add progress reporting in Phase 1 or 2.

---

### 9. **Discovery Strategies Need Refinement**

**Problem:** Some discovery strategies are naive or inefficient.

#### 9.1 Build Discovery Always Runs Build

**Current:**
```typescript
const result = await context.tools.executeCommand({
  command: 'bun',
  args: ['run', 'build']
})
if (result.exitCode !== 0) {
  // Create task
}
```

**Issues:**
- Runs build even if nothing changed
- Takes 30+ seconds unnecessarily
- Generates build artifacts

**Better:**
```typescript
async discoverBuildErrors(context: WorkflowContext): Promise<Task[]> {
  // 1. Check if there are any TypeScript files
  const hasSourceFiles = await this.checkHasSourceFiles(context)
  if (!hasSourceFiles) return []

  // 2. Quick typecheck first (faster than full build)
  const typecheckResult = await context.tools.executeCommand({
    command: 'bun',
    args: ['run', 'typecheck']
  })

  if (typecheckResult.exitCode !== 0) {
    // Type errors found - create tasks for them
    return this.parseTypeErrors(typecheckResult.stdout)
  }

  // 3. Only run full build if typecheck passes
  const buildResult = await context.tools.executeCommand({
    command: 'bun',
    args: ['run', 'build']
  })

  if (buildResult.exitCode !== 0) {
    return [{
      id: `build-error-${Date.now()}`,
      type: 'bugfix',
      title: 'Fix build errors',
      // ...
    }]
  }

  return []
}
```

#### 9.2 Test Discovery Should Be Smarter

**Current:** Runs all tests every time.

**Better:**
```typescript
async discoverFailingTests(context: WorkflowContext): Promise<Task[]> {
  // 1. Check if there are test files
  const testFiles = await this.findTestFiles(context)
  if (testFiles.length === 0) return []

  // 2. Quick check: look for common test failure patterns
  const recentChanges = await this.getRecentlyChangedFiles(context)
  const relatedTests = await this.findTestsForFiles(recentChanges, testFiles)

  if (relatedTests.length > 0) {
    // Run only related tests
    const result = await context.tools.executeCommand({
      command: 'bun',
      args: ['test', '--filter', relatedTests.join('|')]
    })

    // Create tasks for failures
  }

  return []
}
```

**Recommendation:** Refine discovery strategies in Phase 3.

---

### 10. **Error Recovery is Too Simple**

**Problem:** Error recovery just asks user "continue?" without context.

**Better:**
```typescript
async handleTaskError(task: Task, error: Error): Promise<void> {
  const state = this.state!

  if (this.config.pauseOnError) {
    // Classify error
    const errorType = this.classifyError(error)

    // Suggest recovery action based on error type
    const suggestion = this.getSuggestedRecovery(errorType, error)

    this.logger.error('Task execution paused', error)
    console.log(`\n💡 Suggestion: ${suggestion}\n`)

    // Ask user what to do
    const answer = await getUserInput(
      '\n❌ Task failed. Continue? (yes/no/retry/skip)'
    )

    if (answer?.toLowerCase() === 'skip') {
      // Skip this task and mark as blocked
      task.status = 'blocked'
      state.blockedTasks.push(task)
      this.transitionState('error-recovery', 'executing', 'task skipped')
    }
    // ... other options
  }
}

private classifyError(error: Error): ErrorType {
  // Use ErrorRecoveryEngine
}

private getSuggestedRecovery(errorType: ErrorType, error: Error): string {
  switch (errorType) {
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
```

**Recommendation:** Enhance error recovery in Phase 2 or 5.

---

## 🟢 Nice to Have Improvements

### 11. **Add Task Prioritization Heuristics**

Current priority is static. Add dynamic priority adjustment:

```typescript
export class TaskPrioritizer {
  adjustPriorities(tasks: Task[], state: AgentState): Task[] {
    return tasks.map(task => {
      let adjustedPriority = task.priority

      // Boost priority if blocking many tasks
      const blockedCount = tasks.filter(t =>
        t.dependencies.includes(task.id) && t.status === 'pending'
      ).length

      if (blockedCount > 3) {
        adjustedPriority = Math.min(adjustedPriority + 100, Priority.CRITICAL)
        task.metadata = task.metadata || {}
        task.metadata.priorityBoost = `Blocking ${blockedCount} tasks`
      }

      // Reduce priority if recently failed
      const recentFailure = state.failedTasks.find(t =>
        t.id === task.id &&
        Date.now() - (t.completedAt || 0) < 300000 // 5 minutes
      )

      if (recentFailure) {
        adjustedPriority = Math.max(adjustedPriority - 200, Priority.TRIVIAL)
        task.metadata = task.metadata || {}
        task.metadata.priorityReduced = 'Recently failed'
      }

      task.priority = adjustedPriority
      return task
    })
  }
}
```

---

### 12. **Add Task Dependency Visualization**

Generate a dependency graph for debugging:

```typescript
export class DependencyVisualizer {
  visualize(tasks: Task[]): string {
    const lines: string[] = []

    for (const task of tasks) {
      const deps = task.dependencies.map(depId => {
        const dep = tasks.find(t => t.id === depId)
        return dep?.title || depId
      }).join(', ')

      lines.push(`${task.title}`)
      lines.push(`  ↓ Depends on: ${deps || 'none'}`)
      lines.push(`  ↓ Priority: ${Priority[task.priority]}`)
      lines.push('')
    }

    return lines.join('\n')
  }

  generateMermaidDiagram(tasks: Task[]): string {
    let diagram = 'graph TD\n'

    for (const task of tasks) {
      diagram += `  ${task.id}[${task.title}]\n`

      for (const depId of task.dependencies) {
        diagram += `  ${depId} --> ${task.id}\n`
      }
    }

    return diagram
  }
}
```

---

### 13. **Add Dry Run Mode**

Allow users to see what agent would do without actually doing it:

```typescript
export class AutonomousAgent {
  async dryRun(goal: string): Promise<Plan> {
    this.logger.info('[Dry Run] Planning mode - no changes will be made')

    // Plan the goal
    const decomposition = await this.goalDecomposer.decompose(goal)
    const plan = this.taskPlanner.createPlan(goal, decomposition.tasks)

    // Show what would happen
    console.log('\n📋 Plan Summary:')
    console.log(`  Tasks: ${plan.tasks.length}`)
    console.log(`  Estimated Time: ${plan.estimatedTime} minutes`)
    console.log(`  Phases: ${plan.executionOrder.length}`)

    console.log('\n📝 Tasks:')
    for (const task of plan.tasks) {
      console.log(`  ${task.title}`)
      console.log(`    Priority: ${Priority[task.priority]}`)
      console.log(`    Workflow: ${task.workflow}`)
      console.log(`    Files: ${task.files.length > 0 ? task.files.join(', ') : 'TBD'}`)
    }

    return plan
  }
}
```

---

### 14. **Add Task History/Search**

Keep history of all executed tasks for debugging:

```typescript
export class TaskHistory {
  private history: ExecutionRecord[] = []

  add(record: ExecutionRecord) {
    this.history.push(record)
  }

  findByType(type: TaskType): ExecutionRecord[] {
    return this.history.filter(r => r.taskType === type)
  }

  findFailed(limit: number = 10): ExecutionRecord[] {
    return this.history
      .filter(r => !r.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  findSlow(limit: number = 10): ExecutionRecord[] {
    return this.history
      .sort((a, b) => b.actualTime - a.actualTime)
      .slice(0, limit)
  }

  generateReport(): string {
    const total = this.history.length
    const successful = this.history.filter(r => r.success).length
    const failed = total - successful

    const avgTime = this.history.reduce((sum, r) => sum + r.actualTime, 0) / total

    return `
Task History Report:
  Total: ${total}
  Successful: ${successful} (${(successful / total * 100).toFixed(1)}%)
  Failed: ${failed} (${(failed / total * 100).toFixed(1)}%)
  Average Time: ${avgTime.toFixed(1)} minutes
    `.trim()
  }
}
```

---

## 📊 Additional Architectural Concerns

### 15. **No Health Check Mechanism**

Add health check for monitoring:

```typescript
export class HealthMonitor {
  private lastHealthCheck: number = 0
  private healthInterval: NodeJS.Timeout | null = null

  start(callback: () => Promise<HealthStatus>) {
    this.healthInterval = setInterval(async () => {
      try {
        const status = await callback()
        this.lastHealthCheck = Date.now()

        if (!status.healthy) {
          this.logger.warn(`Health check failed: ${status.reason}`)
        }
      } catch (error) {
        this.logger.error('Health check error', error as Error)
      }
    }, 60000) // Every minute
  }

  stop() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval)
      this.healthInterval = null
    }
  }
}

interface HealthStatus {
  healthy: boolean
  reason?: string
}
```

---

### 16. **Missing Task Cancellation**

No way to cancel running tasks:

```typescript
export class TaskExecutor {
  private abortControllers: Map<string, AbortController> = new Map()

  async execute(task: Task, state: AgentState): Promise<WorkflowExecutionResult> {
    const controller = new AbortController()
    this.abortControllers.set(task.id, controller)

    try {
      // Execute with abort signal
      const result = await this.invokeWorkflow(
        task.workflow,
        task.workflowInput,
        controller.signal
      )

      return result
    } catch (error) {
      if (error.name === 'AbortError') {
        return {
          success: false,
          error: new Error('Task cancelled by user')
        }
      }
      throw error
    } finally {
      this.abortControllers.delete(task.id)
    }
  }

  cancel(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
      return true
    }
    return false
  }
}
```

---

### 17. **No Session Management**

Multiple agent sessions could conflict:

```typescript
export class SessionManager {
  private static activeSessions: Set<string> = new Set()

  static async acquire(sessionId: string): Promise<boolean> {
    if (this.activeSessions.has(sessionId)) {
      return false // Session already active
    }

    // Check for stale session file
    const stateFile = `${STATE_DIR}/agent-${sessionId}.json`
    try {
      const stats = await fs.stat(stateFile)
      const age = Date.now() - stats.mtimeMs

      if (age < 3600000) { // 1 hour
        return false // Recent session, likely still active
      }
    } catch {
      // No state file, safe to proceed
    }

    this.activeSessions.add(sessionId)
    return true
  }

  static release(sessionId: string) {
    this.activeSessions.delete(sessionId)
  }

  static listActive(): string[] {
    return Array.from(this.activeSessions)
  }
}
```

---

## 🎯 Recommendations for Implementation

### Priority 1 (Must Have)
1. ✅ Complete all placeholder implementations
2. ✅ Add workflow adapter layer
3. ✅ Fix state persistence bugs
4. ✅ Add cache invalidation strategy
5. ✅ Implement resource monitoring

### Priority 2 (Should Have)
6. ✅ Add retry with exponential backoff
7. ✅ Add task timeout handling
8. ✅ Implement progress reporting
9. ✅ Refine discovery strategies
10. ✅ Enhance error recovery

### Priority 3 (Nice to Have)
11. ✅ Dynamic task prioritization
12. ✅ Dependency visualization
13. ✅ Dry run mode
14. ✅ Task history/search
15. ✅ Health check mechanism
16. ✅ Task cancellation
17. ✅ Session management

---

## 📝 Proposed Plan Updates

### Update Phase 1 (Week 1-2)
Add to Phase 1:
- ResourceMonitor class (1 day)
- SessionManager class (0.5 day)
- TaskHistory class (0.5 day)

**New Total:** 2 weeks → 2.5 weeks

### Update Phase 2 (Week 3-5)
Add to Phase 2:
- WorkflowAdapter class (1 day)
- Task timeout handling (0.5 day)
- Progress reporting (0.5 day)
- Enhanced error recovery (1 day)

**New Total:** 3 weeks → 3.5 weeks

### Update Phase 3 (Week 6-7)
Add to Phase 3:
- Cache invalidation strategy (1 day)
- Retry with exponential backoff (1 day)
- Discovery strategy refinement (2 days)

**New Total:** 2 weeks → 2.5 weeks

**New Overall Total:** 12 weeks → **13.5 weeks**
**New MVP:** 8 weeks → **9 weeks**

---

## ✅ Final Verdict

**v2.0 Plan Score: 8.5/10**

**Strengths:**
- Excellent foundation and architecture
- Clear separation of concerns
- Good use of TypeScript type system
- Comprehensive state machine
- Well-defined priorities

**Critical Gaps:**
- Incomplete implementations (need full code or clear pseudocode)
- Workflow API mismatch (need adapter layer)
- State persistence bugs (fix mutations)
- Cache invalidation (add git state tracking)
- No resource monitoring (enforce limits)

**With Recommended Improvements: 9.5/10**

The plan would be production-ready with Priority 1 & 2 fixes implemented.

---

## 🚀 Next Steps

1. **Create v2.1 plan** with all Priority 1 fixes
2. **Add complete implementations** for all critical paths
3. **Create workflow adapter specifications**
4. **Add integration tests** to validate workflow calls
5. **Create deployment guide** with monitoring setup
6. **Set up CI/CD** for testing agent itself

Would you like me to create a v2.1 plan with these improvements?
