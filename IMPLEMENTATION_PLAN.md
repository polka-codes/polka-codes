# Implementation Plan: Custom Workflow Scripts

**Status:** Planning Phase
**Created:** 2025-12-24
**Priority:** High

## Overview

Add support for custom workflow scripts defined in `.polkacodes.yml` that can be executed via `polka run <command>`. This feature will enable users to create reusable automation scripts using TypeScript with full access to the polka-codes API.

## Table of Contents

1. [Requirements](#requirements)
2. [Architecture](#architecture)
3. [Configuration Schema Changes](#configuration-schema-changes)
4. [Implementation Tasks](#implementation-tasks)
5. [File Structure](#file-structure)
6. [API Design](#api-design)
7. [Examples](#examples)
8. [Testing Strategy](#testing-strategy)
9. [Migration Guide](#migration-guide)

---

## Requirements

### Functional Requirements

1. **Command Detection**
   - Default command (no arguments) must require input > 2 words
   - Single word input should be treated as a command
   - Commands can be built-in (code, commit, pr, etc.) or custom

2. **Custom Script Definition**
   - Scripts defined in `.polkacodes.yml` under `scripts` section
   - Support TypeScript files (`.ts` extension)
   - Scripts can import from CLI package APIs

3. **Script Execution**
   - New `polka run <script-name>` command
   - Scripts run with Bun runtime
   - Full access to: CLI API, zod, inquirer, node modules
   - Support for command-line arguments to scripts

4. **Script Capabilities**
   - Execute any workflow programmatically
   - Use all tools (readFile, writeFile, executeCommand, etc.)
   - Access to config, logger, provider
   - Interactive prompts support

### Non-Functional Requirements

1. **Type Safety**: Full TypeScript support with type definitions
2. **Performance**: Fast script startup and execution
3. **Error Handling**: Clear error messages for script failures
4. **Security**: Validate script paths and execution context
5. **DX**: Good IDE autocomplete for custom scripts

---

## Architecture

### Current State

```
polka [task]              -> runMeta() (epic workflow)
polka commit              -> commitCommand
polka code                -> codeCommand
polka init                -> initCommand
```

### Target State

```
polka                     -> Interactive prompt (requires >2 words for task)
polka <single-word>       -> Execute as command (built-in or custom)
polka run <script-name>   -> Execute custom script
polka run --list          -> List available scripts
```

### Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLI Entry Point                        │
│                    (packages/cli/src/index.ts)              │
└───────────────────────────┬─────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│ Built-in     │   │ Custom       │   │ Run          │
│ Commands     │   │ Commands     │   │ Command      │
│              │   │              │   │              │
│ - code       │   │ (meta.ts)    │   │ run.ts       │
│ - commit     │   │              │   │              │
│ - pr         │   │ Detects      │   │ Executes TS  │
│ - etc.       │   │ single-word  │   │ scripts      │
└──────────────┘   └──────────────┘   └──────────────┘
                          │                   │
                          ▼                   ▼
                   ┌──────────────┐   ┌──────────────┐
                   │ Config       │   │ Script       │
                   │ Loader       │   │ Runner       │
                   │ (scripts)    │   │ (Bun)        │
                   └──────────────┘   └──────────────┘
```

---

## Configuration Schema Changes

### Current Schema

```typescript
scripts: z.record(z.string(), z.string().or(z.object({
  command: z.string(),
  description: z.string(),
}))).optional()
```

### New Schema

```typescript
scripts: z.record(z.string(), z.union([
  // Simple shell command (backward compatible)
  z.string(),
  // Object with command and description (backward compatible)
  z.object({
    command: z.string(),
    description: z.string(),
  }),
  // TypeScript script file
  z.object({
    file: z.string(), // Path to .ts file, relative to project root
    description: z.string().optional(),
    args: z.array(z.string()).optional(), // Default arguments
  }).strict(),
])).optional()
```

### Example Config

```yaml
# .polkacodes.yml
defaultProvider: anthropic
defaultModel: claude-sonnet-4-5-20250929

scripts:
  # Shell commands (existing format)
  lint: bun run lint
  test: bun run test
  format:
    command: bun run format
    description: Format code with prettier

  # TypeScript scripts (new)
  deploy:
    file: ./scripts/deploy.ts
    description: Deploy to production
    args: [--production]

  review-all:
    file: ./scripts/review-all-prs.ts
    description: Review all open PRs

  custom-workflow:
    file: .polka-scripts/my-workflow.ts
```

---

## Implementation Tasks

### Phase 1: Core Infrastructure (Days 1-2)

#### Task 1.1: Update Config Schema
- [ ] Extend `configSchema` in `packages/core/src/config.ts`
- [ ] Add new script type definition
- [ ] Ensure backward compatibility
- [ ] Add Zod validation tests
- **Files:** `packages/core/src/config.ts`
- **Estimate:** 2 hours

#### Task 1.2: Create Script Runtime
- [ ] Create `ScriptRunner` class for TypeScript execution
- [ ] Implement Bun-based script loading
- [ ] Create execution context with available APIs
- [ ] Add error handling and timeout support
- **Files:** `packages/cli/src/script/runner.ts`
- **Estimate:** 4 hours

#### Task 1.3: Define Script API Module
- [ ] Create `@polka-codes/script` API package
- [ ] Export available functions: `code`, `commit`, `pr`, `review`, `fix`, `plan`, `epic`
- [ ] Export utilities: `zod`, `inquirer`, `logger`, `tools`
- [ ] Add TypeScript type definitions
- **Files:** `packages/cli/src/script/api.ts`, `packages/cli/src/script/types.ts`
- **Estimate:** 3 hours

### Phase 2: Command Implementation (Days 3-4)

#### Task 2.1: Create `run` Command
- [ ] Create `runCommand` in `packages/cli/src/commands/run.ts`
- [ ] Implement `polka run <script-name>` logic
- [ ] Add `--list` flag to list available scripts
- [ ] Add `--args` flag for passing arguments
- [ ] Support tab completion for script names
- **Files:** `packages/cli/src/commands/run.ts`
- **Estimate:** 4 hours

#### Task 2.2: Update Meta Command
- [ ] Modify `runMeta()` in `packages/cli/src/commands/meta.ts`
- [ ] Add word count validation (require > 2 words for task)
- [ ] Detect single-word input as command
- [ ] Check for built-in commands first
- [ ] Fall back to custom scripts in config
- [ ] Show helpful error if command not found
- **Files:** `packages/cli/src/commands/meta.ts`
- **Estimate:** 3 hours

#### Task 2.3: Register Commands
- [ ] Add `runCommand` to `packages/cli/src/index.ts`
- [ ] Update command help text
- [ ] Ensure proper option passing
- **Files:** `packages/cli/src/index.ts`
- **Estimate:** 1 hour

### Phase 3: Tooling & DX (Days 5-6)

#### Task 3.1: Create Script Generator
- [ ] Add `polka init script <name>` command
- [ ] Generate template TypeScript script
- [ ] Include JSDoc comments and examples
- [ ] Add to `.polkacodes.yml` automatically
- **Files:** `packages/cli/src/commands/init.ts` (extend)
- **Estimate:** 3 hours

#### Task 3.2: Add VS Code Support
- [ ] Create TypeScript plugin for script autocomplete
- [ ] Add `jsconfig.json` or `tsconfig.json` to project template
- [ ] Provide type definitions for `@polka-codes/script`
- **Files:** `packages/cli/vscode/`, new package `@polka-codes/language-server`
- **Estimate:** 6 hours (optional)

#### Task 3.3: Documentation
- [ ] Write custom scripts guide
- [ ] Create example scripts
- [ ] Document API reference
- [ ] Add troubleshooting section
- **Files:** `docs/custom-scripts.md`, `examples/scripts/`
- **Estimate:** 4 hours

### Phase 4: Testing (Days 7-8)

#### Task 4.1: Unit Tests
- [ ] Test config schema validation
- [ ] Test script runner with various scenarios
- [ ] Test command detection logic
- [ ] Test error handling
- **Files:** `packages/cli/src/**/*.test.ts`
- **Estimate:** 4 hours

#### Task 4.2: Integration Tests
- [ ] Test end-to-end script execution
- [ ] Test script with CLI API calls
- [ ] Test script argument passing
- [ ] Test timeout and error cases
- **Files:** `packages/cli/integration/**/*.test.ts`
- **Estimate:** 4 hours

#### Task 4.3: Manual Testing
- [ ] Create test scripts
- [ ] Test all built-in commands still work
- [ ] Test backward compatibility
- [ ] Performance testing
- **Estimate:** 3 hours

---

## File Structure

```
packages/
├── cli/
│   ├── src/
│   │   ├── commands/
│   │   │   ├── meta.ts          # Modify: command detection
│   │   │   ├── run.ts           # New: run command
│   │   │   └── init.ts          # Modify: add script init
│   │   ├── script/
│   │   │   ├── api.ts           # New: exported script API
│   │   │   ├── runner.ts        # New: script execution
│   │   │   └── types.ts         # New: script types
│   │   └── index.ts             # Modify: register run command
│   └── package.json
├── core/
│   ├── src/
│   │   └── config.ts            # Modify: extended schema
│   └── package.json
└── script/                      # New package (optional)
    ├── src/
    │   └── index.ts             # Re-exports from cli
    └── package.json

examples/
└── scripts/
    ├── deploy.ts                # Example: deployment script
    ├── review-all-prs.ts        # Example: PR review script
    └── custom-workflow.ts       # Example: custom workflow

docs/
└── custom-scripts.md            # New: documentation
```

---

## API Design

### Script API Available in Custom Scripts

```typescript
// @polka-codes/script

// Workflows
export { code, commit, pr, review, fix, plan, epic } from '@polka-codes/cli'

// Tools
export {
  readFile, writeFile, replaceInFile,
  executeCommand, searchFiles,
  listFiles, removeFile, renameFile
} from '@polka-codes/core'

// Utilities
export { z } from 'zod'
export { confirm, input, select, checkbox } from '@inquirer/prompts'
export { createLogger } from '@polka-codes/cli'

// Types
export type { Config, Logger, ToolProvider } from '@polka-codes/core'
```

### Example Script

```typescript
// .polka-scripts/deploy.ts
import { code, executeCommand, createLogger } from '@polka-codes/script'

const logger = createLogger({ verbose: 1 })

export async function main(args: string[]) {
  logger.info('Starting deployment...')

  // Run tests
  logger.info('Running tests...')
  const testResult = await executeCommand({
    command: 'bun',
    args: ['test']
  })
  if (testResult.exitCode !== 0) {
    logger.error('Tests failed!')
    process.exit(1)
  }

  // Build project
  logger.info('Building project...')
  await executeCommand({
    command: 'bun',
    args: ['run', 'build']
  })

  // Deploy
  logger.info('Deploying to production...')
  await executeCommand({
    command: 'npx',
    args: ['serverless', 'deploy', ...args]
  })

  logger.info('Deployment complete!')
}
```

---

## Examples

### Example 1: Simple Custom Command

```yaml
# .polkacodes.yml
scripts:
  hello:
    file: ./scripts/hello.ts
    description: Say hello
```

```typescript
// scripts/hello.ts
import { confirm } from '@polka-codes/script'

export async function main() {
  const name = await confirm({ message: 'Say hello?' })
  if (name) {
    console.log('Hello, World!')
  }
}
```

### Example 2: Multi-Step Workflow

```yaml
# .polkacodes.yml
scripts:
  full-release:
    file: ./scripts/full-release.ts
    description: Run full release workflow
```

```typescript
// scripts/full-release.ts
import { commit, pr, review, executeCommand } from '@polka-codes/script'

export async function main() {
  // Run tests
  await executeCommand({ command: 'bun', args: ['test'] })

  // Fix any issues
  await fix({ task: 'Fix test failures', interactive: false })

  // Create commit
  await commit({ all: true, context: 'Release preparation' })

  // Create PR
  await pr({ context: 'Prepare for release' })

  // Review code
  await review()
}
```

### Example 3: Custom Workflow with CLI API

```typescript
// scripts/custom-ai-task.ts
import { code, createLogger } from '@polka-codes/script'
import { readFile } from '@polka-codes/core'

const logger = createLogger({ verbose: 1 })

export async function main(args: string[]) {
  const task = args[0] || 'Improve code quality'

  // Read package.json
  const pkg = await readFile('package.json')

  // Execute code workflow
  const result = await code({
    task,
    file: ['src/**/*.ts'],
    interactive: false
  })

  logger.info('Task completed:', result)
}
```

---

## Testing Strategy

### Unit Tests

1. **Config Schema Tests**
   - Test backward compatibility (old script formats still work)
   - Test new TypeScript script format validation
   - Test error cases (invalid paths, missing files)

2. **Script Runner Tests**
   - Test successful script execution
   - Test error handling (syntax errors, runtime errors)
   - Test timeout functionality
   - Test argument passing

3. **Command Detection Tests**
   - Test single-word vs multi-word input
   - Test built-in command priority
   - Test custom script fallback
   - Test error messages

### Integration Tests

1. **End-to-End Script Execution**
   - Create test script
   - Add to config
   - Execute via CLI
   - Verify output

2. **API Integration Tests**
   - Test script using CLI API
   - Test script using tools
   - Test script with prompts

3. **Backward Compatibility Tests**
   - Ensure existing shell scripts still work
   - Test old config formats load correctly

### Test Script Examples

```typescript
// test/integration/script.test.ts
import { executeCommand } from '@polka-codes/core'

describe('Custom Scripts', () => {
  it('should execute TypeScript script', async () => {
    const result = await executeCommand({
      command: 'bun',
      args: ['run', 'cli', 'run', 'test-script']
    })
    expect(result.exitCode).toBe(0)
  })

  it('should pass arguments to script', async () => {
    const result = await executeCommand({
      command: 'bun',
      args: ['run', 'cli', 'run', 'deploy', '--production']
    })
    expect(result.stdout).toContain('Deploying to production')
  })
})
```

---

## Migration Guide

### For Users

#### Before (Shell Scripts Only)
```yaml
scripts:
  test: bun test
```

#### After (TypeScript Support)
```yaml
scripts:
  # Shell scripts still work
  test: bun test

  # New TypeScript scripts
  test-with-coverage:
    file: ./scripts/test-with-coverage.ts
    description: Run tests with coverage report
```

### Creating Your First Script

1. **Generate script template**
   ```bash
   polka init script my-script
   ```

2. **Edit the generated file**
   ```bash
   # Edit .polka-scripts/my-script.ts
   ```

3. **Run your script**
   ```bash
   polka run my-script
   ```

---

## Open Questions

1. **Script Location Convention**
   - Should scripts be in `.polka-scripts/` directory or allow any path?
   - **Decision:** Allow any path, recommend `.polka-scripts/` for organization

2. **Script Execution Model**
   - Should scripts run in separate process or same process?
   - **Decision:** Separate process for isolation, use Bun for speed

3. **Arguments Format**
   - How should arguments be passed to scripts? (`--args` or direct)
   - **Decision:** Support both: `polka run script -- --arg1 --arg2`

4. **Dependencies Management**
   - Should scripts have their own dependencies?
   - **Decision:** Scripts inherit project dependencies, can add custom ones

5. **Hot Reload**
   - Should scripts support hot reload during development?
   - **Decision:** Not in v1, consider for future

---

## Success Criteria

- [x] Single-word input triggers command lookup
- [x] Custom TypeScript scripts can be defined in config
- [x] `polka run <script-name>` executes TypeScript files
- [x] Scripts have access to CLI API, tools, and utilities
- [x] Backward compatibility maintained (old shell scripts work)
- [x] Clear error messages for missing/invalid scripts
- [x] Documentation and examples provided
- [x] Test coverage > 80%

---

## Timeline Estimate

- **Phase 1:** 2 days (Core infrastructure)
- **Phase 2:** 2 days (Command implementation)
- **Phase 3:** 2 days (Tooling & DX)
- **Phase 4:** 2 days (Testing)

**Total:** 8 working days (~1.5 weeks)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing workflows | High | Maintain backward compatibility, extensive testing |
| Poor script performance | Medium | Use Bun for fast startup, optimize loading |
| Security vulnerabilities | Medium | Validate script paths, sandbox execution |
| Complex API surface | Medium | Start with minimal API, expand based on feedback |
| Type definition complexity | Low | Generate types from actual implementation |

---

## Future Enhancements

1. **Script Watch Mode** - Auto-reload scripts during development
2. **Script Package Registry** - Share scripts between projects
3. **Script Composition** - Scripts can call other scripts
4. **Visual Script Editor** - Web-based script builder
5. **Script Hooks** - Pre/post execution hooks
6. **Script Versioning** - Multiple versions of same script
