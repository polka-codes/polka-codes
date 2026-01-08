# Building Autonomous Agents with Workflows

This guide shows how to build autonomous agents with Planner/Worker separation using YAML workflows, achieving similar functionality to the agent command but with declarative configuration.

## Architecture Overview

### Traditional Agent vs Workflow Agent

**Traditional Agent (Code-based):**
```
Agent Orchestrator (TypeScript)
├── Planner Agent
│   ├── Reads plans/active/*.md
│   ├── Creates new plans
│   └── Reviews work
└── Worker Agent
    ├── Picks tasks from plans
    ├── Executes tasks
    └── Updates plan status
```

**Workflow Agent (YAML-based):**
```
Workflow YAML (Declarative)
├── Planner Workflow
│   ├── Creates plans/*.md files
│   ├── Defines task structure
│   └── Sets acceptance criteria
└── Worker Workflow
    ├── Reads plans/*.md files
    ├── Executes defined tasks
    └── Updates task status
```

## Key Concepts

### 1. Plan File Structure

Plans are markdown files with structured task lists:

```markdown
# Feature: User Authentication

## Status: In Progress

## Tasks

### [ ] Task 1: Design database schema
- **Priority**: High
- **Dependencies**: None
- **Status**: TODO

### [ ] Task 2: Implement user model
- **Priority**: High
- **Dependencies**: Task 1
- **Status**: TODO

### [ ] Task 3: Create authentication endpoints
- **Priority**: High
- **Dependencies**: Task 2
- **Status**: TODO

## Notes
- Use JWT for tokens
- Password hashing with bcrypt
- Session management with Redis
```

### 2. Planner Workflow

Creates and manages plan files:

```yaml
# planner.yml
workflows:
  main:
    task: "Create implementation plan from user goal"

    inputs:
      - id: "goal"
        description: "High-level goal to achieve"
        default: "Add user authentication"

      - id: "planFile"
        description: "Where to save the plan"
        default: "plans/active/user-auth.md"

    steps:
      # Step 1: Analyze requirements
      - id: "analyze"
        task: |
          Analyze the goal and break it down into tasks:
          {{ goal }}

          Consider:
          - Technical requirements
          - Dependencies between tasks
          - Priority order
          - Acceptance criteria
        tools: ["executeCommand", "readFile", "searchFiles"]
        output: "tasks"
        expected_outcome: "List of tasks with dependencies"

      # Step 2: Create plan file
      - id: "create-plan"
        task: |
          Create a markdown plan file at {{ planFile }}:

          # {{ goal }}

          ## Status: Created

          ## Tasks

          {{ tasks.markdown }}

          ## Notes
          - Created by Planner Workflow
          - Date: {{ tasks.date }}
        tools: ["writeFile"]
        expected_outcome: "Plan file created"

      # Step 3: Save to plans/active/
      - id: "save-plan"
        task: "Save plan to plans/active/ directory"
        tools: ["executeCommand", "writeFile"]
        expected_outcome: "Plan saved and ready for worker"
```

### 3. Worker Workflow

Executes tasks from plan files:

```yaml
# worker.yml
workflows:
  main:
    task: "Execute tasks from plan file"

    inputs:
      - id: "planFile"
        description: "Path to plan file"
        default: "plans/active/user-auth.md"

    steps:
      # Step 1: Read plan
      - id: "read-plan"
        task: |
          Read and parse the plan file at {{ planFile }}.
          Extract:
          - All tasks with status TODO or IN_PROGRESS
          - Task dependencies
          - Priority information
        tools: ["readFile"]
        output: "plan"
        expected_outcome: "Parsed plan with task list"

      # Step 2: Find next task
      - id: "find-next-task"
        task: |
          Find the next task to execute:
          - Task must be TODO (not completed)
          - All dependencies must be completed
          - Pick highest priority if multiple available
        tools: ["readFile"]
        output: "nextTask"
        expected_outcome: "Selected task to execute"

      # Step 3: Execute task loop
      - id: "task-loop"
        while:
          condition: "nextTask !== null"
          steps:
            - id: "log-task"
              task: |
                ============================================================
                Executing: {{ nextTask.title }}
                Priority: {{ nextTask.priority }}
                ============================================================
              tools: ["executeCommand"]
              expected_outcome: "Task logged"

            - id: "update-in-progress"
              task: |
                Update plan file to mark task as IN_PROGRESS:
                {{ nextTask.title }}
              tools: ["readFile", "writeFile"]
              expected_outcome: "Task marked as IN_PROGRESS"

            - id: "execute-task"
              task: |
                Execute the task:
                {{ nextTask.description }}

                Use appropriate workflows (code, fix, etc.) based on task type.
              tools: ["executeCommand", "readFile", "writeFile", "searchFiles"]
              expected_outcome: "Task completed successfully"

            - id: "verify-task"
              task: |
                Verify the task was completed correctly:
                - Run tests if applicable
                - Check acceptance criteria
                - Verify no regressions
              tools: ["executeCommand"]
              expected_outcome: "Task verified"

            - id: "mark-complete"
              task: |
                Update plan file to mark task as COMPLETED:
                {{ nextTask.title }}
              tools: ["readFile", "writeFile"]
              expected_outcome: "Task marked as COMPLETED"

            - id: "find-next"
              task: "Find the next task to execute"
              tools: ["readFile"]
              output: "nextTask"
              expected_outcome: "Next task or null if complete"

      # Step 4: All tasks complete
      - id: "complete"
        task: |
          All tasks in the plan have been completed!

          Move plan from plans/active/ to plans/completed/
          Generate summary report
        tools: ["executeCommand", "readFile", "writeFile"]
        expected_outcome: "Plan completed and archived"
```

## Complete Example: Planner/Worker System

### Directory Structure

```
project/
├── plans/
│   ├── active/
│   ├── completed/
│   └── archived/
├── workflows/
│   ├── planner.yml
│   └── worker.yml
└── run-agent.sh
```

### Planner Workflow

Create `workflows/planner.yml`:

```yaml
workflows:
  create-plan:
    task: "Create implementation plan from goal"

    inputs:
      - id: "goal"
        description: "Feature or goal to implement"
        required: true

      - id: "planName"
        description: "Name for the plan file"
        default: "feature"

    steps:
      # Step 1: Analyze codebase
      - id: "analyze-codebase"
        task: |
          Analyze the current codebase to understand:
          - Project structure
          - Existing patterns
          - Relevant files
          - Dependencies
        tools: ["listFiles", "searchFiles", "readFile"]
        output: "codebaseContext"
        expected_outcome: "Codebase analysis complete"

      # Step 2: Break down goal into tasks
      - id: "create-tasks"
        task: |
          Break down the goal into specific tasks:
          {{ goal }}

          For each task, define:
          - Title and description
          - Dependencies (what must be done first)
          - Priority (critical/high/medium/low)
          - Acceptance criteria
          - Estimated complexity
        tools: ["executeCommand", "readFile", "searchFiles"]
        input: {
          "goal": "{{ goal }}",
          "context": "{{ codebaseContext }}"
        }
        output: "taskList"
        expected_outcome: "Structured task list"

      # Step 3: Create plan markdown file
      - id: "write-plan"
        task: |
          Create a plan markdown file:

          # {{ goal }}

          Created: {{ taskList.date }}
          Status: TODO

          ## Tasks

          {{ taskList.markdown }}

          ## Metadata
          - Total Tasks: {{ taskList.count }}
          - Estimated Complexity: {{ taskList.complexity }}
          - Priority: {{ taskList.overallPriority }}
        tools: ["writeFile"]
        input: {
          "path": "plans/active/{{ planName }}.md",
          "content": "{{ taskList.planContent }}"
        }
        expected_outcome: "Plan file created"
        output: "planPath"

      # Step 4: Log plan creation
      - id: "log-success"
        task: |
          Plan created successfully at: {{ planPath }}

          Next steps:
          1. Review the plan: cat {{ planPath }}
          2. Run worker: polka workflow -f workflows/worker.yml "planFile:{{ planPath }}"
          3. Monitor progress
        tools: ["executeCommand"]
        expected_outcome: "Plan location and next steps logged"
```

### Worker Workflow

Create `workflows/worker.yml`:

```yaml
workflows:
  execute-plan:
    task: "Execute all tasks from a plan file"

    inputs:
      - id: "planFile"
        description: "Path to plan file to execute"
        required: true

      - id: "autoCommit"
        description: "Automatically commit completed work"
        default: true

    steps:
      # Step 1: Load and parse plan
      - id: "load-plan"
        task: |
          Load the plan file: {{ planFile }}

          Parse and extract:
          - Plan title and description
          - All tasks with their status
          - Task dependencies
          - Task priorities
          - Acceptance criteria
        tools: ["readFile"]
        output: "plan"
        expected_outcome: "Plan loaded and parsed"

      # Step 2: Validate plan
      - id: "validate-plan"
        task: |
          Validate the plan structure:
          - Has at least one task
          - Tasks have proper dependencies
          - No circular dependencies
          - Status format is correct
        tools: []
        input: {
          "plan": "{{ plan }}"
        }
        output: "validation"
        expected_outcome: "Plan is valid"

      # Step 3: Main execution loop
      - id: "execution-loop"
        while:
          condition: "plan.hasIncompleteTasks"
          steps:
            # Step 3a: Find next executable task
            - id: "find-task"
              task: |
                Find the next task to execute:

                Criteria:
                - Status is TODO
                - All dependencies are COMPLETED
                - Highest priority first

                If no tasks are ready, check for:
                - Blocked tasks (dependencies not met)
                - Circular dependencies
              tools: ["readFile"]
              input: {
                "plan": "{{ plan }}"
              }
              output: "task"
              expected_outcome: "Selected task or null"

            # Step 3b: Check if we have a task
            - id: "check-task"
              if:
                condition: "task === null"
                thenBranch:
                  # No executable tasks - might be blocked
                  - id: "check-blocked"
                    task: |
                      Check if there are blocked tasks:
                      {{ plan.blockedTasks }}

                      If blocked, wait for dependencies.
                      If circular dependency detected, error.
                    tools: ["executeCommand"]
                    expected_outcome: "Blocked status identified"

                  # Exit the loop
                  - id: "no-task"
                    break: true

                elseBranch:
                  # We have a task - execute it
                  - id: "log-start"
                    task: |
                      ============================================================
                      Task: {{ task.title }}
                      Priority: {{ task.priority }}
                      Dependencies: {{ task.dependencies || 'None' }}
                      ============================================================

                      Description:
                      {{ task.description }}
                    tools: ["executeCommand"]
                    expected_outcome: "Task details logged"

                  # Step 3c: Mark task as IN_PROGRESS
                  - id: "mark-in-progress"
                    task: |
                      Update plan file to mark task as IN_PROGRESS:
                      {{ task.title }}
                    tools: ["readFile", "writeFile"]
                    input: {
                      "planFile": "{{ planFile }}",
                      "taskId": "{{ task.id }}",
                      "status": "IN_PROGRESS"
                    }
                    output: "plan"
                    expected_outcome: "Task status updated"

                  # Step 3d: Execute the task
                  - id: "execute-task"
                    task: |
                      Execute the task using appropriate workflow:

                      Task: {{ task.title }}
                      {{ task.description }}

                      Acceptance Criteria:
                      {{ task.acceptanceCriteria }}
                    tools: ["executeCommand", "readFile", "writeFile", "searchFiles"]
                    output: "result"
                    expected_outcome: "Task executed successfully"

                  # Step 3e: Verify completion
                  - id: "verify"
                    task: |
                      Verify the task meets acceptance criteria:
                      {{ task.acceptanceCriteria }}

                      Run appropriate checks:
                      - Tests pass
                      - Code compiles
                      - No regressions
                      - Requirements met
                    tools: ["executeCommand"]
                    input: {
                      "criteria": "{{ task.acceptanceCriteria }}"
                    }
                    output: "verification"
                    expected_outcome: "Task verified"

                  # Step 3f: Handle verification result
                  - id: "handle-verification"
                    if:
                      condition: "verification.passed"
                      thenBranch:
                        # Task passed - mark as COMPLETED
                        - id: "mark-complete"
                          task: |
                            Mark task as COMPLETED:
                            {{ task.title }}

                            Result: {{ result.summary }}
                          tools: ["readFile", "writeFile"]
                          input: {
                            "planFile": "{{ planFile }}",
                            "taskId": "{{ task.id }}",
                            "status": "COMPLETED"
                          }
                          output: "plan"

                        - id: "log-success"
                          task: |
                            ✅ Task completed successfully: {{ task.title }}

                            {{ result.summary }}
                          tools: ["executeCommand"]
                          expected_outcome: "Success logged"

                        # Optional: Auto-commit
                        - id: "commit-work"
                          if:
                            condition: "{{ autoCommit }}"
                            thenBranch:
                              - id: "do-commit"
                                task: |
                                  Commit the completed work:

                                  {{ task.title }}

                                  {{ result.summary }}
                                tools: ["executeCommand"]
                                expected_outcome: "Work committed"

                      elseBranch:
                        # Task failed - mark as FAILED
                        - id: "mark-failed"
                          task: |
                            ❌ Task verification failed: {{ task.title }}

                            Reasons:
                            {{ verification.reasons }}
                          tools: ["readFile", "writeFile"]
                          input: {
                            "planFile": "{{ planFile }}",
                            "taskId": "{{ task.id }}",
                            "status": "FAILED"
                          }
                          output: "plan"

                        - id: "log-failure"
                          task: |
                            Task failed - stopping execution

                            Failed task: {{ task.title }}
                            Reasons: {{ verification.reasons }}

                            Please fix the issues and re-run.
                          tools: ["executeCommand"]
                          expected_outcome: "Failure logged"

                        # Stop execution on failure
                        - id: "stop-on-failure"
                          break: true

      # Step 4: All tasks complete
      - id: "complete-plan"
        task: |
          All tasks in the plan have been completed successfully!

          Plan: {{ plan.title }}
          File: {{ planFile }}

          Moving to plans/completed/
        tools: ["executeCommand", "readFile", "writeFile"]
        input: {
          "planFile": "{{ planFile }}"
        }
        expected_outcome: "Plan completed and archived"

      # Step 5: Generate summary
      - id: "summary"
        task: |
          Generate final summary:

          - Plan: {{ plan.title }}
          - Total tasks: {{ plan.taskCount }}
          - Completed: {{ plan.completedCount }}
          - Duration: {{ plan.duration }}
          - Files modified: {{ plan.filesChanged }}
        tools: ["executeCommand", "readFile"]
        expected_outcome: "Summary report generated"
```

### Orchestrator Script

Create `run-agent.sh`:

```bash
#!/bin/bash

# Autonomous Agent Orchestrator
# Runs planner and worker workflows in a loop

set -e

PLANS_DIR="plans/active"
WORKER_WORKFLOW="workflows/worker.yml"
PLANNER_WORKFLOW="workflows/planner.yml"
SLEEP_INTERVAL=60  # seconds

echo "🤖 Autonomous Agent Started"
echo "================================"
echo ""

while true; do
  # Step 1: Check for plans to execute
  echo "📋 Checking for plans..."

  PLANS=$(find "$PLANS_DIR" -name "*.md" 2>/dev/null || true)

  if [ -z "$PLANS" ]; then
    echo "No plans found. Creating new plan from goal..."
    echo ""

    # Step 2: Create a new plan
    # For demo, use a default goal. In production, read from input
    polka workflow -f "$PLANNER_WORKFLOW" "goal: Improve code quality"

    echo ""
    echo "⏱️  Sleeping for ${SLEEP_INTERVAL}s..."
    sleep "$SLEEP_INTERVAL"
    continue
  fi

  # Step 3: Execute each plan
  for PLAN_FILE in $PLANS; do
    echo ""
    echo "================================"
    echo "📄 Executing plan: $PLAN_FILE"
    echo "================================"
    echo ""

    # Run worker workflow
    polka workflow -f "$WORKER_WORKFLOW" "planFile:$PLAN_FILE"

    # Check if plan was completed
    if grep -q "Status: COMPLETED" "$PLAN_FILE"; then
      echo "✅ Plan completed: $PLAN_FILE"

      # Move to completed
      mv "$PLAN_FILE" "plans/completed/"
    else
      echo "⚠️  Plan not completed: $PLAN_FILE"
    fi

    echo ""
  done

  echo "🔄 All plans processed. Sleeping for ${SLEEP_INTERVAL}s..."
  echo ""
  sleep "$SLEEP_INTERVAL"
done
```

## Usage Examples

### Example 1: Create and Execute a Plan

```bash
# Step 1: Create a plan
polka workflow -f workflows/planner.yml \
  "goal: Add user authentication with JWT" \
  "planName: user-auth"

# Step 2: Execute the plan
polka workflow -f workflows/worker.yml \
  "planFile: plans/active/user-auth.md"
```

### Example 2: Full Autonomous Loop

```bash
# Make orchestrator executable
chmod +x run-agent.sh

# Run the autonomous agent
./run-agent.sh
```

### Example 3: Multi-Agent Setup

Create separate workflows for different agent types:

```yaml
# workflows/test-agent.yml
workflows:
  main:
    task: "Find and fix test failures"
    steps:
      - id: "find-failures"
        task: "Discover failing tests"
        tools: ["executeCommand"]
        output: "failures"

      - id: "fix-loop"
        while:
          condition: "failures.count > 0"
          steps:
            - id: "fix-one"
              task: "Fix one failing test"
              tools: ["executeCommand", "readFile", "writeFile"]

            - id: "verify"
              task: "Verify test passes"
              tools: ["executeCommand"]
```

```yaml
# workflows/lint-agent.yml
workflows:
  main:
    task: "Find and fix lint issues"
    steps:
      - id: "find-issues"
        task: "Run linter to find issues"
        tools: ["executeCommand"]
        output: "issues"

      - id: "fix-loop"
        while:
          condition: "issues.count > 0"
          steps:
            - id: "fix-one"
              task: "Fix one lint issue"
              tools: ["executeCommand", "readFile", "writeFile"]

            - id: "verify"
              task: "Verify issue is fixed"
              tools: ["executeCommand"]
```

Run multiple agents in parallel:

```bash
# Run multiple agents
polka workflow -f workflows/test-agent.yml &
TEST_PID=$!

polka workflow -f workflows/lint-agent.yml &
LINT_PID=$!

# Wait for both
wait $TEST_PID
wait $LINT_PID
```

## Best Practices

### 1. Plan File Standards

Always include these sections in plan files:

```markdown
# Feature: [Title]

**Status**: TODO | IN_PROGRESS | COMPLETED | FAILED
**Created**: [Date]
**Updated**: [Date]

## Overview
[Brief description of the feature]

## Tasks

### [ ] Task 1: [Title]
- **Priority**: Critical | High | Medium | Low
- **Dependencies**: Task 0, Task 2 (or None)
- **Status**: TODO | IN_PROGRESS | COMPLETED | FAILED
- **Estimated**: [Complexity/Time]

**Description:**
[Detailed task description]

**Acceptance Criteria:**
- [ ] Criterion 1
- [ ] Criterion 2

**Notes:**
[Any additional notes]

## Dependencies
[Task dependency graph]

## Risks
[Potential risks and mitigations]
```

### 2. Task Status Flow

```
TODO → IN_PROGRESS → COMPLETED
  ↓         ↓           ↑
  └─────── FAILED ─────┘
```

### 3. Dependency Management

```yaml
# Good: Clear dependencies
- id: "task-3"
  dependencies: ["task-1", "task-2"]

# Bad: Unclear dependencies
- id: "task-3"
  dependencies: ["some earlier tasks"]
```

### 4. Error Handling

```yaml
steps:
  - id: "risky-task"
    task: "Execute risky operation"
    tools: [...]

  - id: "handle-result"
    if:
      condition: "result.success === false"
      thenBranch:
        - id: "log-failure"
          task: "Log and handle failure"
          tools: ["executeCommand"]

        - id: "stop"
          break: true
```

## Comparison: Workflow vs Traditional Agent

| Feature | Workflow Agent | Traditional Agent |
|---------|----------------|-------------------|
| **Configuration** | YAML files | TypeScript code |
| **Plan Management** | Manual (read/write markdown) | Automatic (AgentStateManager) |
| **State Persistence** | File-based (plan files) | Database (agent-state/) |
| **Recovery** | Restart from last plan status | Resume from state DB |
| **Modifiability** | Edit YAML | Recompile code |
| **Debugging** | Read plan files | Check state DB |
| **Complexity** | Simpler | More complex |
| **Flexibility** | Less flexible | Highly flexible |

## When to Use Each

### Use Workflow Agent When:
- You want declarative configuration
- You prefer YAML over TypeScript
- You need to modify plans manually
- You want simpler architecture
- You don't need complex state management

### Use Traditional Agent When:
- You need full autonomy
- You want automatic state persistence
- You need complex recovery logic
- You prefer programmatic control
- You need advanced monitoring

## Conclusion

Workflow-based autonomous agents offer a **declarative, maintainable** approach to building autonomous systems. While they may not have all the features of code-based agents, they're often **sufficient** and **easier to understand**.

The key insight: **You don't always need code** for autonomous behavior. YAML workflows with while loops, conditionals, and plan files can achieve most autonomous agent patterns while being more readable and maintainable.
