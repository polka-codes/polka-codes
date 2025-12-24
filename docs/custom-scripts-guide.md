# Custom Scripts - Quick Reference

**For Users:** How to create and use custom scripts
**For Developers:** Implementation quick reference

---

## User Guide

### What are Custom Scripts?

Custom scripts are TypeScript files that can automate polka-codes workflows. They have full access to the CLI API, tools, and utilities.

### Quick Start

1. **Create a script**
   ```bash
   polka init script my-script
   ```

2. **Edit the script**
   ```typescript
   // .polka-scripts/my-script.ts
   import { code, createLogger } from '@polka-codes/script'

   const logger = createLogger({ verbose: 1 })

   export async function main(args: string[]) {
     logger.info('Running my script...')
     await code({ task: 'Add feature X' })
   }

   main(process.argv.slice(2))
   ```

3. **Run the script**
   ```bash
   polka run my-script
   ```

### Configuration

Add scripts to `.polkacodes.yml`:

```yaml
scripts:
  # Shell command (backward compatible)
  test: bun test

  # TypeScript script (new)
  deploy:
    file: ./scripts/deploy.ts
    description: Deploy to production
    args: [--production]
```

### Available Commands

```bash
# List all scripts
polka run --list

# Run a script
polka run <script-name>

# Run script with arguments
polka run deploy -- --force

# Run as command (single word)
polka deploy
```

---

## Developer Guide

### Architecture Overview

```
polka <input>
    │
    ├─ Single word → Command lookup
    │   ├─ Built-in commands (code, commit, pr, etc.)
    │   └─ Custom scripts (from config.scripts)
    │
    └─ Multi-word (>2 words) → Task workflow
```

### Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/config.ts` | Config schema with scripts |
| `packages/cli/src/commands/run.ts` | `polka run` command |
| `packages/cli/src/commands/meta.ts` | Default command routing |
| `packages/cli/src/script/runner.ts` | Script execution runtime |
| `packages/cli/src/script/api.ts` | Public API for scripts |

### Implementation Checklist

#### Phase 1: Core (Days 1-2)
- [ ] Update `config.ts` schema (Task 1.1)
- [ ] Create `script/runner.ts` (Task 1.2)
- [ ] Create `script/api.ts` (Task 1.3)

#### Phase 2: Commands (Days 3-4)
- [ ] Create `commands/run.ts` (Task 2.1)
- [ ] Update `commands/meta.ts` (Task 2.2)
- [ ] Register in `index.ts` (Task 2.3)

#### Phase 3: DX (Days 5-6)
- [ ] Add script generator to `init.ts` (Task 3.1)
- [ ] Write documentation (Task 3.2)

#### Phase 4: Testing (Days 7-8)
- [ ] Write unit tests (Task 4.1)
- [ ] Write integration tests (Task 4.2)

### Code Snippets

#### Config Schema Update

```typescript
// packages/core/src/config.ts
export const scriptSchema = z.union([
  z.string(), // Shell command
  z.object({
    command: z.string(),
    description: z.string(),
  }),
  z.object({
    file: z.string(),
    description: z.string().optional(),
    args: z.array(z.string()).optional(),
  }).strict(),
])
```

#### Script Runtime

```typescript
// packages/cli/src/script/runner.ts
import { spawn } from 'node:child_process'

export class ScriptRunner {
  async execute(options: {
    scriptPath: string
    args: string[]
    timeout?: number
  }): Promise<string> {
    const { scriptPath, args, timeout = 300000 } = options

    return new Promise((resolve, reject) => {
      const proc = spawn('bun', ['run', scriptPath, ...args], {
        stdio: 'pipe',
        cwd: process.cwd(),
      })

      let stdout = ''
      let stderr = ''

      proc.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      proc.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      const timer = setTimeout(() => {
        proc.kill()
        reject(new Error('Script timeout'))
      }, timeout)

      proc.on('close', (code) => {
        clearTimeout(timer)
        if (code === 0) {
          resolve(stdout)
        } else {
          reject(new Error(`Script failed: ${stderr}`))
        }
      })
    })
  }
}
```

#### Command Detection

```typescript
// packages/cli/src/commands/meta.ts
function isCommand(input: string): boolean {
  return input.trim().split(/\s+/).length === 1
}

function isValidTask(input: string): boolean {
  return input.trim().split(/\s+/).length > 2
}
```

#### Run Command

```typescript
// packages/cli/src/commands/run.ts
export const runCommand = new Command('run')
  .argument('[script-name]')
  .option('--list', 'List available scripts')
  .action(async (scriptName, options) => {
    const config = await loadConfig()

    if (options.list) {
      Object.entries(config?.scripts ?? {}).forEach(([name, script]) => {
        console.log(`${name}: ${getDescription(script)}`)
      })
      return
    }

    const script = config?.scripts?.[scriptName]
    if (!script) {
      console.error(`Script not found: ${scriptName}`)
      process.exit(1)
    }

    const runner = new ScriptRunner()
    await runner.execute({
      scriptPath: getScriptPath(script),
      args: getScriptArgs(script),
    })
  })
```

### Testing

```bash
# Unit tests
bun test packages/cli/src/script/runner.test.ts

# Integration test
bun run cli run test-script

# Manual test
polka run --list
polka run deploy
```

---

## Examples

### Example 1: Simple Script

```typescript
// .polka-scripts/hello.ts
import { confirm } from '@polka-codes/script'

export async function main() {
  const answer = await confirm({ message: 'Continue?' })
  console.log(answer ? 'Yes!' : 'No!')
}

main()
```

### Example 2: Workflow Automation

```typescript
// .polka-scripts/full-pr.ts
import { commit, pr, review, executeCommand } from '@polka-codes/script'

export async function main() {
  // Run tests
  await executeCommand({ command: 'bun', args: ['test'] })

  // Commit changes
  await commit({ all: true, context: 'Feature complete' })

  // Create PR
  await pr({ context: 'Ready for review' })

  // Review code
  await review()
}

main()
```

### Example 3: Custom AI Task

```typescript
// .polka-scripts/refactor.ts
import { code, readFile, writeFile } from '@polka-codes/script'

export async function main(args: string[]) {
  const filePath = args[0]

  // Read file
  const content = await readFile(filePath)

  // Use AI to refactor
  await code({
    task: `Refactor this code for better performance`,
    file: [filePath]
  })
}

main(process.argv.slice(2))
```

---

## Migration Guide

### Before (Shell Scripts)
```yaml
scripts:
  deploy: npm run deploy
```

### After (TypeScript)
```yaml
scripts:
  deploy:
    file: ./scripts/deploy.ts
    description: Deploy to production
```

---

## Troubleshooting

### Script not found
```
Error: Script 'my-script' not found
```
**Solution:** Check `.polkacodes.yml` and ensure script is defined

### Script execution failed
```
Error: Script failed with exit code 1
```
**Solution:** Run script directly with `bun run .polka-scripts/script.ts` to see full error

### Module not found
```
Error: Cannot find module '@polka-codes/script'
```
**Solution:** Ensure `@polka-codes/cli` is installed and script API is exported

---

## Status: 📋 Planning

**Current Phase:** Ready to start implementation
**Next Task:** Task 1.1 - Extend Config Schema
**Target Completion:** 8 working days

---

**Related Documents:**
- [Implementation Plan](../IMPLEMENTATION_PLAN.md)
- [Task Breakdown](../TASK_BREAKDOWN.md)
