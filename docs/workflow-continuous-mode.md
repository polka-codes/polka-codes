# Workflow Command - Continuous Mode

The workflow command now supports continuous execution modes that enable agent-like behavior without needing a separate agent command.

## Features

### Continuous Mode
Run a workflow continuously until manually stopped (Ctrl+C):

```bash
polka workflow -f my-workflow.yml --continuous
```

### Conditional Mode
Run a workflow until a condition is met:

```bash
polka workflow -f my-workflow.yml --until success
```

### Limited Iterations
Run a workflow for a specific number of iterations:

```bash
polka workflow -f my-workflow.yml --until success --max-iterations 10
```

### Custom Intervals
Control the sleep time between iterations:

```bash
polka workflow -f my-workflow.yml --continuous --interval 10000
```

## Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--file <path>` | `-f` | Path to workflow file (required) | - |
| `--workflow <name>` | `-w` | Name of workflow to run | `main` |
| `--continuous` | `-c` | Run continuously until stopped | `false` |
| `--until <condition>` | `-u` | Run until condition is met | - |
| `--interval <ms>` | `-i` | Sleep between iterations (ms) | `5000` |
| `--max-iterations <n>` | `-m` | Maximum iterations | `0` (unlimited) for `--continuous`, `100` for `--until` |

## Use Cases

### Continuous Integration
Continuously run tests and fix issues:

```bash
polka workflow -f examples/continuous-improvement.yml --continuous --interval 30000
```

This will:
1. Check for build errors
2. Run tests
3. Fix any issues found
4. Sleep for 30 seconds
5. Repeat

### Task Discovery
Discover and complete tasks autonomously:

```bash
polka workflow -f examples/task-discovery.yml --continuous
```

This will:
1. Discover issues in the codebase
2. Fix issues one by one
3. Verify each fix
4. Continue until no issues remain

### Bounded Improvement
Run improvement workflow with a limit:

```bash
polka workflow -f examples/continuous-improvement.yml --until success --max-iterations 5
```

This will:
1. Run the workflow up to 5 times
2. Stop if "success" condition is met
3. Sleep 5 seconds between iterations

## Comparison with Agent Command

| Feature | Workflow Command | Agent Command |
|---------|-----------------|---------------|
| Input format | YAML workflow file | `.polka.yml` config |
| Configuration | Declarative YAML | Programmatic TypeScript |
| State persistence | None | `.polka/agent-state` |
| Task discovery | Manual in workflow | Automatic |
| Plan management | None | Markdown plans in `plans/` |
| Safety systems | Via workflow steps | Built-in approvals |
| Use case | Defined, repeatable workflows | Autonomous exploration |

## When to Use Each

### Use Workflow Command When:
- You have a well-defined process to repeat
- You need declarative configuration
- You want to understand/modify the workflow easily
- You don't need complex state management
- You want to use YAML workflow files

### Use Agent Command When:
- You need autonomous task discovery
- You want plan file management
- You need complex state persistence
- You want safety approvals and monitoring
- You prefer programmatic configuration

## Examples

See the example workflow files:
- `examples/continuous-improvement.yml` - Continuous CI/CD workflow
- `examples/task-discovery.yml` - Autonomous task discovery

Both workflows can be run with:
```bash
# Continuous mode (unlimited)
polka workflow -f examples/continuous-improvement.yml --continuous

# Bounded mode (10 iterations max)
polka workflow -f examples/task-discovery.yml --until success --max-iterations 10

# Fast iteration (1 second between runs)
polka workflow -f examples/continuous-improvement.yml --continuous --interval 1000
```
