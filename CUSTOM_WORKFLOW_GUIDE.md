# Creating Custom Polka Workflows

This guide explains how to create custom polka workflows to automate specific development flows like "review and commit".

## Table of Contents

1. [Quick Start](#quick-start)
2. [Option 1: YAML Workflows](#option-1-yaml-workflows)
3. [Option 2: TypeScript Workflows](#option-2-typescript-workflows)
4. [Option 3: Shell Scripts](#option-3-shell-scripts)
5. [Option 4: MCP Tools](#option-4-mcp-tools)
6. [Examples](#examples)

---

## Quick Start

The simplest way to create a "review and commit" workflow is using a shell script:

```bash
#!/bin/bash
# review-commit.sh

# Review changes
bun run polka review

# Check if review found issues
if [ $? -eq 0 ]; then
  # Commit if review passed
  bun run polka commit
fi
```

But for more sophisticated flows, use one of the options below.

---

## Option 1: YAML Workflows

YAML workflows are **declarative** and great for:
- Loops and conditional logic
- Multi-step processes
- Non-programmers
- Documentation and readability

### Example: Review-and-Commit YAML

Save as `examples/review-and-commit.yml`:

```yaml
workflows:
  main:
    task: "Review code and create commits"

    inputs:
      - id: "maxIterations"
        description: "Maximum review-commit cycles (0 = unlimited)"
        default: 1

      - id: "commitOnSuccess"
        description: "Auto-commit when review finds no critical issues"
        default: true

    steps:
      # Main loop
      - id: "review-commit-loop"
        while:
          condition: "state.count < state.maxIterations"
          steps:
            # Review changes
            - id: "review"
              task: "Review all staged and unstaged changes"
              tools: ["executeCommand", "readFile", "listFiles"]
              output: "reviewResult"

            # Conditional commit
            - id: "commit-if-clean"
              if:
                condition: "reviewResult.hasCriticalIssues === false && commitOnSuccess === true"
                thenBranch:
                  - id: "create-commit"
                    task: "Create commit with AI-generated message"
                    tools: ["executeCommand"]
                    expected_outcome: "Commit created successfully"

            # Increment counter
            - id: "increment"
              task: "Increment iteration counter"
              output: "state"
```

### Usage

```bash
# Run the workflow
bun run polka workflow -f examples/review-and-commit.yml

# With custom input values
bun run polka workflow -f examples/review-and-commit.yml --maxIterations 5 --commitOnSuccess true
```

### Key Features

- **Loops**: Use `while:` to repeat steps
- **Conditionals**: Use `if:` with `thenBranch:` and `elseBranch:`
- **State Management**: Use `output:` to pass data between steps
- **Built-in Tools**: `executeCommand`, `readFile`, `listFiles`, `searchFiles`, etc.

---

## Option 2: TypeScript Workflows

TypeScript workflows are **imperative** and great for:
- Complex logic and control flow
- Type safety
- Reusability
- Integration with existing code

### Example: Review-Fix-Commit TypeScript

Save as `examples/review-fix-commit.ts`:

```typescript
import { review } from '../packages/cli/src/workflows/review.workflow'
import { fix } from '../packages/cli/src/workflows/fix.workflow'
import { commit } from '../packages/cli/src/workflows/commit.workflow'
import type { WorkflowFn } from '@polka-codes/core'
import type { BaseWorkflowInput } from '../packages/cli/src/workflows'

interface ReviewFixCommitInput {
  maxIterations?: number
  autoFix?: boolean
  autoCommit?: boolean
  reviewContext?: string
}

export const reviewFixCommitWorkflow: WorkflowFn<
  ReviewFixCommitInput & BaseWorkflowInput,
  { iterations: number; commits: number },
  any
> = async (input, context) => {
  const { maxIterations = 1, autoFix = true, autoCommit = true } = input
  const { step, tools, logger } = context

  let iterations = 0
  let commits = 0

  while (iterations < maxIterations) {
    iterations++

    // 1. Check for changes
    const statusResult = await tools.executeCommand({
      command: 'git',
      args: ['status', '--porcelain=v1'],
    })

    if (!statusResult.stdout.trim()) {
      logger.info('No changes to review')
      break
    }

    // 2. Review changes
    const reviewResult = await step('Review changes', async () => {
      return await review({}, context)
    })

    const hasIssues = reviewResult.specificReviews?.length > 0

    if (!hasIssues) {
      logger.info('✅ No issues found')

      // 3. Commit if clean
      if (autoCommit) {
        await step('Commit changes', async () => {
          await commit({}, context)
          commits++
        })
      }
    } else if (autoFix) {
      // 4. Fix issues
      await step('Fix issues', async () => {
        await fix({
          task: `Fix these issues: ${JSON.stringify(reviewResult.specificReviews)}`,
        }, context)
      })

      // 5. Commit fixes
      if (autoCommit) {
        await commit({}, context)
        commits++
      }
    }
  }

  return { iterations, commits }
}
```

### Usage

```bash
# Run the workflow
bun run polka workflow -f examples/review-fix-commit.ts

# With parameters
bun run polka workflow -f examples/review-fix-commit.ts --maxIterations 3 --autoFix true
```

### Key Advantages

- **Type Safety**: Full TypeScript support with autocomplete
- **Import Workflows**: Reuse existing workflows (review, fix, commit, etc.)
- **Complex Logic**: Use loops, conditionals, error handling
- **Testing**: Easier to test and debug

---

## Option 3: Shell Scripts

Shell scripts are **simple** and great for:
- Quick automation
- Sequential commands
- Platform-specific tasks
- CI/CD pipelines

### Example: Simple Review-Commit Script

Save as `scripts/review-commit.sh`:

```bash
#!/bin/bash
set -e  # Exit on error

# Configuration
MAX_ITERATIONS=${1:-1}
SLEEP_INTERVAL=${2:-30}

echo "Starting review-commit workflow (max: $MAX_ITERATIONS iterations)"

for ((i=1; i<=MAX_ITERATIONS; i++)); do
  echo "========================================="
  echo "Cycle $i/$MAX_ITERATIONS"
  echo "========================================="

  # Check for changes
  if ! git status --porcelain | grep -q .; then
    echo "No changes to review"
    break
  fi

  # Review changes
  echo "Reviewing changes..."
  bun run polka review --range HEAD~5..HEAD

  # Check review result
  REVIEW_EXIT_CODE=$?

  if [ $REVIEW_EXIT_CODE -eq 0 ]; then
    echo "✅ Review passed - creating commit"
    bun run polka commit
  else
    echo "⚠️ Review found issues"
    # Optionally run fix workflow
    # bun run polka fix "fix issues from review"
  fi

  # Sleep before next iteration
  if [ $i -lt $MAX_ITERATIONS ]; then
    echo "Sleeping for ${SLEEP_INTERVAL}s..."
    sleep $SLEEP_INTERVAL
  fi
done

echo "Review-commit workflow complete!"
```

### Usage

```bash
# Make executable
chmod +x scripts/review-commit.sh

# Run
./scripts/review-commit.sh 5 30  # 5 iterations, 30s sleep
```

---

## Option 4: MCP Tools

For AI-powered automation (e.g., from Claude Desktop), use MCP tools.

### Setup

1. Configure MCP server in your Claude Desktop config:

```json
{
  "mcpServers": {
    "polka": {
      "command": "bun",
      "args": ["run", "/path/to/polka-codes/packages/cli/src/mcp-server/index.ts"],
      "env": {
        "POLKA_CONFIG_PATH": "/path/to/.polkarc.yml"
      }
    }
  }
}
```

2. Use in Claude Desktop:

```
Please:
1. Review the last 20 commits
2. Fix any issues found
3. Commit the fixes
```

Claude will automatically use the MCP tools: `mcp__polka__review`, `mcp__polka__fix`, `mcp__polka__commit`.

### Available MCP Tools

- **`mcp__polka__code`**: Execute coding tasks
- **`mcp__polka__review`**: Review code changes
- **`mcp__polka__fix`**: Fix issues and bugs
- **`mcp__polka__plan`**: Create implementation plans
- **`mcp__polka__commit`**: Create git commits

---

## Examples

### Example 1: Continuous Review-Commit Loop

Run continuous review-commit cycle until no issues found:

```yaml
# continuous-review-commit.yml
workflows:
  main:
    task: "Continuously review and commit changes"

    inputs:
      - id: "sleepInterval"
        default: 60000  # 1 minute

    steps:
      - id: "continuous-loop"
        while:
          condition: "true"  # Run forever
          steps:
            - id: "review"
              task: "Review all changes"
              tools: ["executeCommand", "readFile", "listFiles"]
              output: "reviewResult"

            - id: "commit-if-clean"
              if:
                condition: "reviewResult.hasIssues === false"
                thenBranch:
                  - id: "commit"
                    task: "Commit changes"
                    tools: ["executeCommand"]

            - id: "sleep"
              task: "Sleep {{ sleepInterval }}ms"
              tools: []
```

### Example 2: Review-Fix-Commit with Manual Approval

Require manual approval before committing:

```yaml
# review-fix-commit-manual.yml
workflows:
  main:
    task: "Review, fix, and commit with manual approval"

    steps:
      - id: "review"
        task: "Review changes"
        tools: ["executeCommand", "readFile", "listFiles"]
        output: "reviewResult"

      - id: "fix-if-needed"
        if:
          condition: "reviewResult.hasIssues === true"
          thenBranch:
            - id: "fix"
              task: "Fix issues found in review"
              tools: ["executeCommand", "readFile", "writeFile"]

      - id: "manual-approval"
        task: |
          Please review the changes and approve:
          - Type 'yes' to commit
          - Type 'no' to cancel
          - Type 'fix' to make additional changes
        tools: ["askFollowupQuestion"]
        output: "approval"

      - id: "commit-if-approved"
        if:
          condition: "approval.answer === 'yes'"
          thenBranch:
            - id: "commit"
              task: "Create commit"
              tools: ["executeCommand"]
```

### Example 3: Smart Review with Context

Provide context for better reviews:

```typescript
// smart-review-commit.ts
export const smartReviewCommitWorkflow: WorkflowFn = async (input, context) => {
  const { step } = context

  // Review with context
  const reviewResult = await step('Review with context', async () => {
    return await review({
      context: `
        This is a bug fix for the authentication flow.
        Focus on:
        - Security implications
        - Error handling
        - Edge cases
        - Type safety
      `,
    }, context)
  })

  // Analyze severity
  const criticalIssues = reviewResult.specificReviews?.filter(
    r => r.severity === 'critical'
  ) ?? []

  if (criticalIssues.length > 0) {
    context.logger.error(`❌ Found ${criticalIssues.length} critical issues`)
    context.logger.error('Not committing. Please fix critical issues first.')
    return { committed: false, reason: 'critical-issues' }
  }

  // Commit if no critical issues
  await commit({}, context)
  return { committed: true }
}
```

---

## Best Practices

### 1. Start Simple

Begin with a shell script, then evolve to YAML or TypeScript as needed.

### 2. Use Loops Carefully

- Always set `maxIterations` in while loops
- Include sleep intervals in continuous workflows
- Provide clear exit conditions

### 3. Handle Errors

```typescript
try {
  await review({}, context)
} catch (error) {
  logger.error(`Review failed: ${error.message}`)
  // Decide: retry? skip? abort?
}
```

### 4. Log Progress

```yaml
- id: "log-progress"
  task: |
  Progress: {{ state.count }} / {{ state.maxIterations }}
  Commits: {{ state.commits }}
  Issues Fixed: {{ state.issuesFixed }}
  tools: ["executeCommand"]
```

### 5. Test Locally

```bash
# Dry run (don't commit)
bun run polka workflow -f examples/review-commit.yml --commitOnSuccess false

# Single iteration
bun run polka workflow -f examples/review-commit.yml --maxIterations 1
```

---

## Summary

| Method | Best For | Complexity | Flexibility |
|--------|----------|------------|-------------|
| **Shell Script** | Quick automation | Low | High |
| **YAML Workflow** | Declarative flows | Medium | Medium |
| **TypeScript** | Complex logic | High | Very High |
| **MCP Tools** | AI-powered | Low | Medium |

Choose the method that best fits your use case and skill level!
