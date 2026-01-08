# Workflow vs Agent Command - Feature Gap Analysis

## Current Coverage

### ✅ What Workflow Command CAN Cover (with --continuous)

| Feature | Workflow | Agent | Notes |
|---------|----------|-------|-------|
| **Basic Execution** |
| Run predefined steps | ✅ | ✅ | Both support step-by-step execution |
| Loop execution | ✅ | ✅ | Via `--continuous` flag |
| Conditional branching | ✅ | ✅ | Via `if/else` in YAML |
| While loops | ✅ | ✅ | Via `while` in YAML |
| Error handling | ✅ | ✅ | Via `try/catch` in YAML |
| **Configuration** |
| Declarative config | ✅ | ❌ | YAML is more maintainable |
| Programmatic config | ❌ | ✅ | TypeScript is more flexible |
| **State Management** |
| State persistence | ❌ | ✅ | Agent has `.polka/agent-state` |
| Session management | ❌ | ✅ | Agent tracks sessions/conflicts |
| Task history | ❌ | ✅ | Agent maintains history |
| **Task Management** |
| Manual task list | ✅ | ❌ | Define tasks in YAML |
| Auto task discovery | ❌ | ✅ | Agent discovers issues automatically |
| Task status tracking | ❌ | ✅ | Agent tracks in-progress/completed |
| **Planning** |
| Execute from plan | ❌ | ✅ | Agent reads `plans/active/*.md` |
| Update plan files | ❌ | ✅ | Agent writes plan status |
| Create plans | ✅ | ✅ | Both can create plans |
| **Safety** |
| Approval system | ❌ | ✅ | Agent has approval levels |
| Safety checks | ❌ | ✅ | Agent has safety violations |
| Resource limits | ❌ | ✅ | Agent has resource monitoring |
| **Tool Support** |
| Full tool ecosystem | ✅ | ⚠️ | Workflow has all tools via runWorkflow |
| Limited tools | ❌ | ✅ | Agent currently limited (known issue) |
| **Monitoring** |
| Metrics collection | ❌ | ✅ | Agent has metrics |
| Health monitoring | ❌ | ✅ | Agent has health checks |
| Progress tracking | ❌ | ✅ | Agent tracks progress |

## Critical Gaps

### 1. State Persistence

**Agent:**
```typescript
// Agent persists state to .polka/agent-state/
- Current task status
- Session information
- Task history
- Error recovery state
```

**Workflow:**
```yaml
# Workflow has NO persistent state
# Each iteration starts fresh
# Can't resume from failures
# Can't track long-running tasks
```

**Impact:** Cannot build workflows that:
- Resume after interruption
- Maintain context across days
- Track long-running tasks
- Recover from crashes

### 2. Task Discovery

**Agent:**
```typescript
// Agent autonomously discovers tasks
await agent.runContinuous()
// Automatically finds:
// - Build errors
// - Test failures
// - Type errors
// - Lint issues
```

**Workflow:**
```yaml
# Workflow requires manual task definition
steps:
  - id: "check-tests"
    task: "Run tests"  # Hardcoded task
```

**Impact:** Cannot build fully autonomous workflows that:
- Discover their own tasks
- Prioritize tasks dynamically
- Adapt to new issues
- Self-direct work

### 3. Plan File Management

**Agent:**
```typescript
// Agent reads/writes markdown plans
plans/active/
  ├── feature-x.md
  └── bug-fix-y.md
// Updates task status in-place
// Archives completed plans
```

**Workflow:**
```yaml
# Workflow cannot manage plan files
# No integration with plans/ directory
# Cannot update task status
```

**Impact:** Cannot build workflows that:
- Use plan files as task source
- Update plan status
- Coordinate multiple agents via plans
- Implement Planner/Worker pattern

### 4. Safety & Approvals

**Agent:**
```yaml
# .polka.yml
agent:
  requireApprovalFor: "destructive"
  autoApproveSafeTasks: true
  maxAutoApprovalCost: 5.0
  destructiveOperations:
    - "delete"
    - "force-push"
```

**Workflow:**
```yaml
# No built-in approval system
# No safety checks
# No operation classification
```

**Impact:** Cannot build workflows that:
- Require user approval for dangerous ops
- Classify operations by safety
- Enforce budget limits
- Prevent destructive actions

## What CAN Be Covered with Enhancements

### Enhancement 1: Add State Persistence to Workflows

```typescript
// Add to workflow command:
--state-file <path>    // Persist state to file
--resume               // Resume from saved state
--checkpoint           // Create checkpoints
```

**Workflow YAML:**
```yaml
workflows:
  continuous:
    steps:
      - id: "load-state"
        task: "Load previous state from file"
        # Workflow can now resume!
```

### Enhancement 2: Add Task Discovery Integration

```yaml
workflows:
  discover-and-fix:
    inputs:
      - id: "discovery-strategies"
        default: ["build-errors", "failing-tests"]
    steps:
      - id: "discover"
        task: "Run discovery strategies to find issues"
        # Would need discovery tool support
```

### Enhancement 3: Add Safety Systems

```yaml
# Add to workflow YAML:
safety:
  requireApproval: ["delete", "force-push"]
  maxCost: 10.0
  allowDestructive: false

steps:
  - id: "dangerous"
    task: "Delete node_modules"
    safety: "destructive"  # Would trigger approval
```

### Enhancement 4: Add Plan File Support

```yaml
workflows:
  from-plan:
    inputs:
      - id: "plan-file"
        default: "plans/active/my-feature.md"
    steps:
      - id: "read-plan"
        task: "Read plan file and extract tasks"
        output: "tasks"
      # Execute tasks from plan...
```

## Recommendations

### Short Term (Keep Separate)

1. **Maintain both commands** - they serve different purposes
2. **Document use cases clearly** - when to use each
3. **Improve workflow** with the enhancements above
4. **Fix agent** to use full tool support (known issue)

### Medium Term (Convergence)

1. **Add state persistence** to workflow command
2. **Add safety systems** to workflow command
3. **Add plan integration** to workflow command
4. **Create workflow templates** for common agent patterns

### Long Term (Unification?)

Option 1: **Agent as Workflow Template**
```yaml
# agent.yml becomes a special workflow
workflows:
  agent:
    continuous: true
    state: ".polka/agent-state"
    safety: { ... }
    # Agent is just a workflow config!
```

Option 2: **Workflow as Agent Mode**
```bash
# Agent becomes a workflow mode
polka workflow -f my-agent.yml --mode=agent
# Agent features are just workflow options
```

Option 3: **Keep Separate**
- Agent for autonomous exploration
- Workflow for defined processes
- Clear separation of concerns
- Each optimized for its use case

## Conclusion

**Current Status:** Workflow command covers ~60% of agent use cases

**With Proposed Enhancements:** Workflow command could cover ~85% of agent use cases

**Remaining 15%:** True autonomy, self-direction, and complex multi-agent coordination

**Recommendation:** Keep both commands, enhance workflow, allow user choice based on use case.
