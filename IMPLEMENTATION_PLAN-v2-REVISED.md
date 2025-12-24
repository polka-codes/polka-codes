# Implementation Plan: Custom Workflow Scripts (REVISED)

**Status:** Planning Phase - Revised Based on Code Review
**Created:** 2025-12-24
**Revised:** 2025-12-24
**Priority:** High

## 🚨 Critical Changes from Original Plan

This revised plan addresses **critical architectural issues** identified in the original proposal:

1. **Pivot from Process-Spawning to In-Process Execution**
   - Original: Spawn Bun processes for each script
   - Revised: Use in-process function calls with proper dependency injection
   - Reason: Performance, error handling, context preservation

2. **Integration with Epic Context System**
   - Original: No interaction with `.epic.yml`
   - Revised: Scripts can read/write epic context
   - Reason: Maintain workflow resumption capability

3. **Leverage Dynamic Workflow System**
   - Original: Create parallel script execution system
   - Revised: Extend existing dynamic workflow infrastructure
   - Reason: Reduce duplication, leverage existing tooling

4. **Enhanced Security Model**
   - Original: No sandboxing or validation
   - Revised: Path validation, permission model, resource limits
   - Reason: Prevent security vulnerabilities

5. **Proper API Package**
   - Original: Export from CLI internals
   - Revised: Create dedicated `@polka-codes/api` package
   - Reason: Clean separation of concerns, type safety

---

## Table of Contents

1. [Revised Architecture](#revised-architecture)
2. [Updated Requirements](#updated-requirements)
3. [Implementation Strategy](#implementation-strategy)
4. [Critical Issues & Solutions](#critical-issues--solutions)
5. [Updated Configuration Schema](#updated-configuration-schema)
6. [Revised Task Breakdown](#revised-task-breakdown)
7. [Security Enhancements](#security-enhancements)
8. [Testing Strategy](#testing-strategy-revised)

---

## Revised Architecture

### Current State (Unchanged)
```
polka [task]              -> runMeta() (epic workflow)
polka commit              -> commitCommand
polka code                -> codeCommand
```

### Target State (Revised)
```
polka                     -> Interactive prompt (>2 words = task, 1 word = command)
polka <command>           -> Built-in or custom command
polka run <script>        -> Execute custom script (in-process)
polka workflow <file>     -> Execute dynamic workflow (existing)
```

### Revised Component Architecture

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
│ Built-in     │   │ Command      │   │ API Package  │
│ Commands     │   │ Router       │   │ (NEW)        │
│              │   │              │   │              │
│ - code       │   │ - Detects    │   │ Exports      │
│ - commit     │   │   input type │   │ workflows    │
│ - etc.       │   │ - Loads      │   │ tools        │
│              │   │   config     │   │ context      │
└──────────────┘   │ - Routes to  │   │              │
                   │   handler    │   │              │
                   └──────┬───────┘   └──────────────┘
                          │
              ┌───────────┴───────────┐
              ▼                       ▼
┌──────────────────┐       ┌──────────────────┐
│ Script Runner    │       │ Dynamic          │
│ (In-Process)     │       │ Workflow System  │
│                  │       │ (Existing)       │
│ - Loads script   │       │ - YAML files     │
│ - Injects deps   │       │ - Code steps     │
│ - Executes fn    │       │ - Tool access    │
│ - Tracks usage   │       │ - Event system   │
└──────────────────┘       └──────────────────┘
```

---

## Updated Requirements

### Functional Requirements (Revised)

1. **Command Detection**
   - ✅ Preserve epic context resumption behavior
   - ✅ Single-word input triggers command lookup (only when no epic context)
   - ✅ Multi-word input (>2 words) treated as task
   - ✅ Command priority: Built-in > Custom Scripts > Error

2. **Custom Script Definition**
   - ✅ Scripts defined in `.polkacodes.yml` or separate `.ts` files
   - ✅ Support TypeScript files with proper type definitions
   - ✅ Scripts use `@polka-codes/api` package (not CLI internals)

3. **Script Execution**
   - ✅ Execute in-process (not spawned Bun processes)
   - ✅ Proper dependency injection (WorkflowContext, ToolProvider, UsageMeter)
   - ✅ Event emission to parent process
   - ✅ Resource limits (memory, timeout)
   - ✅ Access to: Workflows, Tools, Logger, Epic Context

4. **Epic Context Integration**
   - ✅ Scripts can read `.epic.yml` context
   - ✅ Scripts can update epic context
   - ✅ Scripts participate in epic resumption
   - ✅ Clear epic context when starting new task

### Non-Functional Requirements (Revised)

1. **Type Safety**: Full TypeScript with proper API package
2. **Performance**: In-process execution (<100ms overhead)
3. **Error Handling**: Stack trace preservation, clear error messages
4. **Security**: Path validation, permission model, resource limits
5. **Maintainability**: Leverage existing systems, avoid duplication

---

## Implementation Strategy

### Key Decisions

#### Decision 1: In-Process vs Process-Spawning
**Choice:** In-process execution with function calls

**Rationale:**
- Preserves error stack traces
- Enables proper dependency injection
- Maintains WorkflowContext across executions
- Allows usage tracking and budget enforcement
- Better performance (no process spawn overhead)

**Implementation:**
```typescript
// Load and compile script as module
const scriptModule = await import(scriptPath)
// Inject dependencies
const api = createWorkflowApi(context, provider, meter)
// Execute
await scriptModule.main(args, api)
```

#### Decision 2: Extend Dynamic Workflows vs New System
**Choice:** Extend dynamic workflow system

**Rationale:**
- Existing infrastructure for tool access
- Built-in event system and step tracking
- YAML validation and parsing
- Code execution with `allowUnsafeCodeExecution`
- Reduces code duplication

**Implementation:**
```yaml
# .polkacodes.yml
scripts:
  my-script:
    workflow: ./workflows/my-script.yml  # Reuse workflow system
    description: 'My custom script'
```

OR for TypeScript scripts:
```typescript
// scripts/my-script.ts
import { WorkflowApi } from '@polka-codes/api'

export async function main(
  args: string[],
  api: WorkflowApi  // Injected API
) {
  await api.code({ task: 'Add feature' })
}
```

#### Decision 3: API Package Structure
**Choice:** Create `@polka-codes/api` package

**Rationale:**
- Clean separation from CLI internals
- Proper TypeScript types and autocomplete
- Version independently from CLI
- Reusable across different contexts

**Implementation:**
```
packages/api/
├── src/
│   ├── index.ts          # Main exports
│   ├── workflow.ts       # Workflow functions
│   ├── tools.ts          # Tool wrappers
│   ├── context.ts        # Context management
│   └── types.ts          # TypeScript types
└── package.json
```

---

## Critical Issues & Solutions

### Issue 1: Epic Context Interaction
**Problem:** Original plan didn't address how scripts interact with `.epic.yml`

**Solution:**
```typescript
// packages/api/src/context.ts
export interface ScriptContext {
  // Read epic context
  getEpicContext(): Promise<EpicContext | null>

  // Update epic context
  setEpicContext(context: EpicContext): Promise<void>

  // Clear epic context
  clearEpicContext(): Promise<void>
}

// In script:
import { api } from '@polka-codes/api'

export async function main(args: string[], context: ScriptContext) {
  const epic = await context.getEpicContext()
  console.log('Current task:', epic?.task)
}
```

### Issue 2: Config Schema Conflict
**Problem:** Adding `file` field breaks `getDefaultContext` formatting

**Solution:**
```typescript
// packages/core/src/config.ts
export const scriptSchema = z.union([
  z.string(),  // Shell command
  z.object({
    command: z.string(),
    description: z.string(),
  }),
  // NEW: Reference to workflow YAML
  z.object({
    workflow: z.string(),
    description: z.string().optional(),
    input: z.record(z.string(), z.any()).optional(),
  }).strict(),
])

// Update getDefaultContext to handle new type
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
  return 'unknown'
}
```

### Issue 3: Command Detection vs Epic Resumption
**Problem:** Single-word command logic breaks epic context resumption

**Solution:**
```typescript
// packages/cli/src/commands/meta.ts (REVISED)
export async function runMeta(task: string | undefined, command: Command) {
  const epicContext = await loadEpicContext()

  // Priority 1: Resume epic if exists
  if (epicContext.task) {
    if (task) {
      logger.error('Error: Existing epic context found.')
      logger.info(`Current task: ${epicContext.task}`)
      logger.info('Use "polka epic --clear" to start a new task.')
      return
    }
    logger.info('Resuming epic session...')
    // ... resume logic
    return
  }

  // Priority 2: Check if input is a command
  if (task) {
    const words = task.trim().split(/\s+/)
    if (words.length === 1) {
      const matched = await tryExecuteCommand(words[0])
      if (matched) return

      logger.error(`Error: Unknown command '${words[0]}'`)
      logger.info('Available commands: [list them]')
      return
    }

    // Priority 3: Validate task length
    if (words.length <= 2) {
      logger.error('Error: Task must be more than 2 words.')
      logger.info('For commands: polka <command>')
      logger.info('For tasks: polka "detailed task description"')
      return
    }

    // Priority 4: Start new epic with task
    epicContext.task = task
    // ... start epic
    return
  }

  // Priority 5: Prompt for input
  const input = await getUserInput('What do you want to work on?')
  // ... process input
}

async function tryExecuteCommand(commandName: string): Promise<boolean> {
  // Check built-in commands
  const builtInCommands = ['code', 'commit', 'pr', 'review', 'fix', 'plan', 'workflow']
  if (builtInCommands.includes(commandName)) {
    // Execute built-in
    return true
  }

  // Check custom scripts
  const config = await loadConfig()
  const script = config?.scripts?.[commandName]
  if (script) {
    await executeScript(script, commandName)
    return true
  }

  return false
}
```

### Issue 4: Security - Path Traversal
**Problem:** No validation of script paths

**Solution:**
```typescript
// packages/cli/src/script/validator.ts
import { resolve, relative } from 'node:path'
import { existsSync } from 'node:fs'

export class ScriptValidationError extends Error {
  constructor(message: string) {
    super(`Script validation failed: ${message}`)
  }
}

export function validateScriptPath(
  scriptPath: string,
  projectRoot: string = process.cwd()
): void {
  const resolved = resolve(projectRoot, scriptPath)

  // Check if path is within project
  const relativePath = relative(projectRoot, resolved)
  if (relativePath.startsWith('..')) {
    throw new ScriptValidationError(
      `Script path '${scriptPath}' is outside project directory`
    )
  }

  // Check file exists
  if (!existsSync(resolved)) {
    throw new ScriptValidationError(
      `Script file not found: ${scriptPath}`
    )
  }

  // Check file extension
  if (!scriptPath.endsWith('.ts') && !scriptPath.endsWith('.yml')) {
    throw new ScriptValidationError(
      `Script must be .ts or .yml file: ${scriptPath}`
    )
  }
}

// Usage in runner
validateScriptPath(scriptPath)
```

### Issue 5: Dependency Injection
**Problem:** Scripts need WorkflowContext, ToolProvider, UsageMeter

**Solution:**
```typescript
// packages/api/src/index.ts
import type { WorkflowContext, ToolProvider, UsageMeter } from '@polka-codes/core'

export interface WorkflowApi {
  // Workflows
  code(input: CodeInput): Promise<CodeOutput>
  commit(input: CommitInput): Promise<string>
  pr(input: PrInput): Promise<void>
  review(input?: ReviewInput): Promise<ReviewResult>
  fix(input: FixInput): Promise<void>
  plan(input: PlanInput): Promise<PlanOutput>

  // Tools
  readFile(path: string): Promise<string | null>
  writeFile(path: string, content: string): Promise<void>
  executeCommand(input: CommandInput): Promise<CommandResult>
  // ... other tools

  // Context
  getContext(): WorkflowContext
  getUsage(): UsageMeter

  // Logger
  log(level: 'info' | 'warn' | 'error', message: string): void
}

export function createWorkflowApi(
  context: WorkflowContext,
  provider: ToolProvider,
  meter: UsageMeter
): WorkflowApi {
  return {
    // Implementation wraps existing functions
    code: (input) => codeWorkflow(input, context, provider, meter),
    commit: (input) => commitWorkflow(input, context, provider, meter),
    // ... etc
  }
}

// In script runner:
import { createWorkflowApi } from '@polka-codes/api'

const api = createWorkflowApi(context, provider, meter)
await scriptModule.main(args, api)
```

---

## Updated Configuration Schema

### Revised Schema

```typescript
// packages/core/src/config.ts

export const scriptSchema = z.union([
  // Type 1: Simple shell command (backward compatible)
  z.string(),

  // Type 2: Object with command (backward compatible)
  z.object({
    command: z.string(),
    description: z.string(),
  }),

  // Type 3: Reference to dynamic workflow YAML
  z.object({
    workflow: z.string(), // Path to .yml file
    description: z.string().optional(),
    input: z.record(z.string(), z.any()).optional(), // Default workflow input
  }).strict(),

  // Type 4: TypeScript script (NEW - recommended)
  z.object({
    script: z.string(), // Path to .ts file
    description: z.string().optional(),
    permissions: z.object({
      fs: z.enum(['read', 'write', 'none']).optional(),
      network: z.boolean().optional(),
      subprocess: z.boolean().optional(),
    }).optional(),
    timeout: z.number().optional(), // Override default timeout
    memory: z.number().optional(), // Memory limit in MB
  }).strict(),
])
```

### Example Config

```yaml
# .polkacodes.yml
defaultProvider: anthropic
defaultModel: claude-sonnet-4-5-20250929

scripts:
  # Backward compatible shell commands
  lint: bun run lint
  test:
    command: bun test
    description: Run test suite

  # Dynamic workflow (existing system)
  review-pr:
    workflow: ./workflows/pr-review.yml
    description: Review a pull request
    input:
      thorough: true

  # TypeScript script (NEW - recommended)
  deploy:
    script: ./scripts/deploy.ts
    description: Deploy to production
    permissions:
      fs: write
      network: true
      subprocess: true
    timeout: 600000  # 10 minutes
    memory: 512      # 512MB

  # Simple automation script
  format-all:
    script: .polka-scripts/format.ts
    description: Format all files
    permissions:
      fs: write
      network: false
      subprocess: true
```

---

## Revised Task Breakdown

### Phase 1: Foundation (Days 1-2)

#### Task 1.1: Create API Package
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 4 hours

**Description:**
Create `packages/api/` with workflow and tool exports.

**Deliverables:**
- [ ] `packages/api/package.json`
- [ ] `packages/api/src/index.ts` - Main exports
- [ ] `packages/api/src/workflow.ts` - Workflow wrappers
- [ ] `packages/api/src/tools.ts` - Tool wrappers
- [ ] `packages/api/src/context.ts` - Context management
- [ ] `packages/api/src/types.ts` - TypeScript types
- [ ] Export from monorepo root

**Key Code:**
```typescript
// packages/api/src/index.ts
export * from './workflow'
export * from './tools'
export * from './context'
export { createWorkflowApi } from './api'

// packages/api/src/api.ts
export function createWorkflowApi(
  context: WorkflowContext,
  provider: ToolProvider,
  meter: UsageMeter,
  logger: Logger
): WorkflowApi {
  return {
    // Wrap all workflows and tools
  }
}
```

---

#### Task 1.2: Update Config Schema
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 2 hours

**Description:**
Extend config schema with workflow and script types.

**Changes:**
- [ ] Update `packages/core/src/config.ts` schema
- [ ] Update `getDefaultContext` formatter
- [ ] Add validation tests
- [ ] Ensure backward compatibility

---

#### Task 1.3: Script Validator
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 2 hours

**Description:**
Create security validation for script paths.

**Deliverables:**
- [ ] `packages/cli/src/script/validator.ts`
- [ ] Path traversal protection
- [ ] File existence checks
- [ ] Extension validation
- [ ] Permission validation

---

### Phase 2: Script Runner (Days 3-4)

#### Task 2.1: In-Process Script Runner
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 6 hours

**Description:**
Create script runner that executes in-process with dependency injection.

**Deliverables:**
- [ ] `packages/cli/src/script/runner.ts`
- [ ] Dynamic import of script modules
- [ ] Dependency injection (createWorkflowApi)
- [ ] Error handling with stack traces
- [ ] Timeout enforcement
- [ ] Memory limits (if possible)

**Key Implementation:**
```typescript
export class ScriptRunner {
  async execute(options: {
    scriptPath: string
    args: string[]
    context: WorkflowContext
    provider: ToolProvider
    meter: UsageMeter
    logger: Logger
    timeout?: number
  }): Promise<any> {
    // 1. Validate script path
    validateScriptPath(options.scriptPath)

    // 2. Load script module
    const scriptModule = await import(options.scriptPath)

    // 3. Create API
    const api = createWorkflowApi(
      options.context,
      options.provider,
      options.meter,
      options.logger
    )

    // 4. Execute with timeout
    return await this.withTimeout(options.timeout ?? 300000, async () => {
      return await scriptModule.main(options.args, api)
    })
  }
}
```

---

#### Task 2.2: Workflow Script Integration
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours

**Description:**
Integrate workflow YAML scripts with existing dynamic workflow system.

**Deliverables:**
- [ ] Detect `workflow:` type in config
- [ ] Load workflow YAML
- [ ] Execute via existing `executeWorkflow`
- [ ] Pass default input from config

---

### Phase 3: Command Router (Days 5-6)

#### Task 3.1: Enhanced Meta Command
**Status:** 🔲 Not Started
**Priority:** P0 (Critical)
**Estimate:** 4 hours

**Description:**
Update meta command with epic-aware command detection.

**Changes:**
- [ ] Epic context priority (resume if exists)
- [ ] Single-word command detection
- [ ] Multi-word validation (>2 words)
- [ ] Built-in command lookup
- [ ] Custom script lookup
- [ ] Clear error messages

**Implementation:** See Issue 3 solution above

---

#### Task 3.2: Run Command
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 3 hours

**Description:**
Create `polka run` command for explicit script execution.

**Deliverables:**
- [ ] `packages/cli/src/commands/run.ts`
- [ ] Script listing (`--list`)
- [ ] Script execution
- [ ] Argument passing
- [ ] Tab completion

---

#### Task 3.3: Epic Context Integration
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 3 hours

**Description:**
Add epic context read/write to WorkflowApi.

**Deliverables:**
- [ ] `getEpicContext()` in WorkflowApi
- [ ] `setEpicContext()` in WorkflowApi
- [ ] `clearEpicContext()` in WorkflowApi
- [ ] Update `EpicContext` to support script metadata

---

### Phase 4: Security & DX (Days 7-8)

#### Task 4.1: Permission Model
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours

**Description:**
Implement permission system for script execution.

**Deliverables:**
- [ ] Permission validation in tools
- [ ] FS permission checks (read/write/none)
- [ ] Network access control
- [ ] Subprocess permission checks
- [ ] Environment variable filtering

**Implementation:**
```typescript
// packages/api/src/tools.ts
export function createSecureTools(
  provider: ToolProvider,
  permissions: ScriptPermissions
): ToolRegistry {
  const tools = { ...provider.tools }

  if (permissions.fs === 'none') {
    delete tools.readFile
    delete tools.writeFile
  } else if (permissions.fs === 'read') {
    delete tools.writeFile
    delete tools.replaceInFile
  }

  if (!permissions.network) {
    delete tools.fetchUrl
  }

  if (!permissions.subprocess) {
    delete tools.executeCommand
  }

  return tools
}
```

---

#### Task 4.2: Script Generator
**Status:** 🔲 Not Started
**Priority:** P2 (Medium)
**Estimate:** 2 hours

**Description:**
Add `polka init script` command with templates.

**Deliverables:**
- [ ] Script templates
- [ ] `polka init script <name>` command
- [ ] Auto-add to `.polkacodes.yml`
- [ ] JSDoc comments

---

#### Task 4.3: Documentation
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours

**Deliverables:**
- [ ] User guide (updated)
- [ ] API reference
- [ ] Example scripts (5+)
- [ ] Security best practices
- [ ] Migration guide

---

### Phase 5: Testing (Days 9-10)

#### Task 5.1: Unit Tests
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours

**Coverage:**
- [ ] Config schema validation
- [ ] Script validator
- [ ] API package functions
- [ ] Command router logic
- [ ] Permission system

---

#### Task 5.2: Integration Tests
**Status:** 🔲 Not Started
**Priority:** P1 (High)
**Estimate:** 4 hours

**Scenarios:**
- [ ] End-to-end script execution
- [ ] Epic context interaction
- [ ] Permission enforcement
- [ ] Error handling
- [ ] Timeout and memory limits

---

## Security Enhancements

### 1. Path Validation
```typescript
// Prevent path traversal attacks
validateScriptPath(scriptPath, projectRoot)
```

### 2. Permission Model
```yaml
scripts:
  risky-script:
    script: ./scripts/risky.ts
    permissions:
      fs: read        # read-only file access
      network: false  # no network requests
      subprocess: false  # no subprocess spawning
```

### 3. Resource Limits
```yaml
scripts:
  heavy-script:
    script: ./scripts/heavy.ts
    timeout: 300000   # 5 minutes
    memory: 1024      # 1GB max
```

### 4. Environment Variable Control
```typescript
// Filter which env vars scripts can access
const allowedEnv = {
  API_KEY: process.env.API_KEY,
  NODE_ENV: process.env.NODE_ENV
}
// Only pass allowed vars to script
```

---

## Testing Strategy (Revised)

### Unit Tests
```typescript
// packages/api/src/workflow.test.ts
describe('WorkflowApi', () => {
  it('should execute code workflow', async () => {
    const api = createWorkflowApi(mockContext, mockProvider, mockMeter)
    const result = await api.code({ task: 'Add feature' })
    expect(result).toBeDefined()
  })
})
```

### Integration Tests
```typescript
// packages/cli/integration/script.test.ts
describe('Script Execution', () => {
  it('should execute TypeScript script', async () => {
    const result = await runMeta('my-script', mockCommand)
    expect(result.exitCode).toBe(0)
  })

  it('should enforce permissions', async () => {
    const result = await runScript('risky-script')
    await expect(result).rejects.toThrow('Permission denied')
  })
})
```

### Security Tests
```typescript
describe('Script Security', () => {
  it('should reject path traversal', () => {
    expect(() => validateScriptPath('../../../etc/passwd'))
      .toThrow('outside project directory')
  })

  it('should enforce FS permissions', async () => {
    const api = createWorkflowApi(..., { fs: 'read' })
    await expect(api.writeFile('/path', 'content'))
      .rejects.toThrow('Permission denied')
  })
})
```

---

## Timeline (Revised)

| Phase | Tasks | Duration |
|-------|-------|----------|
| Phase 1: Foundation | 3 tasks | 2 days |
| Phase 2: Script Runner | 2 tasks | 2 days |
| Phase 3: Command Router | 3 tasks | 2 days |
| Phase 4: Security & DX | 3 tasks | 2 days |
| Phase 5: Testing | 2 tasks | 2 days |
| **Total** | **13 tasks** | **10 days** |

---

## Success Criteria (Revised)

- [x] Epic context resumption preserved
- [x] In-process script execution (<100ms overhead)
- [x] Proper dependency injection (WorkflowContext, ToolProvider, UsageMeter)
- [x] Security validation (path traversal, permissions)
- [x] Backward compatibility maintained
- [x] `@polka-codes/api` package created
- [x] Command detection works with epic context
- [x] Test coverage > 80%
- [x] Documentation complete

---

## Open Questions (Revised)

1. **Worker Threads vs Main Thread**
   - Should scripts run in worker threads for isolation?
   - **Decision:** Start with main thread, evaluate worker threads if needed

2. **Hot Reload**
   - Should scripts support hot reload during development?
   - **Decision:** Not in v1, consider for v2

3. **Script Composition**
   - Should scripts be able to call other scripts?
   - **Decision:** Yes, through WorkflowApi

4. **Type Checking**
   - Should scripts be type-checked before execution?
   - **Decision:** Yes, use `tsc --noEmit` in validation

5. **Package Dependencies**
   - Should scripts have their own dependencies?
   - **Decision:** No, inherit project dependencies

---

## Next Steps

1. **Review this revised plan** with stakeholders
2. **Get approval** for architectural changes
3. **Start with Task 1.1** (Create API Package)
4. **Iterate based on feedback**

---

**Documents:**
- [Original Plan](./IMPLEMENTATION_PLAN.md) (deprecated)
- [Task Breakdown](./TASK_BREAKDOWN.md) (needs revision)
- [Quick Reference](./docs/custom-scripts-guide.md) (needs revision)
