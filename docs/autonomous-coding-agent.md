# Autonomous Coding Agent System

## Overview

This document describes how to set up a fully autonomous coding agent system using Polka Codes CLI with two specialized agents: **Planner** and **Worker**.

## Architecture

### Agent Roles

#### 1. Planner Agent
- **Purpose**: High-level planning, coordination, and quality assurance
- **Write Access**: `plans/` directory only
- **Read Access**: Entire codebase
- **Capabilities**:
  - Create and refine implementation plans
  - Break down large tasks into smaller, manageable tasks
  - Review existing plans and identify issues
  - Identify relevant files for workers to avoid redundant discovery
  - Review implementation details for best practices
  - Suggest new features and maintenance tasks
  - Verify implementation completion and archive completed plans

#### 2. Worker Agent
- **Purpose**: Execute implementation tasks defined by Planner
- **Write Access**: Source code, tests, documentation, AND plan status updates
- **Read Access**: Entire codebase
- **Capabilities**:
  - Implement features according to plan specifications
  - Write tests for implemented code
  - Refactor code as directed
  - Fix bugs identified in plans
  - Update documentation
  - Run tests and fix failures
  - **Update task status in plans** (mark tasks as in-progress, completed, blocked)
  - **Add discovered issues to plans** (new tasks found during implementation)
  - **Report blockers and dependencies**

### Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                     Planner Agent                            │
│  (Read-only codebase, Write-only plans/)                    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    Create/Update Plan
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Worker Agent                             │
│  (Read+Write plans/, Write codebase)                         │
│  - Update task status                                        │
│  - Add issues/discovered tasks                              │
│  - Report progress                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                      Implement + Test
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
              Update Status      Add New Tasks
                    │                   │
                    └─────────┬─────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     Planner Agent                            │
│               (Review Progress + New Issues)                 │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                        Approve/Reject
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
                Complete              Rework
                    │                   │
                    ▼                   ▼
              Archive Plan        Update Plan
```

## Implementation Guide

### Step 1: Directory Structure

Create the following structure:

```
polka-codes/
├── plans/                    # Planner's write directory
│   ├── active/              # Plans currently being worked on
│   ├── review/              # Plans under review
│   ├── completed/           # Successfully implemented plans
│   └── archived/            # Old/obsolete plans
├── .planner-config.yml      # Planner agent configuration
└── .worker-config.yml       # Worker agent configuration
```

### Step 2: Planner Agent Setup

Create `.planner-config.yml`:

```yaml
name: "Planner Agent"
description: "Creates and manages implementation plans"

defaultProvider: anthropic
defaultModel: claude-sonnet-4-20250514

rules:
  - "Always read existing plans before creating new ones"
  - "Break down tasks that take more than 2 hours into smaller tasks"
  - "Always identify relevant files for each task"
  - "Include implementation details and best practices in plans"
  - "Review completed work and verify against plan requirements"

tools:
  writeToFile:
    allow:
      - "plans/**/*"
    deny:
      - "**/*"  # Block all other writes
```

### Step 3: Worker Agent Setup

Create `.worker-config.yml`:

```yaml
name: "Worker Agent"
description: "Implements tasks defined in plans"

defaultProvider: anthropic
defaultModel: claude-sonnet-4-20250514

rules:
  - "Read the plan file thoroughly before starting work"
  - "Follow the implementation steps in order"
  - "Write tests for all new code"
  - "Run tests before marking task as complete"
  - "Update task status in plan file as you progress"
  - "Add newly discovered tasks to the plan with clear descriptions"
  - "Report blockers immediately by marking tasks as blocked"
  - "Report completion and any deviations from plan"

tools:
  writeToFile:
    allow:
      - "**/*"  # Can write to codebase
      - "plans/**/*"  # Can update plan status and add tasks
    notes:
      - "Worker can modify plan files to update task status"
      - "Worker can add new tasks to plan when issues are discovered"
      - "Worker cannot delete or restructure the entire plan"
```

### Step 4: Automated Workflow Script

Create `scripts/autonomous-agent.sh`:

```bash
#!/bin/bash

set -e

PLAN_DIR="plans/active"
REVIEW_DIR="plans/review"
COMPLETED_DIR="plans/completed"

# Step 1: Planner reviews existing plans and creates new ones
echo "🤖 Planner: Reviewing and creating plans..."
bun run cli plan \
  --config .planner-config.yml \
  --plan-file "$PLAN_DIR/current.md" \
  "Review existing plans in $PLAN_DIR, identify gaps, and create/update plans for pending work"

# Step 2: Worker picks up next task from active plans
echo "🔨 Worker: Executing tasks from plans..."
for plan in "$PLAN_DIR"/*.md; do
  if [ -f "$plan" ]; then
    echo "Processing: $plan"

    # Extract next uncompleted task from plan
    TASK=$(grep -A 5 "- \[ \]" "$plan" | head -1)

    if [ -n "$TASK" ]; then
      echo "Executing task: $TASK"

      # Worker executes the task
      bun run cli code \
        --config .worker-config.yml \
        --file "$plan" \
        "$(echo "$TASK" | sed 's/^- \[ \] //')"

      # Mark task as in progress for review
      sed -i '' 's/^- \[ \]/- [~]/' "$plan"

      # Move to review
      mv "$plan" "$REVIEW_DIR/"
    fi
  fi
done

# Step 3: Planner reviews completed work
echo "👀 Planner: Reviewing implementation..."
for plan in "$REVIEW_DIR"/*.md; do
  if [ -f "$plan" ]; then
    REVIEW_RESULT=$(bun run cli review \
      --config .planner-config.yml \
      --file "$plan" \
      "Review the implementation against this plan and verify all requirements are met")

    if echo "$REVIEW_RESULT" | grep -q "Approved"; then
      # All tasks completed, archive the plan
      PLAN_NAME=$(basename "$plan")
      mv "$plan" "$COMPLETED_DIR/$PLAN_NAME"
      echo "✅ Plan completed: $PLAN_NAME"
    else
      # Send back for rework
      mv "$plan" "$PLAN_DIR/"
      echo "⚠️  Plan needs rework: $PLAN_NAME"
    fi
  fi
done

echo "🎯 Autonomous agent cycle complete!"
```

### Step 5: Systemd Service or Cron Job

For continuous operation, add to crontab:

```cron
# Run autonomous agents every 30 minutes
*/30 * * * * cd /path/to/polka-codes && ./scripts/autonomous-agent.sh >> logs/agents.log 2>&1
```

Or create a systemd service (`/etc/systemd/system/polka-agents.service`):

```ini
[Unit]
Description=Polka Autonomous Coding Agents
After=network.target

[Service]
Type=simple
User=developer
WorkingDirectory=/path/to/polka-codes
ExecStart=/path/to/polka-codes/scripts/autonomous-agent.sh
Restart=always
RestartSec=60

[Install]
WantedBy=multi-user.target
```

## Plan Template

Create `templates/plan-template.md`:

```markdown
# Plan: [Title]

**Status**: Draft | Active | In Review | Completed
**Priority**: High | Medium | Low
**Estimated Time**: X hours
**Assigned To**: [Worker agent name]

## Overview
[Brief description of what this plan accomplishes]

## Context
[Why this work is needed, background information]

## Relevant Files
[List of files that will be modified or referenced]
- `path/to/file1.ts` - Reason for inclusion
- `path/to/file2.ts` - Reason for inclusion

## Implementation Tasks

### Task 1: [Title]
- [ ] Subtask 1.1
- [ ] Subtask 1.2
**Files**: `path/to/file.ts`
**Details**: [Implementation specifics, best practices, edge cases]
**Status**: Not Started | In Progress | Completed | Blocked
**Blocker**: [If blocked, explain why]

### Task 2: [Title]
- [ ] Subtask 2.1
- [ ] Subtask 2.2
**Files**: `path/to/file.ts`
**Details**: [Implementation specifics]

## Discovered Issues
[Worker adds newly discovered tasks here]
### Issue 1: [Title]
- [ ] Discovered during: [Task name]
- [ ] Priority: High | Medium | Low
- [ ] Description: [What was discovered]
- [ ] Action required: [What needs to be done]

## Testing Requirements
- [ ] Unit tests for X
- [ ] Integration tests for Y
- [ ] Manual testing scenarios

## Definition of Done
- [ ] All tasks completed
- [ ] All tests passing
- [ ] Code reviewed
- [ ] Documentation updated
- [ ] No regressions

## Notes
[Additional context, constraints, dependencies]
```

## Worker Plan Update Protocol

Workers should update plans following this protocol:

### 1. Starting a Task
When starting work on a task, update its status:

```markdown
### Task 1: [Title]
**Status**: In Progress
**Started**: [Timestamp]
```

### 2. Completing a Task
When finishing a task, mark it complete:

```markdown
### Task 1: [Title]
- [x] Subtask 1.1
- [x] Subtask 1.2
**Status**: Completed
**Completed**: [Timestamp]
**Notes**: [Any deviations from plan or important notes]
```

### 3. Encountering a Blocker
If blocked, update immediately:

```markdown
### Task 1: [Title]
**Status**: Blocked
**Blocker**: [Clear explanation of what's blocking]
**Blocker Type**: Technical | Dependency | Decision Required
**Needs**: [What is needed to unblock]
```

### 4. Discovering New Issues
When discovering new issues during implementation:

```markdown
## Discovered Issues

### Issue: [Descriptive Title]
- [ ] Discovered during: Task 1
- [ ] Discovered by: [Worker name]
- [ ] Priority: High | Medium | Low
- [ ] Type: Bug | Feature | Refactor | Documentation
- [ ] Description: [Clear description of the issue]
- [ ] Impact: [Why this matters]
- [ ] Action required: [What needs to be done]
- [ ] Suggested priority: [When this should be addressed]
```

### 5. Adding Related Tasks
If a task needs to be broken down further:

```markdown
### Task 1: [Title]
- [ ] Original subtask 1.1
- [ ] Original subtask 1.2
**Additional tasks discovered during implementation**:
- [ ] New subtask 1.3 - [Reason why needed]
- [ ] New subtask 1.4 - [Reason why needed]
```

### 6. Progress Checkpoints
For long tasks, add periodic updates:

```markdown
### Task 1: [Title]
**Status**: In Progress
**Progress Updates**:
- [2025-01-08 14:30] Started implementation, completed basic structure
- [2025-01-08 16:00] Added core logic, testing edge cases
- [2025-01-09 10:00] Encountered issue with X, documenting...
```

### Best Practices for Workers

1. **Update Frequently**: Update plan status at least once per hour
2. **Be Specific**: Use clear, actionable descriptions for blockers and issues
3. **Add Context**: Explain why new tasks are needed, not just what
4. **Flag Blockers Early**: Don't wait - report blockers immediately
5. **Document Deviations**: If implementation differs from plan, explain why
6. **Keep Formatting**: Maintain markdown structure for parser compatibility

## Advanced Features

### 1. Parallel Workers

Create multiple worker agents for different domains:

```yaml
# .worker-frontend-config.yml
name: "Frontend Worker"
rules:
  - "Focus on UI/UX components"
  - "Use React best practices"
  - "Test with Storybook"

# .worker-backend-config.yml
name: "Backend Worker"
rules:
  - "Focus on API and business logic"
  - "Follow RESTful principles"
  - "Write integration tests"
```

### 2. Continuous Monitoring

Create a monitoring dashboard:

```typescript
// scripts/agent-monitor.ts
import { readFileSync, readdirSync } from 'fs'

const metrics = {
  activePlans: 0,
  completedPlans: 0,
  pendingTasks: 0,
  completedTasks: 0,
}

function scanPlans() {
  const activePlans = readdirSync('plans/active')
  const completedPlans = readdirSync('plans/completed')

  metrics.activePlans = activePlans.length
  metrics.completedPlans = completedPlans.length

  activePlans.forEach(plan => {
    const content = readFileSync(`plans/active/${plan}`, 'utf-8')
    const pending = (content.match(/- \[ \]/g) || []).length
    const completed = (content.match(/- \[x\]/g) || []).length
    metrics.pendingTasks += pending
    metrics.completedTasks += completed
  })
}

setInterval(() => {
  scanPlans()
  console.log('📊 Agent Metrics:', metrics)
}, 60000) // Every minute
```

### 3. Intelligent Task Prioritization

Enhance planner to prioritize based on:

```yaml
# .planner-config.yml
priorities:
  - "Critical bugs and security issues"
  - "High-priority features from stakeholders"
  - "Technical debt reduction"
  - "Test coverage improvements"
  - "Documentation updates"
  - "Code refactoring"
  - "Performance optimizations"
```

## Missing Features (Gap Analysis)

Based on current Polka Codes CLI capabilities, the following features need to be implemented:

### Critical

1. **Fine-Grained File Access Control**
   - **Current**: No tool-level permission system
   - **Needed**: `tools.writeToFile.allow` and `tools.writeToFile.deny` configuration
   - **Implementation**: Add permission middleware in tool execution layer

2. **Plan State Management**
   - **Current**: Manual plan file tracking
   - **Needed**: Automatic state transitions (Draft → Active → Review → Completed)
   - **Implementation**: Add plan metadata file with state tracking

3. **Task Extraction and Tracking**
   - **Current**: No structured task extraction from plans
   - **Needed**: Parse markdown tasks and track completion status
   - **Implementation**: Add task parser that reads/writes markdown checkboxes

4. **Agent Coordination Protocol**
   - **Current**: No built-in agent-to-agent communication
   - **Needed**: Standard protocol for handoff between agents
   - **Implementation**: Add workflow step for "delegate to agent" with status reporting

### Important

5. **Work Queue Management**
   - **Current**: No queue system for parallel workers
   - **Needed**: Task queue with locking mechanism
   - **Implementation**: Add `plans/queue.json` with task assignments

6. **Automated Review Workflow**
   - **Current**: Manual review process
   - **Needed**: Integrated review → approve/reject → rework cycle
   - **Implementation**: Add `review.workflow.ts` with plan verification

7. **Progress Tracking Dashboard**
   - **Current**: No visibility into agent activity
   - **Needed**: Real-time metrics and status display
   - **Implementation**: Add monitoring endpoint or CLI command

8. **Rollback and Recovery**
   - **Current**: No undo mechanism for agent actions
   - **Needed**: Ability to revert changes and recover from errors
   - **Implementation**: Add git-based automatic checkpoints

### Nice to Have

9. **Agent Specialization Profiles**
   - **Current**: Generic agent configuration
   - **Needed**: Domain-specific agent templates (frontend, backend, DevOps)
   - **Implementation**: Add profile system with preset rules and tools

10. **Learning from Past Plans**
    - **Current**: No historical analysis
    - **Needed**: Learn from successful/failed plans to improve future planning
    - **Implementation**: Add plan analytics and pattern recognition

11. **Dependency Detection**
    - **Current**: Manual dependency tracking
    - **Needed**: Automatically detect task dependencies and blocking issues
    - **Implementation**: Add dependency graph analysis

12. **Collaborative Planning**
    - **Current**: Single planner agent
    - **Needed**: Multiple specialized planners (architecture, security, performance)
    - **Implementation**: Add planner-of-planners coordinator

## Implementation Roadmap

### Phase 1: Foundation (1-2 weeks)
1. Implement file access control system
2. Create plan state management
3. Build task extraction and tracking
4. Set up basic planner/worker configs

### Phase 2: Automation (1 week)
5. Implement agent coordination protocol
6. Create automated workflow script
7. Add progress tracking
8. Set up continuous operation (cron/systemd)

### Phase 3: Enhancement (1-2 weeks)
9. Build work queue management
10. Add automated review workflow
11. Implement monitoring dashboard
12. Add rollback/recovery mechanism

### Phase 4: Optimization (ongoing)
13. Create specialized agent profiles
14. Add learning and analytics
15. Implement dependency detection
16. Enable multi-planner collaboration

## Usage Example

Once implemented, usage would be:

```bash
# Start autonomous agents
./scripts/autonomous-agent.sh

# Check status
bun run cli agent-status

# View active plans
ls plans/active/

# Review completed work
cat plans/completed/feature-x.md

# Manual intervention if needed
bun run cli plan --plan-file plans/active/feature-x.md "Adjust plan direction"

# Stop agents
pkill -f autonomous-agent
```

## Safety and Monitoring

### Guardrails

1. **Git Integration**: All agent actions should be committed to git for rollback
2. **Test Gates**: Workers must run tests before marking tasks complete
3. **Human Review**: Critical changes require approval before merge
4. **Rate Limiting**: Prevent infinite loops or resource exhaustion
5. **Error Boundaries**: Catch and handle agent errors gracefully

### Monitoring

```bash
# Watch agent activity
tail -f logs/agents.log

# Check plan status
bun run cli agent-status

# View metrics
bun run cli agent-metrics

# Emergency stop
pkill -9 -f polka
```

## Conclusion

This autonomous coding agent system leverages the existing Polka Codes CLI infrastructure while adding structured coordination between specialized agents. The key missing features are primarily around:

1. **Access control** - Restricting what agents can write
2. **State management** - Tracking plan and task status
3. **Coordination** - Agent handoff and communication
4. **Monitoring** - Visibility into autonomous operations

Once these features are implemented, the system can run continuously to plan, implement, and verify software development tasks with minimal human intervention.
