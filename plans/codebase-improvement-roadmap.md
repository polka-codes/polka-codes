# Codebase Improvement Roadmap

**Date:** 2026-01-03
**Status:** 🚧 Active Development
**Focus:** Quality, Type Safety, and Developer Experience

---

## Executive Summary

The autonomous agent implementation is **functionally complete** with good test coverage, but has opportunities for improvement in:
1. Type safety (reducing `as any` usage)
2. Error handling consistency
3. Documentation completeness
4. Performance optimization
5. Developer experience

**Current State Assessment:**
- ✅ Core functionality: Working
- ✅ Test coverage: Good (6800+ lines, ~25 test files)
- ✅ Architecture: Well-structured with clear separation of concerns
- ⚠️ Type safety: 13 instances of `as any` (mostly in tests, some production code)
- ⚠️ Error handling: 16 empty catch blocks (mostly with comments, but could be better)
- ⚠️ Documentation: Some TODOs remain

---

## Priority 1: Type Safety Improvements 🎯

### Current Issues

**1. Test Mock Objects (8 instances)**
Most `as any` usage is in test mocks:
- `executor.test.ts:65` - Mock context
- `planner.test.ts:16` - Mock tools
- `goal-decomposer.test.ts:19-20` - Mock tools/step
- `task-discovery.test.ts:15` - Mock context
- `improvement-loop.test.ts:69` - Mock config/stateManager
- `workflow-adapter.test.ts:60` - Test for unknown workflow

**Action:** Create proper test fixture interfaces:

```typescript
// packages/cli/src/agent/test-fixtures.ts
export interface MockWorkflowContext {
  tools: Partial<WorkflowTools<any>>
  logger: Logger
  step: StepFn
  workingDir: string
  stateDir: string
  sessionId: string
  env: Record<string, string | undefined>
}

export function createMockContext(overrides?: Partial<MockWorkflowContext>): MockWorkflowContext {
  return {
    tools: {},
    logger: createMockLogger(),
    step: createMockStepFn(),
    workingDir: '/test',
    stateDir: '/test/state',
    sessionId: 'test-session',
    env: {},
    ...overrides,
  }
}
```

**2. Production Code Type Issues (5 instances)**

#### Issue 2.1: Orchestrator Metrics Logging
**File:** `orchestrator.ts:341`
```typescript
this.logger.info('[Cleanup] Metrics:', metrics as any)
```
**Problem:** Logger.info might not handle complex object logging properly
**Solution:**
```typescript
this.logger.info('[Cleanup] Metrics:', JSON.stringify(metrics, null, 2))
```

#### Issue 2.2: Task Discovery Error Handling (4 instances)
**File:** `task-discovery.ts:91, 131, 185, 239, 293`
```typescript
const output = (error as any).stdout || (error as any).stderr || String(error)
```
**Problem:** Unsafe type assertions on error objects
**Solution:**
```typescript
interface CommandError {
  stdout?: string
  stderr?: string
  message?: string
  code?: number
}

const output = (error as CommandError).stdout ||
               (error as CommandError).stderr ||
               (error as Error).message ||
               String(error)
```

### Expected Impact
- Reduced runtime errors from type mismatches
- Better IDE autocompletion
- Easier refactoring
- Improved code maintainability

**Estimated Effort:** 2-3 hours
**Priority:** High (blocks nothing, but improves DX)

---

## Priority 2: Error Handling Consistency 🛡️

### Current State

**16 empty catch blocks** found across the codebase:

#### Well-Documented Empty Catches (Good) ✅
1. `session.ts:92` - "Ignore if file doesn't exist"
2. `task-history.ts:120` - "No existing history"
3. `task-history.ts:133` - "Ignore if file doesn't exist"
4. `advanced-discovery.ts:410` - "git command failed, skip this check"
5. `advanced-discovery.ts:456` - "Test file doesn't exist"
6. `advanced-discovery.ts:593` - "Skip directories we can't read"
7. `advanced-discovery.ts:612` - "File doesn't exist"
8. `state-manager.ts:241` - Implicit: return empty array on parse failure
9. `state-manager.ts:274` - "Ignore if file doesn't exist"
10. `config.ts:83` - Implicit: return false on validation failure
11. `safety/checks.ts:91` - Implicit: return safe default
12. `safety/checks.ts:165` - Implicit: return safe default

#### Problematic Empty Catches (Needs Improvement) ⚠️
1. `task-discovery.ts:66-68` - No comment, returns 'unknown'
2. `executor.test.ts:248` - Test code, acceptable but could use comment
3. `executor.test.ts:280` - Test code, acceptable but could use comment

### Recommendations

**1. Standardize Error Logging Pattern**

Create a utility function for safe error logging:

```typescript
// packages/cli/src/agent/error-handling.ts
export function logAndSuppress(
  logger: Logger,
  error: unknown,
  context: string,
  options: {
    silent?: boolean
    level?: 'warn' | 'debug' | 'error'
  } = {}
): void {
  const { silent = false, level = 'debug' } = options

  if (!silent) {
    const message = error instanceof Error ? error.message : String(error)
    logger[level](`[${context}] ${message}`)

    if (level === 'debug' && error instanceof Error && error.stack) {
      logger.debug(`[${context}] Stack:`, error.stack)
    }
  }
}

// Usage:
} catch (error) {
  logAndSuppress(logger, error, 'TaskDiscovery.getProjectType')
  return 'unknown'
}
```

**2. Add Structured Error Types**

```typescript
// packages/cli/src/agent/errors.ts (extend existing)
export class FileSystemAccessError extends AgentError {
  constructor(path: string, operation: string, cause?: Error) {
    super(`Failed to ${operation} ${path}`, cause)
    this.name = 'FileSystemAccessError'
  }
}

export class CommandExecutionError extends AgentError {
  constructor(command: string, exitCode: number, stderr: string) {
    super(`Command failed with code ${exitCode}: ${command}`)
    this.name = 'CommandExecutionError'
    this.details = { command, exitCode, stderr }
  }
}
```

**3. Document All Empty Catches**

For any catch block that intentionally suppresses errors:
- Add a comment explaining WHY it's safe to suppress
- Use the `logAndSuppress` utility for debugging visibility

### Expected Impact
- Better debugging experience
- Easier troubleshooting in production
- Clearer intent for error suppression
- Reduced mystery failures

**Estimated Effort:** 3-4 hours
**Priority:** High (production stability)

---

## Priority 3: Complete Implementation TODOs 📝

### Remaining TODOs

**1. Task Cancellation with AbortController**
**File:** `executor.ts:55`
```typescript
// TODO: Implement proper cancellation with AbortController
```
**Current State:** Tasks use `Promise.race` with timeout but don't cancel underlying workflow
**Impact:** Long-running workflows continue in background after timeout

**Solution:**
```typescript
export class TaskExecutor {
  private abortControllers: Map<string, AbortController> = new Map()

  async execute(task: Task, state: AgentState): Promise<WorkflowExecutionResult> {
    const abortController = new AbortController()
    this.abortControllers.set(task.id, abortController)

    const timeoutMs = state.config.resourceLimits.maxTaskExecutionTime * 60 * 1000

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        abortController.abort()
        reject(new TaskExecutionError(task.id, `Task timed out after ${timeoutMs}ms`))
      }, timeoutMs)
    })

    try {
      const result = await Promise.race([
        this.invokeWorkflow(task, abortController.signal),
        timeoutPromise,
      ])
      return result
    } finally {
      this.abortControllers.delete(task.id)
    }
  }

  private async invokeWorkflow(
    task: Task,
    signal: AbortSignal
  ): Promise<WorkflowExecutionResult> {
    // Pass signal to workflow adapter
    return await WorkflowAdapter.invokeWorkflow(
      task.workflow,
      task.workflowInput,
      this.context,
      signal
    )
  }

  cancel(taskId: string): boolean {
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
      this.abortControllers.delete(taskId)
      return true
    }
    return false
  }
}
```

**Requires Changes:**
- `workflow-adapter.ts` - Accept AbortSignal and pass to workflows
- `runWorkflow.ts` - Pass AbortSignal to workflow context
- Individual workflows - Respect AbortSignal

**Estimated Effort:** 4-6 hours
**Priority:** Medium (resource management)

**2. Plan Approval Flow**
**File:** `orchestrator.ts:234`
```typescript
// TODO: Implement proper plan approval flow using ApprovalManager
// Bypassing this.approvalManager.requestApproval() until user approval workflow is ready
const approved = true
```
**Current State:** Plans are auto-approved
**Impact:** No user oversight before agent executes large changes

**Solution:**
```typescript
// In orchestrator.ts run() method
// 4. Request approval
this.logger.info('[Run] Phase 4: Requesting approval...')

const approvalRequest: PlanApprovalRequest = {
  planId: generateId(),
  goal: state.currentGoal,
  tasks: plan.tasks,
  estimatedTime: plan.estimatedTime,
  risks: plan.risks,
  executionOrder: plan.executionOrder,
}

const decision = await this.approvalManager.requestPlanApproval(approvalRequest)

if (!decision.approved) {
  this.logger.info(`[Run] ❌ Plan not approved: ${decision.reason}`)
  await this.stateManager.updateState({ currentMode: 'idle' })
  return
}

this.logger.info('[Run] ✅ Plan approved')
```

**Requires:**
- Extend `ApprovalManager` with `requestPlanApproval()` method
- Add approval types to `agent/types.ts`
- Implement approval UI (CLI prompts)

**Estimated Effort:** 2-3 hours
**Priority:** Medium (safety/user control)

---

## Priority 4: Performance Optimizations ⚡

### 4.1 Command Execution Caching

**Issue:** Many git commands are executed repeatedly (e.g., checking current branch multiple times)

**Solution:** Add lightweight caching:
```typescript
export class CachedGitOperations extends GitOperations {
  private cache = new Map<string, { value: any; expires: number }>()
  private ttl = 5000 // 5 seconds

  private async cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)
    if (cached && cached.expires > Date.now()) {
      return cached.value as T
    }

    const value = await fn()
    this.cache.set(key, { value, expires: Date.now() + this.ttl })
    return value
  }

  async getCurrentBranch(): Promise<string> {
    return this.cached('currentBranch', () => super.getCurrentBranch())
  }
}
```

**Impact:** Faster task execution, reduced system load
**Estimated Effort:** 1-2 hours
**Priority:** Low (nice to have)

### 4.2 Parallel Task Execution

**Current:** Tasks in a phase execute sequentially
**Opportunity:** Some tasks can run in parallel (e.g., multiple file reads)

**Solution:**
```typescript
// In orchestrator.ts executePlan()
for (let i = 0; i < plan.executionOrder.length; i++) {
  const phase = plan.executionOrder[i]

  // Group independent tasks
  const parallelGroups = this.groupIndependentTasks(phase, plan.tasks)

  for (const group of parallelGroups) {
    if (group.length === 1) {
      await this.executeTask(group[0])
    } else {
      // Execute independent tasks in parallel
      await Promise.all(
        group.map(task => this.executeTask(task))
      )
    }
  }
}
```

**Requires:** Task dependency analysis
**Estimated Effort:** 3-4 hours
**Priority:** Low (performance)

---

## Priority 5: Developer Experience 🛠️

### 5.1 Better Error Messages

**Current:** Generic error messages
**Example:** `Task failed: Unknown error`

**Improved:**
```typescript
// In executor.ts
if (!result.success) {
  const errorMsg = result.error?.message || 'Unknown error'
  const context = {
    taskId: task.id,
    taskType: task.type,
    workflow: task.workflow,
    input: JSON.stringify(task.workflowInput).slice(0, 100),
  }
  this.logger.error('[Executor]', new TaskExecutionError(task.id, errorMsg, result.error, context))
}
```

### 5.2 Debug Logging

**Add structured debug logs:**
```typescript
// In orchestrator.ts
if (this.logger.isDebugEnabled()) {
  this.logger.debug('[Run] Task details:', {
    id: task.id,
    title: task.title,
    type: task.type,
    priority: task.priority,
    estimatedTime: task.estimatedTime,
    dependencies: task.dependencies,
  })
}
```

### 5.3 CLI Improvements

**Add progress indicators:**
```typescript
// In agent command
if (options.progress) {
  const progress = createProgressBar(phaseCount)
  for (const phase of phases) {
    await executePhase(phase)
    progress.increment()
  }
}
```

**Estimated Effort:** 2-3 hours
**Priority:** Low (DX improvement)

---

## Priority 6: Documentation 📚

### 6.1 Architecture Documentation

**Create:** `packages/cli/src/agent/ARCHITECTURE.md`
```markdown
# Agent System Architecture

## Components

### Orchestrator
- **Responsibility:** Coordinates all agent components
- **Lifecycle:** Initialize → Plan → Execute → Cleanup
- **State Management:** Transitions through agent modes

### Task Executor
- **Responsibility:** Executes individual tasks
- **Timeout:** Enforces per-task time limits
- **Cancellation:** Supports task cancellation

### Workflow Adapter
- **Responsibility:** Bridges agent tasks to CLI workflows
- **Normalization:** Converts workflow results to agent format

...

## Data Flow

1. User provides goal → Orchestrator
2. Goal → GoalDecomposer → Task[]
3. Task[] → TaskPlanner → Plan
4. Plan → ApprovalManager → User
5. Approved plan → TaskExecutor → Workflows
6. Results → TaskHistory → Metrics
```

### 6.2 API Documentation

**Add JSDoc comments to all public APIs:**
```typescript
/**
 * Executes a task with timeout and cancellation support
 *
 * @param task - The task to execute
 * @param state - Current agent state (contains config for timeouts)
 * @returns Promise resolving to execution result
 * @throws {TaskExecutionError} If task times out or workflow fails
 *
 * @example
 * ```typescript
 * const result = await executor.execute(task, state)
 * if (result.success) {
 *   console.log('Task completed:', result.output)
 * }
 * ```
 */
async execute(task: Task, state: AgentState): Promise<WorkflowExecutionResult>
```

**Estimated Effort:** 4-5 hours
**Priority:** Medium (maintainability)

---

## Implementation Roadmap

### Phase 1: Type Safety (Week 1)
- [ ] Create test fixture interfaces
- [ ] Replace all `as any` in test mocks
- [ ] Fix production code type issues
- [ ] Run full typecheck validation

### Phase 2: Error Handling (Week 1-2)
- [ ] Create `error-handling.ts` utility
- [ ] Add structured error types
- [ ] Update all empty catch blocks with `logAndSuppress`
- [ ] Add error handling tests

### Phase 3: Complete TODOs (Week 2)
- [ ] Implement AbortController for task cancellation
- [ ] Implement plan approval flow
- [ ] Add integration tests for new features

### Phase 4: Performance & DX (Week 3)
- [ ] Add command execution caching
- [ ] Implement parallel task execution
- [ ] Improve error messages
- [ ] Add debug logging
- [ ] Add progress indicators

### Phase 5: Documentation (Ongoing)
- [ ] Write ARCHITECTURE.md
- [ ] Add JSDoc to public APIs
- [ ] Create usage examples
- [ ] Update README

---

## Success Metrics

**Type Safety:**
- ✅ Zero `as any` in production code
- ✅ All test mocks use proper interfaces

**Error Handling:**
- ✅ All catch blocks have explanatory comments
- ✅ All errors logged with context
- ✅ Error recovery tested

**Performance:**
- ✅ Git commands cached (5s TTL)
- ✅ Independent tasks run in parallel
- ✅ Task cancellation works correctly

**Documentation:**
- ✅ Architecture docs complete
- ✅ Public API documented
- ✅ Examples cover main use cases

---

## Open Questions

1. **AbortController Propagation:** Should AbortSignal be part of the `WorkflowContext` passed to all workflows? This would require updating all workflow signatures.

2. **Parallel Task Execution:** What's the strategy for determining task independence? Dependency analysis based on file paths? Or explicit task dependencies?

3. **Caching Strategy:** Should git operation cache be per-agent-session or global? Per-session is safer but less performant.

4. **Approval UI:** For plan approval, should we use CLI prompts, a separate approval file, or a web interface? CLI prompts are simplest but block automation.

---

## Next Steps

1. **This Week:** Fix type safety issues (Priority 1)
2. **Next Week:** Improve error handling (Priority 2)
3. **Following Week:** Complete remaining TODOs (Priority 3)
4. **Ongoing:** Performance optimization and documentation (Priority 4-6)

**Review Date:** 2026-01-10 (after Phase 1 completion)
