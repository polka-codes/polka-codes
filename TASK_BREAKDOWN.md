# Task Breakdown: Custom Workflow Scripts

**Parent Document:** [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)
**Last Updated:** 2025-12-24

## Quick Start

Run these tasks in order. Each task has dependencies and acceptance criteria.

---

## Phase 1: Core Infrastructure

### Task 1.1: Extend Config Schema
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 2 hours
**Dependencies:** None

**Description:**
Update the Zod schema to support TypeScript script files while maintaining backward compatibility with existing shell script formats.

**Implementation Steps:**
1. Open `packages/core/src/config.ts`
2. Locate the `scripts` schema definition (around line 64)
3. Replace with new union type that supports:
   - String (shell command)
   - Object with `command` and `description`
   - Object with `file`, `description`, and `args`
4. Add new TypeScript type `ScriptConfig`
5. Export new type from package

**Code Changes:**
```typescript
// packages/core/src/config.ts

export const scriptSchema = z.union([
  // Simple shell command (backward compatible)
  z.string(),
  // Object with command and description (backward compatible)
  z.object({
    command: z.string(),
    description: z.string(),
  }),
  // TypeScript script file (NEW)
  z.object({
    file: z.string(),
    description: z.string().optional(),
    args: z.array(z.string()).optional(),
  }).strict(),
])

export type ScriptConfig = z.infer<typeof scriptSchema>

// Update configSchema
scripts: z.record(z.string(), scriptSchema).optional(),
```

**Acceptance Criteria:**
- [ ] Schema validates all three formats correctly
- [ ] Old config files still parse without errors
- [ ] New TypeScript script format is accepted
- [ ] TypeScript types are exported
- [ ] All existing tests pass

**Tests:**
```typescript
describe('ScriptConfig', () => {
  it('should accept string command', () => {
    const result = scriptSchema.parse('bun test')
    expect(result).toBe('bun test')
  })

  it('should accept object with command', () => {
    const result = scriptSchema.parse({
      command: 'bun test',
      description: 'Run tests'
    })
    expect(result).toEqual({
      command: 'bun test',
      description: 'Run tests'
    })
  })

  it('should accept TypeScript script', () => {
    const result = scriptSchema.parse({
      file: './scripts/test.ts',
      description: 'Run custom tests'
    })
    expect(result).toEqual({
      file: './scripts/test.ts',
      description: 'Run custom tests'
    })
  })
})
```

---

### Task 1.2: Create Script Runtime
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 4 hours
**Dependencies:** Task 1.1

**Description:**
Create a runtime system that can load and execute TypeScript scripts using Bun, providing them with access to the CLI API.

**Implementation Steps:**
1. Create `packages/cli/src/script/` directory
2. Create `runner.ts` with `ScriptRunner` class
3. Implement script loading with Bun
4. Create execution context with available APIs
5. Add error handling and timeout support

**File Structure:**
```
packages/cli/src/script/
├── runner.ts       # ScriptRunner class
├── context.ts      # ExecutionContext setup
└── errors.ts       # Script-specific errors
```

**Code Skeleton:**
```typescript
// packages/cli/src/script/runner.ts

import { spawn } from 'node:child_process'

export interface ScriptExecutionOptions {
  scriptPath: string
  args: string[]
  timeout?: number
  cwd?: string
}

export class ScriptExecutionError extends Error {
  constructor(
    public scriptPath: string,
    public exitCode: number,
    public stderr: string
  ) {
    super(`Script ${scriptPath} failed with exit code ${exitCode}`)
  }
}

export class ScriptRunner {
  async execute(options: ScriptExecutionOptions): Promise<string> {
    const { scriptPath, args, timeout = 300000, cwd = process.cwd() } = options

    // Validate script exists
    // Execute with Bun runtime
    // Capture stdout/stderr
    // Handle timeout
    // Return result or throw error
  }

  private validateScriptPath(path: string): void {
    // Check file exists
    // Check file extension (.ts)
    // Validate path is within project
  }
}
```

**Acceptance Criteria:**
- [ ] Scripts can be executed with Bun
- [ ] Script errors are caught and reported
- [ ] Timeout is enforced (default 5 minutes)
- [ ] Script output is captured and returned
- [ ] Invalid script paths are rejected
- [ ] Scripts run in correct working directory

---

### Task 1.3: Define Script API Module
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 3 hours
**Dependencies:** Task 1.2

**Description:**
Create a public API module that custom scripts can import, providing access to workflows, tools, and utilities.

**Implementation Steps:**
1. Create `packages/cli/src/script/api.ts`
2. Re-export CLI workflow functions
3. Re-export core tools
4. Re-export utilities (zod, inquirer, logger)
5. Create type definitions file

**File Structure:**
```typescript
// packages/cli/src/script/api.ts

// Workflows
export { code, commit, pr, review, fix, plan, epic } from '../api'

// Tools
export {
  readFile, writeFile, replaceInFile,
  executeCommand, searchFiles,
  listFiles, removeFile, renameFile,
  fetchUrl
} from '@polka-codes/core'

// Utilities
export { z } from 'zod'
export {
  confirm,
  input,
  select,
  checkbox
} from '@inquirer/prompts'
export { createLogger } from '../logger'

// Config
export { loadConfig } from '@polka-codes/cli-shared'
```

**Usage Example:**
```typescript
// scripts/my-script.ts
import { code, executeCommand, createLogger } from '@polka-codes/script'

const logger = createLogger({ verbose: 1 })

export async function main(args: string[]) {
  logger.info('Starting script...')
  await code({ task: 'Add feature' })
}
```

**Acceptance Criteria:**
- [ ] All workflows are exported
- [ ] All tools are exported
- [ ] Types are properly inferred
- [ ] Module can be imported in TypeScript files
- [ ] Documentation comments are present

---

## Phase 2: Command Implementation

### Task 2.1: Create `run` Command
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 4 hours
**Dependencies:** Task 1.2, Task 1.3

**Description:**
Implement the `polka run <script-name>` command that can execute custom scripts defined in the config.

**Implementation Steps:**
1. Create `packages/cli/src/commands/run.ts`
2. Define command options (`--list`, `--args`)
3. Implement script lookup from config
4. Execute script using ScriptRunner
5. Handle errors and display output

**Code Skeleton:**
```typescript
// packages/cli/src/commands/run.ts

import { Command } from 'commander'
import { loadConfig } from '@polka-codes/cli-shared'
import { ScriptRunner } from '../script/runner'
import { createLogger } from '../logger'

export const runCommand = new Command('run')
  .description('Run custom scripts defined in .polkacodes.yml')
  .argument('[script-name]', 'Name of the script to run')
  .option('--list', 'List all available scripts')
  .option('--args <args...>', 'Arguments to pass to the script')
  .action(async (scriptName, options, command: Command) => {
    const globalOpts = (command.parent ?? command).opts()
    const logger = createLogger({ verbose: globalOpts.verbose })

    // Load config
    const config = await loadConfig(undefined, process.cwd())

    if (options.list) {
      // List all scripts
      return
    }

    if (!scriptName) {
      logger.error('Error: No script name provided')
      logger.info('Available scripts:')
      // List scripts
      process.exit(1)
    }

    // Find script in config
    const scriptConfig = config?.scripts?.[scriptName]
    if (!scriptConfig) {
      logger.error(`Error: Script '${scriptName}' not found`)
      process.exit(1)
    }

    // Execute script
    const runner = new ScriptRunner()
    try {
      const result = await runner.execute({
        scriptPath: typeof scriptConfig === 'string'
          ? scriptConfig
          : 'file' in scriptConfig
            ? scriptConfig.file
            : scriptConfig.command,
        args: options.args ?? ('args' in scriptConfig ? scriptConfig.args ?? [] : []),
      })
      logger.info(result)
    } catch (error) {
      logger.error('Script execution failed:', error)
      process.exit(1)
    }
  })
```

**Acceptance Criteria:**
- [ ] `polka run <script>` executes the script
- [ ] `polka run --list` shows all available scripts
- [ ] Arguments are passed correctly to scripts
- [ ] Errors are displayed clearly
- [ ] Exit code reflects script success/failure

---

### Task 2.2: Update Meta Command
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 3 hours
**Dependencies:** Task 1.1

**Description:**
Modify the default command to detect single-word input and treat it as a command (built-in or custom), requiring >2 words for task input.

**Implementation Steps:**
1. Open `packages/cli/src/commands/meta.ts`
2. Add word count validation to task input
3. If single word, treat as command lookup
4. Check built-in commands first
5. Fall back to custom scripts in config
6. Show helpful error if command not found

**Code Changes:**
```typescript
// packages/cli/src/commands/meta.ts

export async function runMeta(task: string | undefined, command: Command) {
  const globalOpts = (command.parent ?? command).opts()
  const { verbose } = globalOpts
  const logger = createLogger({ verbose })

  let taskInput = task
  const epicContext = await loadEpicContext()

  if (epicContext.task) {
    // ... existing epic session logic
  } else {
    if (!taskInput) {
      taskInput = await getUserInput('What feature or task do you want to implement?')
      if (!taskInput) {
        logger.info('No task provided. Exiting.')
        return
      }
    }

    // NEW: Check if input is a single word
    const words = taskInput.trim().split(/\s+/)
    if (words.length === 1) {
      await handleCommand(words[0], logger, globalOpts)
      return
    }

    // NEW: Require more than 2 words for task
    if (words.length <= 2) {
      logger.error('Error: Task description must be more than 2 words.')
      logger.info('If you meant to run a command, use: polka <command>')
      logger.info('Or provide a detailed task description.')
      return
    }

    epicContext.task = taskInput
  }

  // ... rest of existing logic
}

// NEW: Handle command execution
async function handleCommand(
  commandName: string,
  logger: Logger,
  globalOpts: any
) {
  const config = await loadConfig()

  // Check if it's a built-in command
  const builtInCommands = ['code', 'commit', 'pr', 'review', 'fix', 'plan', 'epic', 'init', 'workflow']
  if (builtInCommands.includes(commandName)) {
    logger.info(`Running built-in command: ${commandName}`)
    logger.info(`Use 'polka ${commandName}' directly for better experience`)
    // Execute built-in command
    return
  }

  // Check if it's a custom script
  const scriptConfig = config?.scripts?.[commandName]
  if (scriptConfig) {
    logger.info(`Running custom script: ${commandName}`)
    // Execute script
    return
  }

  // Command not found
  logger.error(`Error: Command '${commandName}' not found`)
  logger.info('Available commands:')
  // List built-in and custom commands
}
```

**Acceptance Criteria:**
- [ ] Single-word input triggers command lookup
- [ ] Built-in commands are recognized
- [ ] Custom scripts from config are recognized
- [ ] Multi-word input (>2 words) treated as task
- [ ] Clear error messages for invalid commands
- [ ] Help text shows available commands

---

### Task 2.3: Register Commands
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 1 hour
**Dependencies:** Task 2.1

**Description:**
Register the new `run` command in the main CLI entry point.

**Implementation Steps:**
1. Open `packages/cli/src/index.ts`
2. Import `runCommand`
3. Add to program using `program.addCommand()`
4. Update help text if needed

**Code Changes:**
```typescript
// packages/cli/src/index.ts

import { runCommand } from './commands/run'

// ... existing imports

// ... existing command registrations

// Add run command
program.addCommand(runCommand)

addSharedOptions(program)
```

**Acceptance Criteria:**
- [ ] `polka run --help` works
- [ ] Command appears in `polka --help`
- [ ] All existing commands still work

---

## Phase 3: Tooling & Developer Experience

### Task 3.1: Script Generator
**Status:** 🔲 Not Started
**Priority:** P2 (Medium)
**Estimate:** 3 hours
**Dependencies:** Task 1.1, Task 2.1

**Description:**
Add ability to generate new script templates via `polka init script <name>`.

**Implementation Steps:**
1. Extend `init.ts` to add `script` subcommand
2. Create script template generator
3. Add script to `.polkacodes.yml`
4. Create script file with boilerplate

**Code Changes:**
```typescript
// packages/cli/src/commands/init.ts

import { writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export const initCommand = new Command('init')
  .description('Initialize polkacodes configuration')
  .option('-g, --global', 'Use global config')
  .argument('[type]', 'Type of resource to init (config, script)')
  .argument('[name]', 'Name of script (if type is script)')
  .action(async (type, name, options, command: Command) => {
    // ... existing init logic

    if (type === 'script') {
      if (!name) {
        logger.error('Error: Script name is required')
        logger.info('Usage: polka init script <name>')
        process.exit(1)
      }
      await createScript(name, logger)
      return
    }

    // ... rest of existing init logic
  })

async function createScript(name: string, logger: Logger) {
  const scriptsDir = join(process.cwd(), '.polka-scripts')
  const scriptPath = join(scriptsDir, `${name}.ts`)

  // Create scripts directory
  await mkdir(scriptsDir, { recursive: true })

  // Generate script template
  const template = `// Generated by polka.codes
import { code, executeCommand, createLogger } from '@polka-codes/script'

const logger = createLogger({ verbose: 1 })

export async function main(args: string[]) {
  logger.info('Running script: ${name}')

  // Your code here
  // Example: await code({ task: 'Add feature' })
}

// Run the script
main(process.argv.slice(2))
`

  await writeFile(scriptPath, template, 'utf-8')
  logger.info(\`Created script: \${scriptPath}\`)

  // Update .polkacodes.yml
  const configPath = join(process.cwd(), '.polkacodes.yml')
  // Add script to config...
}
```

**Acceptance Criteria:**
- [ ] `polka init script <name>` creates script file
- [ ] Script is added to `.polkacodes.yml`
- [ ] Generated script has correct imports
- [ ] Script template includes helpful comments

---

### Task 3.2: Documentation
**Status:** 🔲 Not Started
**Priority:** P2 (Medium)
**Estimate:** 4 hours
**Dependencies:** Task 1.3, Task 2.1

**Description:**
Create comprehensive documentation for custom scripts feature.

**Implementation Steps:**
1. Create `docs/custom-scripts.md`
2. Document config schema
3. Provide API reference
4. Create example scripts
5. Add troubleshooting guide

**Documentation Outline:**
```markdown
# Custom Scripts Guide

## Overview
## Quick Start
## Configuration
## Script API Reference
## Examples
## Best Practices
## Troubleshooting
```

**Acceptance Criteria:**
- [ ] Guide is comprehensive and clear
- [ ] At least 5 example scripts provided
- [ ] API reference is complete
- [ ] Troubleshooting section covers common issues

---

## Phase 4: Testing

### Task 4.1: Unit Tests
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours
**Dependencies:** Task 1.1, Task 1.2, Task 2.2

**Test Files to Create:**
```
packages/cli/src/script/
├── runner.test.ts
├── context.test.ts
└── api.test.ts

packages/cli/src/commands/
└── run.test.ts

packages/core/src/
└── config.test.ts (extend)
```

**Test Coverage Goals:**
- Config schema validation: 100%
- Script runner: 90%+
- Command detection: 95%+
- Overall: >80%

---

### Task 4.2: Integration Tests
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours
**Dependencies:** All previous tasks

**Test Scenarios:**
1. Create script → Add to config → Run via CLI → Verify output
2. Script that calls CLI API → Verify execution
3. Script with arguments → Verify args received
4. Script that errors → Verify error handling
5. Backward compatibility → Old shell scripts still work

---

## Task Dependencies Graph

```
Task 1.1 (Config Schema)
    ├─→ Task 1.2 (Script Runtime)
    │       └─→ Task 1.3 (Script API)
    │               └─→ Task 2.1 (run Command)
    │                       ├─→ Task 2.3 (Register Commands)
    │                       └─→ Task 3.1 (Script Generator)
    └─→ Task 2.2 (Update Meta Command)
            └─→ Task 4.1 (Unit Tests)

Task 2.1 ──→ Task 4.2 (Integration Tests)
Task 3.1 ──→ Task 3.2 (Documentation)
```

---

## Progress Tracking

### Phase 1: Core Infrastructure
- [ ] Task 1.1: Extend Config Schema (2h)
- [ ] Task 1.2: Create Script Runtime (4h)
- [ ] Task 1.3: Define Script API Module (3h)
**Total: 9h (2 days)**

### Phase 2: Command Implementation
- [ ] Task 2.1: Create `run` Command (4h)
- [ ] Task 2.2: Update Meta Command (3h)
- [ ] Task 2.3: Register Commands (1h)
**Total: 8h (2 days)**

### Phase 3: Tooling & DX
- [ ] Task 3.1: Script Generator (3h)
- [ ] Task 3.2: Documentation (4h)
**Total: 7h (2 days)**

### Phase 4: Testing
- [ ] Task 4.1: Unit Tests (4h)
- [ ] Task 4.2: Integration Tests (4h)
**Total: 8h (2 days)**

**Grand Total: 32 hours (8 working days)**

---

## Quick Reference

### File Locations
- Config Schema: `packages/core/src/config.ts`
- Run Command: `packages/cli/src/commands/run.ts`
- Meta Command: `packages/cli/src/commands/meta.ts`
- Script Runner: `packages/cli/src/script/runner.ts`
- Script API: `packages/cli/src/script/api.ts`

### Key Commands
```bash
# Test config changes
bun test packages/core/src/config.test.ts

# Test script runner
bun test packages/cli/src/script/runner.test.ts

# Test run command
bun run cli run test-script

# Test meta command
bun run cli "single word"  # Should trigger command lookup
bun run cli "multi word task description"  # Should work as task
```

### Git Workflow
```bash
# Create feature branch
git checkout -b feature/custom-scripts

# After completing each phase
git add .
git commit -m "feat: implement phase X - description"

# Push and create PR when complete
git push origin feature/custom-scripts
```

---

## Notes

- Keep backward compatibility as a top priority
- Run tests after each task completion
- Update this document as you discover new requirements
- Ask for clarification if any task is unclear
