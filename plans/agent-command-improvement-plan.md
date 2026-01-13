# Agent Command Improvement Plan

## Executive Summary

The current `agent` command has foundational autonomous agent infrastructure but needs significant enhancements to match the autonomous coding agent vision (Planner/Worker architecture).

**Current State**: Experimental single-agent system with goal-directed and continuous improvement modes
**Target State**: Dual-agent system (Planner + Worker) with plan-based coordination

---

## Current Implementation Analysis

### ✅ What Works Well

1. **Session Management**: Proper session acquisition/conflict detection
2. **State Management`: AgentStateManager tracks state persistently
3. **Safety Systems**: ApprovalManager, SafetyChecker, InterruptHandler in place
4. **Two Modes**: Goal-directed and continuous improvement
5. **Working Space**: `WorkingSpace` class for plan directory management
6. **Configuration**: Zod-based config validation with presets
7. **Metrics Collection**: MetricsCollector for tracking
8. **Task History**: TaskHistory for completed work tracking

### ❌ Critical Gaps

1. **Single Agent Architecture**: No Planner/Worker separation
2. **Limited Tools**: Only `executeCommand` and `readFile` available
3. **No Plan File System**: No markdown plan creation/updates
4. **No Task Status Updates**: Can't mark tasks as in-progress/completed/blocked
5. **No Issue Discovery**: No mechanism for workers to add discovered tasks
6. **No Agent Coordination**: No handoff protocol between agents
7. **No Work Queue**: Can't parallelize workers
8. **No Review Workflow**: Planner can't review/approve worker work
9. **No Progress Dashboard**: No visibility into agent operations

---

## Improvement Plan

### Phase 1: Dual-Agent Architecture (Week 1-2)

#### 1.1 Create Planner Agent

**File**: `packages/cli/src/agent/planner-agent.ts`

```typescript
export class PlannerAgent extends AutonomousAgent {
  // Planner-specific capabilities
  async createPlan(goal: string): Promise<PlanFile>
  async reviewPlan(planPath: string): Promise<ReviewResult>
  async updatePlan(planPath: string, updates: PlanUpdates): Promise<void>
  async approvePlan(planPath: string): Promise<void>
  async requestRework(planPath: string, feedback: string): Promise<void>
  async discoverTasks(): Promise<DiscoveredTask[]>

  // Planner tool permissions
  protected getWriteAccess(): string[] {
    return ['plans/**/*']
  }

  protected getRules(): string[] {
    return [
      "Always read existing plans before creating new ones",
      "Break down tasks that take more than 2 hours into smaller tasks",
      "Always identify relevant files for each task",
      "Include implementation details and best practices in plans",
      "Review completed work and verify against plan requirements",
    ]
  }
}
```

**Tasks**:
- [ ] Extend `AutonomousAgent` with `PlannerAgent` subclass
- [ ] Implement `createPlan()` with markdown template
- [ ] Implement `reviewPlan()` to verify requirements
- [ ] Add plan state transitions (draft → active → review → completed)
- [ ] Implement task discovery from codebase analysis
- [ ] Add planner-specific rules and permissions
- [ ] Create planner configuration schema
- [ ] Write tests for planner agent

**Estimated**: 5-7 days

---

#### 1.2 Create Worker Agent

**File**: `packages/cli/src/agent/worker-agent.ts`

```typescript
export class WorkerAgent extends AutonomousAgent {
  // Worker-specific capabilities
  async executeTask(planPath: string, taskId: string): Promise<void>
  async updateTaskStatus(planPath: string, taskId: string, status: TaskStatus): Promise<void>
  async addDiscoveredIssue(planPath: string, issue: DiscoveredIssue): Promise<void>
  async reportBlocker(planPath: string, taskId: string, blocker: Blocker): Promise<void>
  async runTests(): Promise<TestResult>

  // Worker tool permissions
  protected getWriteAccess(): string[] {
    return ['**/*', 'plans/**/*']  // Code + plan status updates
  }

  protected getRules(): string[] {
    return [
      "Read the plan file thoroughly before starting work",
      "Follow the implementation steps in order",
      "Write tests for all new code",
      "Run tests before marking task as complete",
      "Update task status in plan file as you progress",
      "Add newly discovered tasks to the plan with clear descriptions",
      "Report blockers immediately by marking tasks as blocked",
    ]
  }
}
```

**Tasks**:
- [ ] Extend `AutonomousAgent` with `WorkerAgent` subclass
- [ ] Implement `executeTask()` following plan steps
- [ ] Implement `updateTaskStatus()` with markdown parsing
- [ ] Implement `addDiscoveredIssue()` to append to plan
- [ ] Implement `reportBlocker()` with immediate notification
- [ ] Add test execution before task completion
- [ ] Create worker configuration schema
- [ ] Write tests for worker agent

**Estimated**: 5-7 days

---

### Phase 2: Plan File System (Week 2-3)

#### 2.1 Plan File Parser & Updater

**File**: `packages/cli/src/plan/plan-parser.ts`

```typescript
export interface ParsedPlan {
  metadata: PlanMetadata
  tasks: ParsedTask[]
  discoveredIssues: DiscoveredIssue[]
  definitionOfDone: DefinitionOfDone
}

export interface ParsedTask {
  id: string
  title: string
  subtasks: ParsedSubtask[]
  status: 'not-started' | 'in-progress' | 'completed' | 'blocked'
  files: string[]
  details: string
  blocker?: Blocker
  progressUpdates: ProgressUpdate[]
}

export class PlanParser {
  async parse(planPath: string): Promise<ParsedPlan>
  async updateTaskStatus(planPath: string, taskId: string, status: TaskStatus): Promise<void>
  async addDiscoveredIssue(planPath: string, issue: DiscoveredIssue): Promise<void>
  async addProgressUpdate(planPath: string, taskId: string, update: string): Promise<void>
  async movePlan(planPath: string, targetDir: 'active' | 'review' | 'completed' | 'archived'): Promise<void>
}
```

**Tasks**:
- [ ] Design plan file schema (based on template in docs)
- [ ] Implement markdown parser for plan structure
- [ ] Implement task status updater with formatting preservation
- [ ] Implement discovered issue appender
- [ ] Implement plan state transition logic
- [ ] Add plan move/copy between directories
- [ ] Write comprehensive tests
- [ ] Add error handling for malformed plans

**Estimated**: 3-4 days

---

#### 2.2 Plan Template System

**File**: `packages/cli/src/plan/plan-template.ts`

```typescript
export class PlanTemplate {
  async createFromGoal(goal: string, context: PlanningContext): Promise<string>
  async createForIssue(issue: DiscoveredIssue, context: PlanningContext): Promise<string>

  private generateTaskSection(tasks: Task[]): string
  private generateMetadata(metadata: PlanMetadata): string
  private generateDefinitionOfDone(requirements: string[]): string
}
```

**Tasks**:
- [ ] Create plan template generator
- [ ] Implement goal-to-plan decomposition
- [ ] Add automatic relevant file discovery
- [ ] Add best practice suggestions
- [ ] Generate testing requirements
- [ ] Create template variations (feature, bugfix, refactor)
- [ ] Write tests

**Estimated**: 2-3 days

---

### Phase 3: Agent Coordination (Week 3-4)

#### 3.1 Coordination Protocol

**File**: `packages/cli/src/agent/coordination/protocol.ts`

```typescript
export interface AgentHandoff {
  id: string
  from: 'planner' | 'worker'
  to: 'planner' | 'worker'
  planPath: string
  task?: string
  payload: HandoffPayload
  status: 'pending' | 'accepted' | 'rejected' | 'completed'
  timestamp: Date
}

export type HandoffPayload =
  | { type: 'new-task'; task: Task }
  | { type: 'task-complete'; taskId: string; result: TaskResult }
  | { type: 'task-blocked'; taskId: string; blocker: Blocker }
  | { type: 'issue-discovered'; issue: DiscoveredIssue }
  | { type: 'review-request'; planPath: string }

export class CoordinationProtocol {
  async delegateTask(workerId: string, task: Task): Promise<void>
  async reportCompletion(taskId: string, result: TaskResult): Promise<void>
  async reportBlocker(taskId: string, blocker: Blocker): Promise<void>
  async submitForReview(planPath: string): Promise<ReviewDecision>
  async queryStatus(agentId: string): Promise<AgentStatus>
}
```

**Tasks**:
- [ ] Define handoff protocol schema
- [ ] Implement handoff queue (file-based or in-memory)
- [ ] Add handoff acceptance/rejection logic
- [ ] Implement status query interface
- [ ] Add timeout and retry mechanism
- [ ] Create coordination event logging
- [ ] Write tests for concurrent handoffs

**Estimated**: 4-5 days

---

#### 3.2 Work Queue Manager

**File**: `packages/cli/src/agent/coordination/work-queue.ts`

```typescript
export interface QueuedTask {
  id: string
  planPath: string
  task: ParsedTask
  priority: number
  status: 'queued' | 'claimed' | 'completed' | 'failed'
  claimedBy?: string
  claimedAt?: Date
  retryCount: number
}

export class WorkQueue {
  async enqueue(task: QueuedTask): Promise<void>
  async claim(workerId: string, capabilities: string[]): Promise<QueuedTask | null>
  async complete(taskId: string, result: TaskResult): Promise<void>
  async fail(taskId: string, error: Error): Promise<void>
  async getQueueStats(): Promise<QueueStats>
  async getWorkerTasks(workerId: string): Promise<QueuedTask[]>
}
```

**Tasks**:
- [ ] Design queue data structure
- [ ] Implement file-based persistence
- [ ] Add task claiming with locking
- [ ] Implement priority-based task selection
- [ ] Add retry mechanism with exponential backoff
- [ ] Create queue status query
- [ ] Write tests for concurrent access

**Estimated**: 3-4 days

---

### Phase 4: Enhanced Tool Support (Week 4-5)

#### 4.1 Full Tool Integration

**File**: Update `packages/cli/src/commands/agent.ts`

**Current Issue**: Lines 62-78 show critical limitation - agent only has `executeCommand` and `readFile`

```typescript
// CURRENT (lines 62-78):
// CRITICAL LIMITATION: The agent currently only provides executeCommand and readFile.
// When the agent invokes workflows (code, fix, plan, etc.) via WorkflowAdapter, those
// workflows expect a full tool context (writeToFile, listFiles, searchFiles, etc.).

// SOLUTION: Implement full tool support like runWorkflow does
```

**Tasks**:
- [ ] Study `runWorkflow.ts` to understand full tool initialization
- [ ] Extract provider initialization logic
- [ ] Create `createAgentTools()` function
- [ ] Initialize all tools from `CliToolRegistry`
  - writeToFile
  - listFiles
  - searchFiles
  - git operations
  - memory management
  - todo management
- [ ] Remove tool guard proxy (lines 151-162)
- [ ] Update tool documentation
- [ ] Test all tools work in agent context

**Estimated**: 3-4 days

---

#### 4.2 Workflow Integration

**File**: `packages/cli/src/agent/workflow-adapter.ts`

```typescript
export class WorkflowAdapter {
  // Map agent requests to workflow executions
  async executeCodeWorkflow(task: string, context: AgentContext): Promise<void>
  async executeFixWorkflow(command: string, context: AgentContext): Promise<void>
  async executePlanWorkflow(goal: string, context: AgentContext): Promise<void>
  async executeTestWorkflow(context: AgentContext): Promise<TestResult>

  // Handle workflow results and update plans
  private async handleWorkflowResult(result: any, planPath: string): Promise<void>
}
```

**Tasks**:
- [ ] Create workflow adapter class
- [ ] Implement workflow-to-agent mapping
- [ ] Add result parsing and plan updates
- [ ] Handle workflow errors and retries
- [ ] Integrate with task status updates
- [ ] Write tests

**Estimated**: 2-3 days

---

### Phase 5: Review & Approval Workflow (Week 5-6)

#### 5.1 Automated Review System

**File**: `packages/cli/src/agent/review/workflow.ts`

```typescript
export class ReviewWorkflow {
  async reviewPlan(planPath: string): Promise<ReviewResult>
  async verifyTests(planPath: string): Promise<TestVerification>
  async checkDefinitionOfDone(planPath: string): Promise<DoDCheck>

  private async extractCompletedTasks(plan: ParsedPlan): Promise<Task[]>
  private async compareWithRequirements(plan: ParsedPlan): Promise<ComplianceReport>
}
```

**Tasks**:
- [ ] Design review workflow process
- [ ] Implement automated test verification
- [ ] Add definition-of-done checklist
- [ ] Create compliance checker
- [ ] Generate review report
- [ ] Implement approve/reject logic
- [ ] Write tests

**Estimated**: 3-4 days

---

#### 5.2 Rework Loop

**File**: `packages/cli/src/agent/review/rework.ts`

```typescript
export class ReworkHandler {
  async createReworkPlan(reviewResult: ReviewResult): Promise<ReworkPlan>
  async updatePlanWithFeedback(planPath: string, feedback: string[]): Promise<void>
  async prioritizeReworkTasks(plan: ParsedPlan, issues: string[]): Promise<void>
}
```

**Tasks**:
- [ ] Implement rework plan generator
- [ ] Add feedback integration to plan
- [ ] Create task prioritization logic
- [ ] Handle planner decision on rework
- [ ] Write tests

**Estimated**: 2-3 days

---

### Phase 6: Monitoring & Dashboard (Week 6-7)

#### 6.1 Metrics Collection

**File**: `packages/cli/src/agent/monitoring/metrics.ts`

```typescript
export interface AgentMetrics {
  activePlans: number
  completedPlans: number
  pendingTasks: number
  inProgressTasks: number
  blockedTasks: number
  discoveredIssues: number
  completionRate: number
  averageTaskTime: number
}

export class MetricsCollector {
  async collectMetrics(): Promise<AgentMetrics>
  async getPlanStatus(planPath: string): Promise<PlanStatus>
  async getWorkerActivity(workerId: string): Promise<WorkerActivity>
  async getRecentCommits(count: number): Promise<CommitInfo[]>
}
```

**Tasks**:
- [ ] Define metrics schema
- [ ] Implement plan directory scanner
- [ ] Add task status aggregation
- [ ] Create worker activity tracker
- [ ] Integrate git history for commits
- [ ] Write tests

**Estimated**: 2-3 days

---

#### 6.2 Status Dashboard

**File**: `packages/cli/src/commands/agent-status.ts`

```typescript
export const agentStatusCommand = new Command('agent-status')
  .description('Show autonomous agent status')
  .option('--watch', 'Watch for changes')
  .option('--json', 'Output as JSON')
  .action(async (options) => {
    const metrics = await collectMetrics()

    if (options.json) {
      console.log(JSON.stringify(metrics, null, 2))
    } else {
      displayDashboard(metrics)
    }

    if (options.watch) {
      watchMode()
    }
  })
```

**Tasks**:
- [ ] Create status command
- [ ] Implement terminal dashboard
- [ ] Add watch mode with refresh
- [ ] Create JSON export for external dashboards
- [ ] Add filtering options
- [ ] Write tests

**Estimated**: 2-3 days

---

#### 6.3 Logging System

**File**: `packages/cli/src/agent/monitoring/logger.ts`

```typescript
export class AgentLogger {
  async logHandoff(handoff: AgentHandoff): Promise<void>
  async logTaskCompletion(task: ParsedTask, result: TaskResult): Promise<void>
  async logBlocker(blocker: Blocker): Promise<void>
  async logDiscoveredIssue(issue: DiscoveredIssue): Promise<void>

  async getRecentActivity(minutes: number): Promise<ActivityLog[]>
  async getAgentTimeline(agentId: string): Promise<TimelineEntry[]>
}
```

**Tasks**:
- [ ] Extend existing `AgentLogger` with coordination events
- [ ] Add structured logging for all agent events
- [ ] Implement activity query interface
- [ ] Create timeline generator
- [ ] Add log rotation
- [ ] Write tests

**Estimated**: 2 days

---

### Phase 7: Configuration & CLI (Week 7)

#### 7.1 Simplified Configuration

**File**: Update `packages/cli/src/agent/config.ts`

**Current**: Complex JSON config with nested objects
**Target**: Simple YAML config (as shown in docs)

```yaml
# .planner.yml (5 lines!)
name: Planner
model: claude-sonnet-4-20250514
writeAccess:
  - plans/**

# .worker.yml (5 lines!)
name: Worker
model: claude-sonnet-4-20250514
writeAccess:
  - "**/*"
  - "plans/**/*"
```

**Tasks**:
- [ ] Add YAML config support
- [ ] Create simplified config parser
- [ ] Implement config validation
- [ ] Add default configs (.planner.yml, .worker.yml)
- [ ] Support preset configs
- [ ] Update documentation
- [ ] Write tests

**Estimated**: 2-3 days

---

#### 7.2 CLI Commands

**File**: `packages/cli/src/commands/agent.ts`

**Current**: Single `agent` command with goal/continuous modes
**Target**: Multiple commands for agent management

```bash
# Create plan (planner agent)
polka plan "Add user authentication"

# Run agents (coordinated)
polka agent run           # Run once
polka agent start         # Start continuous
polka agent stop          # Stop continuous

# Check status
polka agent status        # Show dashboard
polka agent logs          # Show agent logs
polka agent activity      # Recent activity

# Plan management
polka plan --review plans/active/*.md
polka plan --archive plan.md
```

**Tasks**:
- [ ] Split `agent` command into subcommands
- [ ] Create `plan` command (planner interface)
- [ ] Update `agent run` for coordinated execution
- [ ] Add `agent start/stop` for daemon mode
- [ ] Create `agent status` dashboard
- [ ] Add `agent logs` command
- [ ] Implement `agent activity` query
- [ ] Add plan management commands
- [ ] Update help text and examples
- [ ] Write tests

**Estimated**: 3-4 days

---

### Phase 8: Safety & Rollback (Week 8)

#### 8.1 Git Integration

**File**: `packages/cli/src/agent/safety/git-checkpoint.ts`

```typescript
export class GitCheckpointManager {
  async createCheckpoint(message: string): Promise<string>
  async rollbackToCheckpoint(checkpointId: string): Promise<void>
  async getCheckpointHistory(): Promise<Checkpoint[]>
  async autoCommitChanges(planPath: string): Promise<void>
}
```

**Tasks**:
- [ ] Implement checkpoint creation (git tag)
- [ ] Add rollback mechanism
- [ ] Create auto-commit on task completion
- [ ] Add checkpoint history query
- [ ] Integrate with agent lifecycle
- [ ] Write tests

**Estimated**: 2-3 days

---

#### 8.2 Error Recovery

**File**: `packages/cli/src/agent/safety/recovery.ts`

```typescript
export class ErrorRecovery {
  async handleAgentError(error: Error, context: AgentContext): Promise<RecoveryAction>
  async restartBlockedTask(planPath: string, taskId: string): Promise<void>
  async resetPlanState(planPath: string): Promise<void>
  async escalateToHuman(issue: EscalationIssue): Promise<void>
}
```

**Tasks**:
- [ ] Implement error classification
- [ ] Add retry strategies
- [ ] Create task reset mechanism
- [ ] Implement human escalation
- [ ] Add recovery logging
- [ ] Write tests

**Estimated**: 2-3 days

---

## Implementation Priority

### Critical Path (MVP - 3 weeks)

**Week 1**:
1. Planner Agent (1.1) - 5 days
2. Worker Agent (1.2) - 2 days

**Week 2**:
3. Plan File Parser (2.1) - 3 days
4. Plan Template System (2.2) - 2 days

**Week 3**:
5. Coordination Protocol (3.1) - 3 days
6. Full Tool Integration (4.1) - 2 days

**MVP Deliverable**:
- ✅ Planner creates plans in `plans/active/`
- ✅ Worker executes tasks from plans
- ✅ Worker updates task status
- ✅ Worker adds discovered issues
- ✅ Planner reviews completed work
- ✅ Basic agent coordination

---

### Important Features (Weeks 4-6)

**Week 4**:
7. Work Queue Manager (3.2) - 3 days
8. Workflow Integration (4.2) - 2 days
9. Simplified Config (7.1) - 2 days

**Week 5**:
10. Automated Review (5.1) - 3 days
11. Rework Loop (5.2) - 2 days

**Week 6**:
12. Metrics Collection (6.1) - 2 days
13. Status Dashboard (6.2) - 3 days

**Enhanced Deliverable**:
- ✅ Parallel worker support
- ✅ Automated review/approval
- ✅ Real-time status dashboard
- ✅ Simple YAML configuration

---

### Nice to Have (Weeks 7-8)

**Week 7**:
14. Git Checkpoints (8.1) - 2 days
15. Error Recovery (8.2) - 2 days
16. CLI Commands (7.2) - 3 days

**Week 8**:
17. Testing & Bug Fixes - 5 days

**Complete Deliverable**:
- ✅ All above features
- ✅ Git-based rollback
- ✅ Full CLI command suite
- ✅ Production-ready

---

## Success Criteria

### Functional Requirements
- [ ] Planner creates detailed markdown plans
- [ ] Worker executes tasks and updates status
- [ ] Worker discovers and reports issues
- [ ] Planner reviews and approves/rejects work
- [ ] Agents coordinate via handoff protocol
- [ ] Status dashboard shows real-time metrics
- [ ] Configuration simplified to YAML
- [ ] Git checkpoints for rollback

### Non-Functional Requirements
- [ ] All existing tests pass
- [ ] New features have 80%+ test coverage
- [ ] Documentation updated
- [ ] Performance: < 100ms for handoff
- [ ] Reliability: < 1% crash rate
- [ ] Security: File access controls enforced

---

## Risks & Mitigations

### Risk 1: Tool Integration Complexity
**Impact**: High - Blocks core functionality
**Mitigation**: Study existing `runWorkflow` implementation closely, create integration tests early

### Risk 2: Markdown Parsing Fragility
**Impact**: Medium - Could break plan updates
**Mitigation**: Use robust parser, preserve formatting, extensive tests

### Risk 3: Agent Coordination Deadlocks
**Impact**: High - Blocks parallel execution
**Mitigation**: Add timeouts, implement deadlock detection, extensive concurrent testing

### Risk 4: Performance at Scale
**Impact**: Medium - Slow response times
**Mitigation**: Profile early, optimize hot paths, add caching

---

## Testing Strategy

### Unit Tests
- Each agent class independently
- Plan parser with various markdown formats
- Coordination protocol
- Work queue operations

### Integration Tests
- Agent-to-agent handoffs
- Plan creation → execution → review cycle
- Worker discovering issues → planner updating
- Multiple workers with shared queue

### End-to-End Tests
- Full autonomous cycle (plan → execute → review → approve)
- Continuous operation mode
- Error recovery scenarios
- Git rollback scenarios

---

## Migration Path

### Phase 1: Add New Features Alongside Existing
- Keep current `agent` command working
- Add new `planner` and `worker` commands
- Users can opt-in to new system

### Phase 2: Soft Launch
- Document new system extensively
- Create migration guide
- Gather feedback from early adopters

### Phase 3: Deprecate Old System
- Mark old `agent` command as deprecated
- Add warnings when using old system
- Provide automated migration scripts

### Phase 4: Remove Old System
- Remove old agent code in major version bump
- Clean up deprecated code paths

---

## Documentation Requirements

1. **User Documentation**
   - Quick start guide (already exists in docs/)
   - Configuration reference
   - CLI command reference
   - Troubleshooting guide

2. **Developer Documentation**
   - Architecture overview
   - Agent class documentation
   - Coordination protocol spec
   - API reference

3. **Examples**
   - Simple feature development
   - Bug fix workflow
   - Continuous operation mode
   - Multiple workers

---

## Open Questions

1. **Persistence**: File-based vs database for work queue?
   - **Recommendation**: Start with file-based (JSON), migrate to DB if needed

2. **Concurrency**: How many parallel workers?
   - **Recommendation**: Start with 1, add config option later

3. **Plan Format**: Markdown vs structured format (JSON/YAML)?
   - **Recommendation**: Markdown (human-readable + parsable)

4. **Human Intervention**: When to require approval?
   - **Recommendation**: Configurable approval levels (already exists)

5. **Resource Limits**: Max budget, max time, max iterations?
   - **Recommendation**: Use existing config options

---

## Next Steps

1. **Review this plan** with team
2. **Prioritize phases** based on business needs
3. **Set up development environment**
4. **Create initial branch**: `feature/dual-agent-system`
5. **Start with Phase 1.1** (Planner Agent)
6. **Set up CI/CD** for automated testing
7. **Establish weekly syncs** to track progress

---

## References

- **Architecture**: `docs/autonomous-coding-agent.md`
- **Quick Start**: `docs/autonomous-agent-quick-start.md`
- **Implementation Tasks**: `docs/autonomous-agent-implementation-tasks.md`
- **Current Code**: `packages/cli/src/agent/`
- **Test Examples**: `packages/cli/src/agent/**/*.test.ts`

---

**Total Estimated Effort**: 6-8 weeks (40-55 days)
**MVP Timeline**: 3 weeks (15 working days)
**Team Size**: 1-2 developers

Ready to start implementation! 🚀
