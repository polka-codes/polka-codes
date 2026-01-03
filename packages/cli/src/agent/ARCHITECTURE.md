# Autonomous Agent Architecture

**Last Updated:** 2026-01-03
**Status:** Production Ready ✅

---

## Overview

The autonomous agent system is a goal-directed AI agent that can decompose high-level goals into executable tasks, plan their execution, and carry them out safely with proper approval workflows.

**Key Features:**
- Goal decomposition into tasks
- Automatic task discovery (build errors, test failures, linting, type errors)
- Safety checks and approval workflows
- Resource monitoring and session management
- Proper task cancellation with AbortController
- Continuous improvement mode

---

## Core Components

### 1. Orchestrator (`orchestrator.ts`)

**Purpose:** Central coordinator for all agent operations

**Responsibilities:**
- Accept high-level goals from users
- Coordinate goal decomposition, planning, and execution
- Manage agent lifecycle (initialize → plan → execute → cleanup)
- Handle state transitions and error recovery

**Key Methods:**
```typescript
class AutonomousAgent {
  initialize(): Promise<void>           // Acquire session, start monitors
  setGoal(goal: string): Promise<void>   // Set goal for goal-directed mode
  run(): Promise<void>                   // Execute in goal-directed mode
  runContinuous(): Promise<void>         // Execute in continuous improvement mode
  stop(): Promise<void>                  // Stop agent gracefully
  cleanup(): Promise<void>               // Release resources
}
```

**State Machine:**
```
idle → planning → executing → reviewing → committing → idle
                                ↓
                         error-recovery
```

---

### 2. Goal Decomposer (`goal-decomposer.ts`)

**Purpose:** Break down high-level goals into executable tasks

**Responsibilities:**
- Analyze user goals
- Discover codebase context (files, packages, dependencies)
- Generate task lists with proper dependencies
- Estimate task complexity and time

**Process:**
1. Gather codebase context (git, package.json, file structure)
2. Analyze goal and identify required changes
3. Generate high-level plan
4. Decompose into specific tasks with dependencies

**Output:**
```typescript
{
  highLevelPlan: string  // Human-readable plan description
  tasks: Task[]          // Executable task list
}
```

---

### 3. Task Planner (`planner.ts`)

**Purpose:** Create execution plans from task lists

**Responsibilities:**
- Organize tasks into execution phases
- Identify task dependencies
- Estimate total execution time
- Identify potential risks

**Execution Strategy:**
- Tasks grouped into phases based on dependencies
- Tasks within a phase can execute in parallel (future)
- Each phase must complete before next phase starts
- Fail-fast: stop on first task failure

**Output:**
```typescript
{
  goal: string
  highLevelPlan: string
  tasks: Task[]
  executionOrder: string[][]  // Phases of task IDs
  estimatedTime: number        // Minutes
  risks: string[]
}
```

---

### 4. Task Executor (`executor.ts`)

**Purpose:** Execute individual tasks with timeout and cancellation

**Responsibilities:**
- Invoke workflows for specific tasks
- Enforce per-task timeouts
- Support task cancellation via AbortController
- Handle task failures gracefully

**Features:**
- ✅ **AbortController Support:** Properly cancels workflows on timeout
- ✅ **Timeout Protection:** Configurable per-task time limits
- ✅ **Cancellation:** Manual task/plan cancellation
- ✅ **Resource Tracking:** Track running tasks

**Key Methods:**
```typescript
class TaskExecutor {
  execute(task, state): Promise<WorkflowExecutionResult>
  cancel(taskId): boolean
  cancelAll(): void
  isRunning(taskId): boolean
  getRunningCount(): number
}
```

---

### 5. Workflow Adapter (`workflow-adapter.ts`)

**Purpose:** Bridge between agent tasks and CLI workflows

**Responsibilities:**
- Invoke appropriate workflows based on task type
- Normalize workflow results to `WorkflowExecutionResult`
- Propagate AbortSignal for cancellation
- Handle workflow-specific errors

**Supported Workflows:**
- `code` - Code generation and modification
- `fix` - Bug fixing
- `plan` - Planning and design
- `review` - Code review
- `commit` - Git commits
- `epic` - Large-scale changes

**Cancellation Support:**
```typescript
// Wrapped context includes checkAbort function
const wrappedContext = {
  ...context,
  checkAbort: () => {
    if (signal.aborted) {
      throw new WorkflowInvocationError('Cancelled')
    }
  }
}
```

---

### 6. Approval Manager (`safety/approval.ts`)

**Purpose:** Manage approval workflows for tasks and plans

**Responsibilities:**
- Determine if task requires approval based on configuration
- Display task/plan details to user
- Collect user approval decisions
- Handle TTY detection (non-interactive environments)

**Approval Levels:**
- `none` - Auto-approve everything
- `destructive` - Require approval for destructive operations
- `commits` - Require approval for commits and destructive ops
- `all` - Require approval for everything

**Plan Approval Flow:**
```
1. Display plan details (goal, tasks, phases, time, risks)
2. Prompt user: "Do you want to proceed? (yes/no)"
3. Approved → Execute plan
4. Rejected → Stop and return to idle
```

---

### 7. Safety Checker (`safety/checks.ts`)

**Purpose:** Validate task safety before execution

**Checks:**
- Uncommitted changes before commit tasks
- Working branch (warn if committing to main/master)
- Modified test files
- Large file changes (>10MB)
- Destructive operations (delete, force push, etc.)

**Output:**
```typescript
{
  name: string
  passed: boolean
  message: string
  action: 'block' | 'warn' | 'ignore'
  error?: string
}
```

---

### 8. State Manager (`state-manager.ts`)

**Purpose:** Manage persistent agent state

**Features:**
- Immutable state updates (critical for consistency)
- Automatic checkpointing
- Corruption detection
- Task queue management (queue → completed/failed)

**State Structure:**
```typescript
{
  sessionId: string
  currentMode: AgentMode
  currentGoal?: string
  config: AgentConfig
  taskQueue: Task[]
  completedTasks: Task[]
  failedTasks: Task[]
  executionHistory: ExecutionRecord[]
  sessionMetadata: SessionMetadata
}
```

**Key Operations:**
- `updateState(updates)` - Immutable state update
- `moveTask(taskId, from, to)` - Move tasks between queues
- `checkpoint()` - Save state to disk
- `restore()` - Load state from disk

---

### 9. Resource Monitor (`resource-monitor.ts`)

**Purpose:** Monitor and enforce resource limits

**Monitors:**
- Memory usage (vs. `maxMemory`)
- Session time (vs. `maxSessionTime`)
- Task execution time (vs. `maxTaskExecutionTime`)

**Enforcement:**
- Callback on limit exceeded
- Can trigger graceful shutdown
- Logs warnings before hard limits

**Usage:**
```typescript
monitor.on('limitExceeded', (event) => {
  if (event.limit === 'memory') {
    // Trigger garbage collection
  }
  if (event.limit === 'sessionTime') {
    // Graceful shutdown
    await agent.stop()
  }
})
```

---

### 10. Session Manager (`session.ts`)

**Purpose:** Prevent concurrent agent sessions

**Features:**
- Lock file management in `/tmp`
- Session metadata (PID, hostname, username)
- Automatic stale session cleanup (>1 hour)
- Conflict detection and resolution

**Lock File:**
```
/tmp/polka-agent-{sessionId}.lock
```

**Methods:**
```typescript
await SessionManager.acquire(sessionId)
await SessionManager.release(sessionId)
```

---

### 11. Task Discovery (`task-discovery.ts`)

**Purpose:** Automatically discover tasks needing attention

**Discovery Strategies:**
- Build errors
- Test failures
- Type errors
- Lint issues
- Custom advanced strategies

**Caching:**
- Git HEAD-based invalidation
- 1-hour cache TTL
- Reduces redundant discovery runs

**Process:**
1. Check git status for changes
2. Run build/test/typecheck/lint
3. Parse failures
4. Create tasks for each issue
5. Prioritize by severity

---

### 12. Task History (`task-history.ts`)

**Purpose:** Track task execution for learning

**Tracks:**
- Task completion history
- Task failures
- Execution times (actual vs. estimated)
- Task types and patterns

**Reports:**
- Recent failures
- Slow tasks
- Estimation accuracy
- Success rates by task type

---

## Data Flow

### Goal-Directed Mode

```
User Goal
    ↓
Orchestrator.setGoal()
    ↓
GoalDecomposer.decompose()
    → Analyze codebase
    → Generate tasks
    ↓
TaskPlanner.createPlan()
    → Group into phases
    → Estimate time
    → Identify risks
    ↓
ApprovalManager.requestPlanApproval()
    → Display plan
    → Get user approval
    ↓
Executor.executePlan()
    → For each phase:
      → For each task:
        → SafetyChecker.checkTask()
        → ApprovalManager.requestApproval()
        → WorkflowAdapter.invokeWorkflow()
    ↓
TaskHistory.record()
    ↓
State cleanup
```

### Continuous Improvement Mode

```
TaskDiscovery.discover()
    → Check git status
    → Run build/test/lint
    → Create tasks
    ↓
TaskPlanner.createPlan()
    ↓
Executor.executePlan()
    ↓
Wait (configurable sleep time)
    ↓
Repeat
```

---

## Type System

### Core Types

**AgentMode:**
```typescript
type AgentMode =
  | 'idle'              // Ready to accept goals
  | 'planning'          // Decomposing goal
  | 'executing'         // Running tasks
  | 'reviewing'         // Reviewing results
  | 'committing'        // Committing changes
  | 'error-recovery'    // Recovering from errors
  | 'stopped'           // Gracefully stopped
```

**TaskType:**
```typescript
type TaskType =
  | 'feature'           // New feature
  | 'bugfix'            // Bug fix
  | 'refactor'          // Code refactoring
  | 'test'              // Test-related
  | 'docs'              // Documentation
  | 'commit'            // Git commit
```

**Priority:**
```typescript
enum Priority {
  CRITICAL = 1000,      // Build failures, security issues
  HIGH = 800,           // Test failures, type errors
  MEDIUM = 600,         // Refactoring, documentation
  LOW = 400,            // Nice-to-have features
  TRIVIAL = 200,        // Style fixes
}
```

### Workflow Integration

**Task → Workflow Mapping:**
```typescript
const WORKFLOW_MAPPING = {
  feature: 'code',
  bugfix: 'fix',
  refactor: 'code',
  test: 'fix',
  docs: 'code',
  commit: 'commit',
}
```

---

## Error Handling

### Error Types

**Base Error:**
```typescript
class AgentError extends Error {
  name: string
  code: string
}
```

**Specific Errors:**
- `StateTransitionError` - Invalid state transition
- `TaskExecutionError` - Task execution failed
- `WorkflowInvocationError` - Workflow failed
- `StateCorruptionError` - State file corrupted
- `ResourceLimitError` - Resource limit exceeded
- `ConfigValidationError` - Invalid configuration
- `SessionConflictError` - Session already active

### Error Handling Pattern

**Using `logAndSuppress`:**
```typescript
try {
  await riskyOperation()
} catch (error) {
  logAndSuppress(logger, error, 'ContextName', {
    level: 'debug',
    context: { additionalInfo }
  })
  // Continue with default value
}
```

---

## Safety Features

### 1. Approval Workflow

**Task Approval:**
- Checks TTY availability
- Displays task details (type, priority, complexity, time)
- Prompts for user confirmation
- Auto-rejects in non-interactive environments

**Plan Approval:**
- Shows full plan with all tasks
- Displays phases, time estimates, risks
- Interactive yes/no prompt
- Required before execution

### 2. Safety Checks

**Pre-Execution Validation:**
- Uncommitted changes detection
- Working branch warnings
- Large file detection
- Destructive operation checks

**Actions:**
- `block` - Prevent task execution
- `warn` - Show warning but continue
- `ignore` - No action needed

### 3. Resource Limits

**Configurable Limits:**
- `maxMemory` - Memory usage limit (MB)
- `maxSessionTime` - Session duration limit (minutes)
- `maxTaskExecutionTime` - Per-task timeout (minutes)

**Enforcement:**
- Monitoring at regular intervals
- Callbacks on limit exceeded
- Graceful shutdown on session timeout

---

## Testing

### Test Structure

**Test Files:**
- `executor.test.ts` - Task execution tests
- `goal-decomposer.test.ts` - Goal decomposition tests
- `planner.test.ts` - Planning tests
- `task-discovery.test.ts` - Task discovery tests
- `workflow-adapter.test.ts` - Workflow integration tests
- `improvement-loop.test.ts` - Continuous mode tests

**Test Fixtures:**
```typescript
import { createMockLogger, createMockContext, createMockConfig } from './test-fixtures'

const context = createMockContext()
const config = createMockConfig()
```

---

## Configuration

### Presets

**Conservative:**
- Maximum approvals
- Low resource limits
- All safety checks enabled

**Balanced (Default):**
- Destructive operations require approval
- Moderate resource limits
- Standard safety checks

**Aggressive:**
- Auto-approve safe tasks
- Higher resource limits
- Minimal approvals

**Continuous Improvement:**
- Auto-approve non-destructive tasks
- Long session times
- Automatic task discovery

### Example Configuration

```typescript
{
  approval: {
    level: 'destructive',
    autoApproveSafeTasks: true,
    maxAutoApprovalCost: 5,
  },
  resourceLimits: {
    maxMemory: 1024,
    maxSessionTime: 60,
    maxTaskExecutionTime: 30,
  },
  destructiveOperations: {
    allowBranchDeletion: false,
    allowForcePush: false,
    allowStagingReset: false,
  },
  discovery: {
    strategy: 'default',
    maxTasksPerIteration: 10,
  },
}
```

---

## Future Enhancements

### Planned Features

**Performance:**
- [ ] Git operation caching
- [ ] Parallel task execution
- [ ] Lazy loading for heavy components

**Developer Experience:**
- [ ] Progress indicators
- [ ] Better error messages
- [ ] Debug logging modes

**Monitoring:**
- [ ] Metrics dashboard
- [ ] Performance tracking
- [ ] Error analytics

**Documentation:**
- [ ] API documentation (JSDoc)
- [ ] Usage examples
- [ ] Architecture diagrams

---

## Best Practices

### For Users

1. **Start with `--dry-run`** to see what the agent plans to do
2. **Review plans carefully** before approving
3. **Use appropriate approval levels** for your environment
4. **Monitor resource usage** in long-running sessions
5. **Keep commits small** for better task decomposition

### For Developers

1. **Use immutable state updates** via StateManager
2. **Check abort signals** in long-running operations
3. **Log appropriately** (info for progress, debug for details)
4. **Handle errors gracefully** with proper error types
5. **Write tests** for new components

---

## Related Files

- **Implementation Plan:** `plans/autonomous-agent-implementation.md`
- **API Design:** `plans/autonomous-agent-api-design-v2.1.md`
- **Improvement Roadmap:** `plans/codebase-improvement-roadmap.md`
- **Current Status:** `plans/current-status-and-next-steps.md`
