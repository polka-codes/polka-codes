# Workflow Command - Looping Guide

The workflow command supports **declarative loops** defined in YAML, not CLI flags. This makes workflows more maintainable and easier to understand.

## Looping in YAML

### While Loops

Define loops directly in your workflow YAML:

```yaml
workflows:
  main:
    task: "My continuous workflow"

    steps:
      - id: "my-loop"
        while:
          condition: "state.count < state.max"
          steps:
            - id: "do-work"
              task: "Do some work"
              tools: ["executeCommand"]
              output: "result"

            - id: "update-state"
              task: "Update state for next iteration"
              tools: []
              output: "state"
```

### Loop Conditions

Conditions use JavaScript expressions:

```yaml
# Count-based loop
condition: "iteration.count < iteration.max"

# Boolean check
condition: "issues.count > 0"

# Complex condition
condition: "state.running && state.errors < 10"

# Unlimited loop (be careful!)
condition: "true"
```

### Breaking from Loops

Use `break` to exit a loop early:

```yaml
steps:
  - id: "check-stop-condition"
    if:
      condition: "state.shouldStop"
      thenBranch:
        - id: "break"
          break: true  # Exits the while loop
```

### Continuing Loops

Use `continue` to skip to next iteration:

```yaml
steps:
  - id: "skip-if-done"
    if:
      condition: "task.isComplete"
      thenBranch:
        - id: "continue"
          continue: true  # Skips to next iteration
```

## Practical Examples

### Example 1: Continuous Improvement

```yaml
workflows:
  main:
    task: "Continuously improve code"

    inputs:
      - id: "maxIterations"
        default: 0  # 0 = unlimited

    steps:
      - id: "init"
        task: "Initialize state"
        output: "state"

      - id: "improvement-loop"
        while:
          condition: "state.maxIterations === 0 || state.count < state.maxIterations"
          steps:
            - id: "check-build"
              task: "Run build"
              tools: ["executeCommand"]
              output: "buildResult"

            - id: "fix-if-needed"
              if:
                condition: "buildResult.hasErrors"
                thenBranch:
                  - id: "fix"
                    task: "Fix errors"
                    tools: ["executeCommand", "readFile", "writeFile"]

            - id: "increment"
              task: "Increment counter"
              output: "state"
```

**Usage:**
```bash
# Run unlimited iterations (Ctrl+C to stop)
polka workflow -f continuous-improvement.yml

# Run with specific max iterations
polka workflow -f continuous-improvement.yml "maxIterations: 10"
```

### Example 2: Task Discovery

```yaml
workflows:
  main:
    task: "Discover and fix issues"

    steps:
      - id: "discover"
        task: "Find all issues"
        tools: ["executeCommand"]
        output: "issues"

      - id: "fix-loop"
        while:
          condition: "issues.count > 0"
          steps:
            - id: "fix-one"
              task: "Fix one issue"
              tools: ["executeCommand", "readFile", "writeFile"]

            - id: "update-count"
              task: "Recount remaining issues"
              tools: ["executeCommand"]
              output: "issues"
```

**Usage:**
```bash
# Run until all issues are fixed
polka workflow -f task-discovery.yml
```

### Example 3: Polling

```yaml
workflows:
  main:
    task: "Poll for condition"

    inputs:
      - id: "maxAttempts"
        default: 60

      - id: "interval"
        default: 5000  # 5 seconds

    steps:
      - id: "poll-loop"
        while:
          condition: "attempt.count < attempt.max && !condition.met"
          steps:
            - id: "check-condition"
              task: "Check if condition is met"
              tools: ["executeCommand"]
              output: "condition"

            - id: "sleep"
              task: "Wait {{ interval }}ms"
              tools: []

            - id: "increment"
              task: "Increment attempt counter"
              output: "attempt"
```

**Usage:**
```bash
# Poll for up to 60 attempts (5 minutes)
polka workflow -f polling.yml
```

## Loop Safety

### Maximum Iterations

The workflow system enforces a maximum of 1000 iterations per while loop to prevent infinite loops:

```typescript
const MAX_WHILE_LOOP_ITERATIONS = 1000
```

If exceeded, you'll see:
```
Error: While loop 'my-loop' exceeded maximum iteration limit of 1000
```

### Breaking Out

Always provide a way to break out of loops:

```yaml
# Good: Has break condition
while:
  condition: "state.running"
  steps:
    - id: "check-stop"
      if:
        condition: "state.shouldStop"
        thenBranch:
          - break: true

# Bad: No way to stop (will hit max iterations)
while:
  condition: "true"  # Never stops!
  steps:
    - id: "work"
      task: "Do work"
```

## Best Practices

### 1. Initialize State

```yaml
steps:
  - id: "init"
    task: "Initialize loop state"
    output: "state"  # { count: 0, max: 10, running: true }

  - id: "loop"
    while:
      condition: "state.count < state.max"
      steps:
        # ... loop body
```

### 2. Update State in Loop

```yaml
steps:
  - id: "update-state"
    task: "Increment counter and update state"
    output: "state"  # { count: 1, max: 10, running: true }
```

### 3. Provide Exit Conditions

```yaml
while:
  condition: "state.running && state.count < state.max"
  #           ^^^^^^^^^^^^  ^^^^^^^^^^^^^^^^^^^^^^
  #           Can be set to  | Natural limit
  #           false to stop |
```

### 4. Log Progress

```yaml
steps:
  - id: "log"
    task: |
      Progress: {{ state.count }} / {{ state.max }}
      Remaining: {{ state.max - state.count }} iterations
    tools: ["executeCommand"]
```

## Comparison: Workflow vs Agent

| Aspect | Workflow (YAML) | Agent (Code) |
|--------|-----------------|--------------|
| **Loop definition** | `while:` in YAML | `while()` in TypeScript |
| **Condition** | JavaScript string expression | JavaScript code |
| **State** | Pass via `output:` | Automatic in agent context |
| **Clarity** | Declarative, easy to read | Programmatic, more flexible |
| **Use case** | Defined, repeatable processes | Dynamic, autonomous behavior |

## Summary

- ✅ **Loops are defined in YAML**, not CLI flags
- ✅ **Use `while:` for looping**, `if:` for branching
- ✅ **Conditions use JavaScript expressions**
- ✅ **Maximum 1000 iterations** for safety
- ✅ **Use `break:` and `continue:` for flow control**

The declarative approach makes workflows easier to understand, modify, and maintain compared to CLI flags or imperative code.
