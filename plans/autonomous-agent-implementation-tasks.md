# Autonomous Agent Implementation Tasks

## Quick Reference

This document breaks down the missing features into actionable implementation tasks.

## Priority Matrix

### 🔴 Critical (Blocking)

#### 1. File Access Control System
**File**: `packages/core/src/tools/access-control.ts`

```typescript
// Add to tool system
interface ToolPermissions {
  allow?: string[]  // glob patterns
  deny?: string[]   // glob patterns
}

// Usage in tool execution
function checkToolAccess(
  toolName: string,
  filePath: string,
  permissions: ToolPermissions
): boolean {
  if (permissions.deny?.some(pattern => minimatch(filePath, pattern))) {
    return false
  }
  if (permissions.allow?.length && !permissions.allow.some(pattern => minimatch(filePath, pattern))) {
    return false
  }
  return true
}
```

**Tasks**:
- [ ] Create `ToolPermissions` type
- [ ] Implement `checkToolAccess()` function
- [ ] Add permission config parsing
- [ ] Integrate into tool execution layer
- [ ] Add tests for allow/deny patterns
- [ ] Update documentation

**Estimated**: 2-3 days

---

#### 2. Plan State Management
**File**: `packages/core/src/workflow/plan-state.ts`

```typescript
interface PlanMetadata {
  id: string
  title: string
  status: 'draft' | 'active' | 'in-review' | 'completed' | 'archived'
  createdAt: Date
  updatedAt: Date
  assignedTo?: string
  priority: 'high' | 'medium' | 'low'
  tasks: PlanTask[]
}

interface PlanTask {
  id: string
  title: string
  status: 'pending' | 'in-progress' | 'completed' | 'blocked'
  assignedTo?: string
  dependencies?: string[]  // task IDs
}
```

**Tasks**:
- [ ] Define metadata schema
- [ ] Create `PlanMetadataManager` class
- [ ] Implement state transition logic
- [ ] Add metadata file (.plan.json) auto-generation
- [ ] Create state change workflow
- [ ] Add validation for state transitions
- [ ] Write tests

**Estimated**: 2-3 days

---

#### 3. Task Extraction and Tracking
**File**: `packages/cli/src/plan/task-parser.ts`

```typescript
interface ParsedTask {
  line: number
  title: string
  status: 'todo' | 'in-progress' | 'done'
  subtasks: ParsedTask[]
}

function parsePlanTasks(markdown: string): ParsedTask[] {
  // Parse markdown checkboxes
  // Extract task hierarchy
  // Return structured tasks
}

function updatePlanTask(
  planPath: string,
  taskId: string,
  status: ParsedTask['status']
): void {
  // Update markdown file
  // Preserve formatting
  // Write back to file
}
```

**Tasks**:
- [ ] Implement markdown checkbox parser
- [ ] Create task hierarchy extractor
- [ ] Build task status updater
- [ ] Add task ID generation
- [ ] Preserve formatting on update
- [ ] Add tests for edge cases
- [ ] Create CLI command: `bun run cli task-status`

**Estimated**: 2 days

---

#### 4. Agent Coordination Protocol
**File**: `packages/core/src/workflow/agent-coordination.ts`

```typescript
interface AgentHandoff {
  from: string
  to: string
  task: string
  context: Record<string, unknown>
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
  timestamp: Date
}

class AgentCoordination {
  async delegateToAgent(handoff: AgentHandoff): Promise<void>
  async acceptTask(taskId: string): Promise<void>
  async reportCompletion(taskId: string, result: unknown): Promise<void>
  async queryAgentStatus(agentId: string): Promise<AgentStatus>
}
```

**Tasks**:
- [ ] Define handoff protocol schema
- [ ] Implement coordination queue
- [ ] Add agent status tracking
- [ ] Create handoff workflow step
- [ ] Add timeout and retry logic
- [ ] Implement status query endpoint
- [ ] Write integration tests

**Estimated**: 3-4 days

---

### 🟡 Important (Enabling)

#### 5. Work Queue Management
**File**: `packages/cli/src/queue/work-queue.ts`

```typescript
interface QueuedTask {
  id: string
  planId: string
  task: ParsedTask
  assignedTo: string
  status: 'queued' | 'claimed' | 'completed' | 'failed'
  claimedAt?: Date
  completedAt?: Date
  retryCount: number
}

class WorkQueue {
  async enqueue(task: QueuedTask): Promise<void>
  async claim(agentId: string): Promise<QueuedTask | null>
  async complete(taskId: string, result: unknown): Promise<void>
  async fail(taskId: string, error: Error): Promise<void>
  async getStatus(): Promise<QueueStatus>
}
```

**Tasks**:
- [ ] Design queue data structure
- [ ] Implement file-based or Redis queue
- [ ] Add task claim with locking
- [ ] Build retry mechanism
- [ ] Create queue status query
- [ ] Add queue CLI commands
- [ ] Write tests for concurrency

**Estimated**: 3 days

---

#### 6. Automated Review Workflow
**File**: `packages/cli/src/workflows/review-cycle.workflow.ts`

```typescript
// New workflow: review-cycle.workflow.ts
export const reviewCycleWorkflow = {
  task: 'Review implementation and approve or request changes',
  steps: [
    {
      id: 'read-plan',
      task: 'Read the plan file to understand requirements',
    },
    {
      id: 'run-tests',
      tools: ['executeCommand'],
      task: 'Run test suite and capture results',
    },
    {
      id: 'review-implementation',
      task: 'Review implementation against plan requirements',
    },
    {
      id: 'make-decision',
      task: 'Decide: approve if requirements met, otherwise create rework plan',
    },
  ],
}
```

**Tasks**:
- [ ] Design review workflow
- [ ] Create verification checklist
- [ ] Implement approve/reject logic
- [ ] Add rework plan generation
- [ ] Integrate with plan state transitions
- [ ] Create review report
- [ ] Write tests

**Estimated**: 2 days

---

#### 7. Progress Tracking Dashboard
**File**: `packages/cli/src/commands/agent-status.ts`

```typescript
export const agentStatusCommand = new Command('agent-status')
  .description('Show autonomous agent status')
  .option('--watch', 'Watch for changes')
  .action(async (options) => {
    // Gather metrics
    const status = {
      activePlans: await getActivePlans(),
      completedPlans: await getCompletedPlans(),
      pendingTasks: await getPendingTasks(),
      workerActivity: await getWorkerActivity(),
      recentCommits: await getRecentCommits(),
    }

    // Display as table or chart
    console.table(status)
  })
```

**Tasks**:
- [ ] Design status data model
- [ ] Implement metrics collection
- [ ] Create CLI display
- [ ] Add watch mode
- [ ] Build JSON export for dashboards
- [ ] Add filtering and sorting
- [ ] Write tests

**Estimated**: 2 days

---

#### 8. Rollback and Recovery
**File**: `packages/cli/src/commands/agent-rollback.ts`

```typescript
export const agentRollbackCommand = new Command('agent-rollback')
  .argument('[commit]', 'Git commit or checkpoint to rollback to')
  .option('--create-checkpoint', 'Create checkpoint before rollback')
  .action(async (commit, options) => {
    if (options.createCheckpoint) {
      await createCheckpoint()
    }

    // Rollback using git
    await executeGitReset(commit)

    // Update plan states
    await resetPlanStates(commit)
  })
```

**Tasks**:
- [ ] Implement checkpoint creation (git tag/branch)
- [ ] Add git reset wrapper
- [ ] Build plan state reset logic
- [ ] Create recovery workflow
- [ ] Add safety checks and confirmations
- [ ] Write tests with git fixtures

**Estimated**: 2 days

---

### 🟢 Nice to Have (Optimization)

#### 9. Agent Specialization Profiles
**File**: `packages/cli/config/agent-profiles.yml`

```yaml
profiles:
  frontend-worker:
    name: "Frontend Specialist"
    focus:
      - "UI components"
      - "Styling and layout"
      - "User experience"
      - "Accessibility"
    tools:
      - "readFile"
      - "writeToFile"
      - "executeCommand"  # for npm/yarn
    rules:
      - "Follow React best practices"
      - "Use TypeScript strict mode"
      - "Test with Storybook"
      - "Ensure WCAG AA compliance"

  backend-worker:
    name: "Backend Specialist"
    focus:
      - "API endpoints"
      - "Database operations"
      - "Business logic"
      - "Authentication"
    tools:
      - "readFile"
      - "writeToFile"
      - "executeCommand"  # for server commands
    rules:
      - "Follow RESTful principles"
      - "Validate all inputs"
      - "Write integration tests"
      - "Document API endpoints"
```

**Tasks**:
- [ ] Design profile schema
- [ ] Create default profiles
- [ ] Implement profile loader
- [ ] Add profile validation
- [ ] Create profile CLI command
- [ ] Document profile customization

**Estimated**: 1-2 days

---

#### 10. Learning from Past Plans
**File**: `packages/cli/src/analytics/plan-analytics.ts`

```typescript
interface PlanAnalytics {
  totalPlans: number
  successRate: number
  averageCompletionTime: number
  commonPatterns: string[]
  failureModes: Array<{
    pattern: string
    frequency: number
    example: string
  }>
}

async function analyzePlans(): Promise<PlanAnalytics> {
  // Scan completed plans
  // Extract patterns
  // Calculate metrics
  // Identify success/failure modes
}
```

**Tasks**:
- [ ] Design analytics data model
- [ ] Implement plan parser for analytics
- [ ] Create pattern extraction
- [ ] Build success metrics calculator
- [ ] Add trend analysis
- [ ] Create insights report
- [ ] Add recommendations engine

**Estimated**: 3-4 days

---

#### 11. Dependency Detection
**File**: `packages/cli/src/analysis/dependency-graph.ts`

```typescript
interface TaskDependency {
  taskId: string
  dependsOn: string[]
  blocks: string[]
  circular: boolean
}

async function buildDependencyGraph(plan: PlanFile): Promise<TaskDependency[]> {
  // Parse task dependencies
  // Build graph structure
  // Detect circular dependencies
  // Return topological sort
}

async function getBlockingTasks(taskId: string): Promise<string[]> {
  // Return tasks that must complete before this one
}

async function getBlockedTasks(taskId: string): Promise<string[]> {
  // Return tasks waiting on this one
}
```

**Tasks**:
- [ ] Design dependency format
- [ ] Implement dependency parser
- [ ] Build graph algorithms
- [ ] Add circular dependency detection
- [ ] Create topological sort
- [ ] Integrate with task queue
- [ ] Visualize dependency graph

**Estimated**: 3 days

---

#### 12. Collaborative Planning
**File**: `packages/cli/src/coordination/planner-coordinator.ts`

```typescript
class PlannerCoordinator {
  private architects: string[]  // specialized planner IDs

  async coordinatePlanning(goal: string): Promise<CoordinatedPlan> {
    // 1. Architect planner creates high-level design
    // 2. Security planner reviews security implications
    // 3. Performance planner estimates performance impact
    // 4. Coordinator synthesizes into final plan
  }

  async resolveConflict(issue: Conflict): Promise<Resolution> {
    // Handle disagreements between planners
  }
}
```

**Tasks**:
- [ ] Design multi-planner architecture
- [ ] Implement planner communication
- [ ] Create coordination logic
- [ ] Add conflict resolution
- [ ] Synthesize multiple plans
    - [ ] Design profile schema
- [ ] Implement profile loader
- [ ] Create default profiles
- [ ] Add profile validation

**Estimated**: 4-5 days

---

## Implementation Order

### Sprint 1 (Week 1-2): Foundation
1. File Access Control (Critical #1)
2. Plan State Management (Critical #2)
3. Task Extraction (Critical #3)

**Goal**: Basic planner/worker isolation and task tracking

### Sprint 2 (Week 3): Coordination
4. Agent Coordination Protocol (Critical #4)
5. Work Queue Management (Important #5)

**Goal**: Agents can hand off tasks and work in parallel

### Sprint 3 (Week 4): Automation
6. Automated Review Workflow (Important #6)
7. Progress Tracking (Important #7)

**Goal**: Full autonomous cycle with visibility

### Sprint 4 (Week 5): Safety
8. Rollback and Recovery (Important #8)

**Goal**: Safe operation with undo capability

### Sprint 5+ (Ongoing): Enhancement
9. Agent Profiles (Nice to Have #9)
10. Learning Analytics (Nice to Have #10)
11. Dependency Detection (Nice to Have #11)
12. Collaborative Planning (Nice to Have #12)

**Goal**: Advanced features and optimization

---

## Total Estimated Effort

- **Critical**: 10-12 days
- **Important**: 11-13 days
- **Nice to Have**: 13-16 days
- **Total**: 34-41 days (~6-8 weeks)

---

## Quick Start MVP

For minimum viable autonomous agents:

```
Week 1: File Access + Plan State + Task Extraction
Week 2: Agent Coordination + Basic Automation Script
Week 3: Testing and Refinement
```

This gives you working autonomous agents in 3 weeks!
