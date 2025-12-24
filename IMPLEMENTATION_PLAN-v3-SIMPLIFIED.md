# Implementation Plan: Custom Workflow Scripts (SIMPLIFIED)

**Status:** Planning Phase - Simplified Based on Existing APIs
**Created:** 2025-12-24
**Revised:** 2025-12-24
**Priority:** High

## 🎯 Key Simplification

**Discovery:** The CLI package already exposes all necessary APIs through `packages/cli/src/api.ts`!

**Implications:**
- ❌ **NO** new `@polka-codes/api` package needed
- ✅ Scripts can import directly from `@polka-codes/cli`
- ✅ All workflows already available: `code`, `commit`, `createPr`, `reviewCode`, `fix`, `plan`, `epic`
- ✅ Simplifies implementation significantly

---

## Revised Architecture

### Available APIs (Already Exported)

```typescript
// packages/cli/src/api.ts - Already available!

export { commit } from './api'           // Create commit
export { createPr } from './api'         // Create PR
export { code } from './api'             // Code workflow
export { reviewCode } from './api'       // Review code
export { fix } from './api'              // Fix issues
export { plan } from './api'             // Plan tasks
export { epic } from './api'             // Epic workflow
```

### Script Usage

```typescript
// scripts/my-script.ts
import { code, commit, executeCommand } from '@polka-codes/cli'
import { readFile, writeFile } from '@polka-codes/core'

export async function main(args: string[]) {
  // Use existing APIs
  await code({ task: 'Add feature', interactive: false })
  await commit({ all: true, context: 'Feature complete' })
}
```

---

## Implementation Tasks (Simplified)

### Phase 1: Core Infrastructure (Days 1-2)

#### Task 1.1: Extend Config Schema
**Priority:** P0 (Critical)
**Estimate:** 2 hours

Update config schema to support TypeScript scripts:

```typescript
// packages/core/src/config.ts
export const scriptSchema = z.union([
  z.string(),  // Shell command (backward compatible)
  z.object({
    command: z.string(),
    description: z.string(),
  }),
  z.object({
    workflow: z.string(),  // Path to workflow YAML
    description: z.string().optional(),
    input: z.record(z.string(), z.any()).optional(),
  }).strict(),
  z.object({
    script: z.string(),  // Path to TypeScript file
    description: z.string().optional(),
    permissions: z.object({
      fs: z.enum(['read', 'write', 'none']).optional(),
      network: z.boolean().optional(),
      subprocess: z.boolean().optional(),
    }).optional(),
    timeout: z.number().optional(),
  }).strict(),
])
```

---

#### Task 1.2: Script Validator
**Priority:** P0 (Critical)
**Estimate:** 2 hours

Create security validation:

```typescript
// packages/cli/src/script/validator.ts
export function validateScriptPath(
  scriptPath: string,
  projectRoot: string = process.cwd()
): void {
  const resolved = resolve(projectRoot, scriptPath)

  // Prevent path traversal
  if (relative(projectRoot, resolved).startsWith('..')) {
    throw new Error(`Script path outside project: ${scriptPath}`)
  }

  // Check file exists
  if (!existsSync(resolved)) {
    throw new Error(`Script not found: ${scriptPath}`)
  }

  // Check extension
  if (!scriptPath.endsWith('.ts') && !scriptPath.endsWith('.yml')) {
    throw new Error(`Script must be .ts or .yml: ${scriptPath}`)
  }
}
```

---

#### Task 1.3: Script Runner (In-Process)
**Priority:** P0 (Critical)
**Estimate:** 4 hours

Create in-process script runner:

```typescript
// packages/cli/src/script/runner.ts
export class ScriptRunner {
  async execute(options: {
    scriptPath: string
    args: string[]
    context: ExecutionContext
    logger: Logger
    timeout?: number
  }): Promise<any> {
    // 1. Validate path
    validateScriptPath(options.scriptPath)

    // 2. Load module
    const scriptModule = await import(options.scriptPath)

    // 3. Execute with timeout
    return await this.withTimeout(options.timeout ?? 300000, async () => {
      // Scripts use existing CLI APIs, no injection needed!
      return await scriptModule.main(options.args)
    })
  }

  private withTimeout<T>(ms: number, fn: () => Promise<T>): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
      ),
    ])
  }
}
```

---

### Phase 2: Command Router (Days 3-4)

#### Task 2.1: Enhanced Meta Command
**Priority:** P0 (Critical)
**Estimate:** 3 hours

Update command detection logic:

```typescript
// packages/cli/src/commands/meta.ts (REVISED)

export async function runMeta(task: string | undefined, command: Command) {
  const epicContext = await loadEpicContext()
  const logger = createLogger({ verbose })

  // Priority 1: Resume epic if exists
  if (epicContext.task) {
    if (task) {
      logger.error('Error: Existing epic context found.')
      logger.info(`Current task: ${epicContext.task}`)
      logger.info('Use "polka epic --clear" to start a new task.')
      return
    }
    logger.info('Resuming epic session...')
    // ... resume epic logic
    return
  }

  // Priority 2: Check if input is a command
  if (task) {
    const words = task.trim().split(/\s+/)

    // Single word = command
    if (words.length === 1) {
      const matched = await tryExecuteCommand(words[0], logger)
      if (matched) return

      logger.error(`Error: Unknown command '${words[0]}'`)
      logger.info('Available commands:')
      logger.info('  Built-in: code, commit, pr, review, fix, plan, workflow')
      // List custom scripts from config
      return
    }

    // Multi-word: must be >2 words
    if (words.length <= 2) {
      logger.error('Error: Task must be more than 2 words.')
      logger.info('  For commands: polka <command>')
      logger.info('  For tasks: polka "detailed task description"')
      return
    }

    // Start new epic with task
    epicContext.task = task
    // ... epic logic
    return
  }

  // Priority 3: Prompt for input
  const input = await getUserInput('What do you want to work on?')
  // ... process input
}

async function tryExecuteCommand(
  commandName: string,
  logger: Logger
): Promise<boolean> {
  // Check built-in commands
  const builtInCommands = ['code', 'commit', 'pr', 'review', 'fix', 'plan', 'workflow']
  if (builtInCommands.includes(commandName)) {
    // Execute via subprocess
    const { executeCommand } = await import('@polka-codes/cli-shared')
    await executeCommand({ command: 'bun', args: ['run', 'cli', commandName] })
    return true
  }

  // Check custom scripts
  const config = await loadConfig()
  const script = config?.scripts?.[commandName]
  if (script) {
    await executeScript(script, commandName, logger)
    return true
  }

  return false
}

async function executeScript(
  script: ScriptConfig,
  name: string,
  logger: Logger
) {
  const runner = new ScriptRunner()

  // Determine script type and execute
  if (typeof script === 'string') {
    // Shell command
    const { executeCommand } = await import('@polka-codes/cli-shared')
    await executeCommand({ command: script, shell: true })
  } else if ('command' in script) {
    // Shell command with description
    const { executeCommand } = await import('@polka-codes/cli-shared')
    await executeCommand({ command: script.command, shell: true })
  } else if ('workflow' in script) {
    // Dynamic workflow YAML
    await executeWorkflow(script.workflow, script.input)
  } else if ('script' in script) {
    // TypeScript script
    await runner.execute({
      scriptPath: script.script,
      args: [],
      context: {},
      logger,
      timeout: script.timeout,
    })
  }
}
```

---

#### Task 2.2: Run Command
**Priority:** P1 (High)
**Estimate:** 2 hours

Create explicit run command:

```typescript
// packages/cli/src/commands/run.ts
export const runCommand = new Command('run')
  .description('Run custom scripts')
  .argument('[script-name]', 'Name of the script to run')
  .option('--list', 'List all available scripts')
  .option('--args <args...>', 'Arguments to pass to the script')
  .action(async (scriptName, options, command: Command) => {
    const globalOpts = (command.parent ?? command).opts()
    const logger = createLogger({ verbose: globalOpts.verbose })

    const config = await loadConfig()

    if (options.list) {
      console.log('Available scripts:')
      for (const [name, script] of Object.entries(config?.scripts ?? {})) {
        const desc = getDescription(script)
        console.log(`  ${name}: ${desc}`)
      }
      return
    }

    if (!scriptName) {
      logger.error('Error: No script name provided')
      process.exit(1)
    }

    const script = config?.scripts?.[scriptName]
    if (!script) {
      logger.error(`Error: Script '${scriptName}' not found`)
      process.exit(1)
    }

    await executeScript(script, scriptName, logger)
  })
```

---

### Phase 3: Integration & Polish (Days 5-6)

#### Task 3.1: Update getDefaultContext
**Priority:** P1 (High)
**Estimate:** 1 hour

Fix config schema conflict:

```typescript
// packages/cli/src/workflows/workflow.utils.ts
function formatScriptForContext(script: ScriptConfig): string {
  if (typeof script === 'string') {
    return script
  }
  if ('command' in script) {
    return `${script.command} (${script.description})`
  }
  if ('workflow' in script) {
    return `workflow:${script.workflow} (${script.description ?? 'Custom workflow'})`
  }
  if ('script' in script) {
    return `script:${script.script} (${script.description ?? 'TypeScript script'})`
  }
  return 'unknown'
}
```

---

#### Task 3.2: Script Generator
**Priority:** P2 (Medium)
**Estimate:** 2 hours

Add script generation:

```typescript
// packages/cli/src/commands/init.ts (extend)
export const initCommand = new Command('init')
  .argument('[type]', 'Type of resource (config, script)')
  .argument('[name]', 'Name of script')
  .action(async (type, name, options, command) => {
    if (type === 'script') {
      await createScript(name)
      return
    }
    // ... existing init logic
  })

async function createScript(name: string) {
  const scriptPath = `.polka-scripts/${name}.ts`

  const template = `// Generated by polka.codes
import { code, commit, createLogger } from '@polka-codes/cli'

const logger = createLogger({ verbose: 1 })

export async function main(args: string[]) {
  logger.info('Running script: ${name}')

  // Your automation here
  // Example: await code({ task: 'Add feature', interactive: false })
}

main(process.argv.slice(2))
`

  await writeFile(scriptPath, template)

  // Add to .polkacodes.yml
  // ...
}
```

---

#### Task 3.3: Documentation
**Priority:** P1 (High)
**Estimate:** 3 hours

Create user guide:

```markdown
# Custom Scripts Guide

## Quick Start

1. Create a script:
   \`\`\`bash
   polka init script my-script
   \`\`\`

2. Edit the script:
   \`\`\`typescript
   import { code, commit } from '@polka-codes/cli'

   export async function main(args: string[]) {
     await code({ task: 'Add feature' })
     await commit({ all: true })
   }
   \`\`\`

3. Add to config:
   \`\`\`yaml
   scripts:
     my-script:
       script: .polka-scripts/my-script.ts
       description: My automation
   \`\`\`

4. Run it:
   \`\`\`bash
   polka run my-script
   # or
   polka my-script  # single-word command
   \`\`\`

## Available APIs

All exported from \`@polka-codes/cli\`:
- \`code()\` - Code workflow
- \`commit()\` - Create commit
- \`createPr()\` - Create PR
- \`reviewCode()\` - Review code
- \`fix()\` - Fix issues
- \`plan()\` - Plan tasks
- \`epic()\` - Epic workflow
\`
```

---

### Phase 4: Testing (Days 7-8)

#### Task 4.1: Unit Tests
**Priority:** P1 (High)
**Estimate:** 3 hours

Test coverage:
- [ ] Config schema validation
- [ ] Path validation
- [ ] Script runner
- [ ] Command detection logic

#### Task 4.2: Integration Tests
**Priority:** P1 (High)
**Estimate:** 3 hours

Test scenarios:
- [ ] Execute TypeScript script
- [ ] Execute workflow YAML
- [ ] Execute shell command
- [ ] Command detection with epic context
- [ ] Permission enforcement

---

## Updated Config Schema

```yaml
# .polkacodes.yml
scripts:
  # Shell commands (backward compatible)
  lint: bun run lint
  test:
    command: bun test
    description: Run tests

  # Dynamic workflow (leverage existing system)
  review:
    workflow: ./workflows/review.yml
    description: Review PR

  # TypeScript script (NEW - use existing CLI APIs!)
  deploy:
    script: ./scripts/deploy.ts
    description: Deploy to production
    permissions:
      fs: write
      network: true
      subprocess: true
    timeout: 600000

  # Simple automation
  format:
    script: .polka-scripts/format.ts
    description: Format code
```

---

## Example Scripts

### Example 1: Simple Script

```typescript
// .polka-scripts/hello.ts
import { createLogger } from '@polka-codes/cli'

const logger = createLogger({ verbose: 1 })

export async function main(args: string[]) {
  logger.info('Hello from custom script!')
  console.log('Args:', args)
}

main(process.argv.slice(2))
```

### Example 2: Workflow Automation

```typescript
// .polka-scripts/full-pr.ts
import { code, commit, createPr, reviewCode } from '@polka-codes/cli'
import { executeCommand } from '@polka-codes/core'

export async function main() {
  // Run tests
  await executeCommand({ command: 'bun', args: ['test'] })

  // Fix any issues
  await fix({ task: 'Fix test failures', interactive: false })

  // Commit
  await commit({ all: true, context: 'Ready for review' })

  // Create PR
  await createPr({ context: 'Feature complete' })

  // Review
  await reviewCode()
}
```

### Example 3: Custom Workflow

```typescript
// .polka-scripts/refactor.ts
import { code } from '@polka-codes/cli'

export async function main(args: string[]) {
  const target = args[0] || 'src/**/*.ts'

  await code({
    task: 'Refactor for better performance',
    file: [target],
    interactive: false
  })
}
```

---

## Timeline (Simplified)

| Phase | Tasks | Duration |
|-------|-------|----------|
| Phase 1: Core | 3 tasks (Config, Validator, Runner) | 2 days |
| Phase 2: Commands | 2 tasks (Meta, Run) | 2 days |
| Phase 3: Integration | 3 tasks (Context, Generator, Docs) | 2 days |
| Phase 4: Testing | 2 tasks (Unit, Integration) | 2 days |
| **Total** | **10 tasks** | **8 days** |

**Savings:** 2 days shorter than original revised plan!

---

## Key Advantages of Simplified Approach

1. ✅ **No new package** - Use existing `@polka-codes/cli`
2. ✅ **Faster implementation** - 8 days vs 10 days
3. ✅ **Simpler architecture** - Less code to maintain
4. ✅ **Better consistency** - Same APIs as programmatic usage
5. ✅ **Easier to learn** - One API surface to understand

---

## What Changed from v2 Plan

| Component | v2 Plan | Simplified Plan |
|-----------|---------|-----------------|
| API Package | New `@polka-codes/api` package | Use existing `@polka-codes/cli` |
| Dependency Injection | Create API with injected deps | Scripts use existing functions directly |
| Task Count | 13 tasks | 10 tasks |
| Duration | 10 days | 8 days |
| Complexity | High | Low |

---

## Success Criteria

- [x] Epic context resumption works
- [x] Scripts use existing CLI APIs
- [x] Security validation in place
- [x] Command detection with epic priority
- [x] Backward compatibility maintained
- [x] Test coverage > 80%
- [x] Documentation complete

---

## Next Steps

1. ✅ **Review simplified plan** - Even better than v2!
2. ✅ **Start Task 1.1** - Extend config schema
3. ✅ **Implement in 8 days** - Faster timeline

---

**Recommendation:** Proceed with simplified plan

**Timeline:** 8 working days

**First Task:** Task 1.1 - Extend Config Schema
