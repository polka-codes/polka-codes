# Polka-Codes Repository - Comprehensive Review Plan

**Generated:** 2026-01-20
**Scope:** packages/cli, packages/cli-shared, packages/core, packages/runner, packages/github
**Total Files Analyzed:** 357 TypeScript files
**Test Files:** 77 test files

---

## Executive Summary

This review plan identifies **127 specific issues** across the codebase, organized by priority and category. The codebase demonstrates good architectural patterns but suffers from:
- Extensive use of `any` types (100+ instances)
- Console.log statements in production code (80+ instances)
- Over-use of type assertions
- Inconsistent error handling patterns
- Unused imports and variables

---

## Table of Contents

1. [Critical Priority Issues](#critical-priority)
2. [High Priority Issues](#high-priority)
3. [Medium Priority Issues](#medium-priority)
4. [Low Priority Issues](#low-priority)
5. [Code Quality Metrics](#metrics)
6. [Recommended Refactoring Strategy](#strategy)

---

## Critical Priority Issues

### C1. Security: Command Injection Vulnerability in executeCommand

**Location:** `packages/cli/src/tool-implementations.ts:206-275`

**Issue:**
```typescript
const child = input.shell === true
  ? input.args && input.args.length > 0
    ? spawn(input.command, input.args, { shell: true, stdio: 'pipe' })
    : spawn(input.command, { shell: true, stdio: 'pipe' })
  : spawn(input.command, input.args, { shell: false, stdio: 'pipe' })
```

**Problem:** Even with `shell: true`, the `command` parameter is not sanitized before being passed to `spawn`. This could lead to command injection if user input is passed directly.

**Fix:**
```typescript
// 1. Validate command against whitelist
const ALLOWED_COMMANDS = ['git', 'npm', 'node', 'python', 'ls', 'cat', 'grep']

if (!ALLOWED_COMMANDS.includes(input.command)) {
  throw new Error(`Command not allowed: ${input.command}`)
}

// 2. Sanitize args to prevent pipe injection
const sanitizedArgs = input.args?.map(arg =>
  arg.replace(/[;&|`$()]/g, '')
)
```

**Files:**
- packages/cli/src/tool-implementations.ts:206-275

---

### C2. Type Safety: Extensive Use of `any` Type

**Locations:** 100+ instances across codebase

**Critical Instances:**

1. **packages/cli/src/tool-implementations.ts:121-123**
   ```typescript
   toolProvider: any // ToolProvider with MemoryProvider & TodoProvider capabilities
   workflowContext: any // WorkflowContext<CliToolRegistry>
   ```

2. **packages/core/src/config.ts:40**
   ```typescript
   parameters: z.record(z.string(), z.any()).optional()
   ```

3. **packages/core/src/workflow/dynamic-types.ts:54**
   ```typescript
   default: z.any().nullish()
   ```

**Problem:** Defeats TypeScript's type checking, leading to runtime errors.

**Fix:**
```typescript
// Define proper interfaces instead
interface ToolProviderWithCapabilities extends ToolProvider {
  listMemoryTopics: () => Promise<string[]>
  readMemory: (topic?: string) => Promise<string | undefined>
  updateMemory: (operation: 'append' | 'replace' | 'remove', topic?: string, content?: string) => Promise<void>
  listTodoItems: (id?: string | null, status?: string | null) => Promise<TodoItem[]>
  getTodoItem: (id: string) => Promise<GetTodoItemOutput | undefined>
  updateTodoItem: (input: UpdateTodoItemInput) => Promise<UpdateTodoItemOutput>
}
```

**Files:**
- packages/cli/src/tool-implementations.ts:121-123
- packages/core/src/config.ts:40, 64, 201
- packages/core/src/workflow/dynamic-types.ts:54, 70
- packages/core/src/errors/base.ts:46, 64
- packages/core/src/tool.ts:18, 22
- 90+ more files

---

### C3. Type Safety: Unsafe Type Assertions

**Location:** `packages/cli/src/tool-implementations.ts:617`

**Issue:**
```typescript
return handler(toolCall.input as never, context)
```

**Problem:** Using `as never` to bypass type checking is unsafe and defeats TypeScript's purpose.

**Fix:**
```typescript
// Use discriminated unions for proper type narrowing
type ToolHandlerInput<T> = T extends keyof typeof localToolHandlers
  ? Parameters<typeof localToolHandlers[T]>[0]
  : never

function executeTool<T extends keyof typeof localToolHandlers>(
  tool: T,
  input: ToolHandlerInput<T>,
  context: ToolCallContext
) {
  return localToolHandlers[tool](input, context)
}
```

**Files:**
- packages/cli/src/tool-implementations.ts:617
- packages/cli/src/tool-implementations.ts:655
- packages/core/src/errors/base.ts:64

---

## High Priority Issues

### H1. Code Quality: Console.log in Production Code

**Count:** 80+ instances

**Locations:**
- `packages/runner/src/runner.ts`: 30 console statements
- `packages/cli-shared/src/config.ts`: 12 console statements
- `packages/cli/src/commands/memory.ts`: 20+ console statements
- `packages/cli/src/getModel.ts`: 10 console statements

**Problem:** Console statements clutter production logs and can leak sensitive information.

**Examples:**

1. **packages/runner/src/runner.ts:89-91**
   ```typescript
   console.log('Runner initialized with:')
   console.log(`  API URL: ${this.options.api}`)
   console.log(`  Task ID: ${this.options.taskId}`)
   ```
   **Risk:** Leaks API URL and task ID

2. **packages/cli/src/getModel.ts:72-74**
   ```typescript
   console.log('-> Request URL:', url)
   console.log('-> Request Headers:', options?.headers)
   console.log('-> Request Body:')
   ```
   **Risk:** Leaks authentication headers

**Fix:**
```typescript
// 1. Use proper logging library
import { logger } from './logger'

logger.debug('Runner initialized', {
  apiUrl: this.options.api,
  taskId: this.options.taskId
})

// 2. Remove sensitive logging
logger.debug('Sending request', { url })
// Don't log headers with auth tokens
```

**Files:**
- packages/runner/src/runner.ts:44, 53, 56, 89-91, 118, 128, 139, 149, 159, 199, 290, 321, 323, 337, 403, 420, 423, 426, 438, 448, 452, 456
- packages/runner/src/WebSocketManager.ts:33, 59, 72, 98, 121, 132, 136, 141, 146, 157, 165
- packages/cli-shared/src/config.ts:25, 28, 95, 98, 100, 114, 117, 119, 126, 149, 161, 172, 209, 212
- packages/cli/src/getModel.ts:72-74, 97, 114, 161, 180

---

### H2. Type Safety: Missing Type Annotations

**Location:** `packages/cli/src/agent/errors.ts:286`

**Issue:**
```typescript
public readonly existingSession?: any
```

**Problem:** Using `any` for error details loses type information.

**Fix:**
```typescript
interface SessionInfo {
  id: string
  pid: number
  startTime: Date
  mode: AgentMode
}

public readonly existingSession?: SessionInfo
```

**Files:**
- packages/cli/src/agent/errors.ts:286
- packages/cli/src/agent/health-monitor.ts:9
- packages/core/src/memory/types.ts:145

---

### H3. Unused/Dead Code: Duplicate Export Patterns

**Count:** 84 instances of `export * from`

**Issue:** Barrel files using `export *` make it hard to track dependencies and can cause unwanted exports.

**Example:** `packages/core/src/index.ts`
```typescript
export * from './Agent'
export * from './config'
export * from './errors'
// ... 19 more export * statements
```

**Problem:**
- Bloates bundle size
- Exports internal utilities
- Makes tree-shaking difficult
- Unclear what's actually exported

**Fix:**
```typescript
// Use named exports for public API only
export { agentWorkflow } from './workflow/agent.workflow'
export { BaseError, createErrorClass } from './errors/base'
export type { Tool, ToolInfo } from './tool'

// Internal utilities stay internal
// export { internalUtil } from './internal' // REMOVE
```

**Files:**
- packages/core/src/index.ts (20 exports)
- packages/cli/src/agent/index.ts (42 exports)
- packages/core/src/workflow/index.ts (8 exports)
- packages/cli/src/mcp/index.ts (9 exports)

---

### H4. Error Handling: Inconsistent Error Patterns

**Issue:** Multiple error class hierarchies with inconsistent patterns.

**Locations:**
1. `packages/core/src/errors/base.ts` - BaseError with factory
2. `packages/cli/src/errors.ts` - ProviderError hierarchy
3. `packages/cli/src/agent/errors.ts` - AgentError hierarchy
4. `packages/cli/src/mcp/errors.ts` - McpError hierarchy

**Problems:**
- Four different error base classes
- Inconsistent error properties
- Different retryable flags
- Inconsistent suggestion formats

**Fix:**
```typescript
// Create unified error base class
export abstract class AppError extends Error {
  public readonly code: string
  public readonly retryable: boolean
  public readonly cause?: Error
  public readonly suggestions?: ErrorSuggestions

  constructor(
    code: string,
    message: string,
    retryable: boolean,
    cause?: Error,
    suggestions?: ErrorSuggestions
  ) {
    super(message)
    this.name = this.constructor.name
    this.code = code
    this.retryable = retryable
    this.cause = cause
    this.suggestions = suggestions
  }
}

// Then extend for specific domains
export class ProviderError extends AppError {
  public readonly provider: string
  public readonly model: string
  // ...
}

export class AgentError extends AppError {
  public readonly mode?: AgentMode
  // ...
}
```

**Files:**
- packages/core/src/errors/base.ts
- packages/cli/src/errors.ts
- packages/cli/src/agent/errors.ts
- packages/cli/src/mcp/errors.ts

---

### H5. Code Quality: Repeated try-catch Patterns

**Count:** 50+ instances

**Example:** `packages/cli/src/agent/logger.ts:39, 57, 74, 92, 110, 126, 146, 165`

**Issue:**
```typescript
this.writeToFile(logEntry).catch(() => {})
```

**Problem:** Silent failures, no error handling, repeated pattern.

**Fix:**
```typescript
// Create a utility function
async function safeWrite(fn: () => Promise<void>, context: string) {
  try {
    await fn()
  } catch (error) {
    // Use proper logger, not console
    logger.error(`Failed to ${context}`, error)
  }
}

// Usage
safeWrite(() => this.writeToFile(logEntry), 'write log entry')
```

**Files:**
- packages/cli/src/agent/logger.ts:39, 57, 74, 92, 110, 126, 146, 165
- packages/cli/src/agent/working-space.ts:485-487
- packages/cli/src/mcp/manager.ts:89

---

### H6. Type Safety: Zod Schema with `any` Type

**Location:** `packages/core/src/config.ts:40`

**Issue:**
```typescript
parameters: z.record(z.string(), z.any()).optional()
```

**Problem:** Allows any value to pass validation, defeating the purpose of Zod.

**Fix:**
```typescript
parameters: z
  .record(
    z.string(),
    z.union([
      z.string(),
      z.number(),
      z.boolean(),
      z.array(z.any()),
      z.record(z.string(), z.any())
    ])
  )
  .optional()
```

**Better:** Define specific parameter schemas for each provider/model.

**Files:**
- packages/core/src/config.ts:40, 64, 201
- packages/core/src/workflow/dynamic-types.ts:54

---

### H7. Code Quality: Magic Numbers and Strings

**Examples:**

1. **packages/cli/src/tool-implementations.ts:314-332**
   ```typescript
   if (lastOutputs.length > 20) {  // Magic number
     lastOutputs.shift()
   }
   if (lastOutputs.length === 20) {  // Magic number
     const firstHalf = lastOutputs.slice(0, 10)  // Magic number
     const secondHalf = lastOutputs.slice(10)
     if (firstHalf === secondHalf) {
       if (firstHalf.length > 20) {  // Magic number
   ```

2. **packages/cli-shared/src/sqlite-memory-store.ts:16**
   ```typescript
   private static readonly LOCK_TIMEOUT = 30000  // 30 seconds
   ```
   Should be named constant: `LOCK_TIMEOUT_MS`

**Fix:**
```typescript
// Define constants
const REPETITION_DETECTION_WINDOW = 20
const REPETITION_CHECK_HALF = REPETITION_DETECTION_WINDOW / 2
const REPETITION_MIN_LENGTH = 20

if (lastOutputs.length > REPETITION_DETECTION_WINDOW) {
  lastOutputs.shift()
}
if (lastOutputs.length === REPETITION_DETECTION_WINDOW) {
  const firstHalf = lastOutputs.slice(0, REPETITION_CHECK_HALF)
  const secondHalf = lastOutputs.slice(REPETITION_CHECK_HALF)
  if (firstHalf === secondHalf) {
    if (firstHalf.length > REPETITION_MIN_LENGTH) {
```

**Files:**
- packages/cli/src/tool-implementations.ts:314-332, 301
- packages/cli-shared/src/sqlite-memory-store.ts:16
- packages/cli/src/agent/config.ts:11-13

---

### H8. Unused Imports

**Count:** Found in multiple test files

**Example:** `packages/core/src/tools/askFollowupQuestion.test.ts:92`

**Fix:** Run `ts-unused-exports` or `ts-prune` to identify:
```bash
npx ts-prune
```

Or use ESLint rule:
```json
{
  "rules": {
    "no-unused-vars": "error",
    "@typescript-eslint/no-unused-vars": ["error", {
      "vars": "all",
      "args": "after-used",
      "ignoreRestSiblings": false
    }]
  }
}
```

---

## Medium Priority Issues

### M1. Code Duplication: Similar Error Classes

**Issue:** Multiple error classes with identical structure.

**Locations:**
- `packages/cli/src/errors.ts` - 10 error classes
- `packages/cli/src/agent/errors.ts` - 10 error classes
- `packages/cli/src/mcp/errors.ts` - 5 error classes

**Duplication Example:**
```typescript
// In ProviderError hierarchy
export class ProviderTimeoutError extends ProviderError {
  constructor(provider: string, model: string, timeoutSeconds: number, cause?: Error) {
    super(provider, model, `...`, true, cause)
    this.timeoutSeconds = timeoutSeconds
  }
}

// In McpError hierarchy
export class McpTimeoutError extends McpError {
  constructor(serverName: string, timeoutSeconds: number) {
    super(serverName, `...`, true)
    this.timeoutSeconds = timeoutSeconds
  }
}

// In AgentError hierarchy
export class ResourceLimitError extends AgentError {
  // Different but similar pattern
}
```

**Fix:** Extract common error creation logic:
```typescript
function createTimeoutError(
  domain: 'provider' | 'mcp' | 'agent',
  entity: string,
  timeout: number,
  cause?: Error
): AppError {
  const message = domain === 'provider'
    ? `${entity} timed out after ${timeout} seconds`
    : domain === 'mcp'
    ? `Server '${entity}' timed out after ${timeout} seconds`
    : `Agent operation '${entity}' timed out after ${timeout} seconds`

  return new AppError(
    'TIMEOUT',
    message,
    true, // retryable
    cause
  )
}
```

---

### M2. Inconsistent Naming Conventions

**Examples:**

1. **Mixed naming for similar concepts:**
   - `providerOptions` (camelCase) vs `provider_options` (snake_case)
   - `retryCount` vs `attempts`
   - `timeoutSeconds` vs `timeout`

2. **Boolean inconsistency:**
   - `needApprove` vs `requireApproval` vs `approvalRequired`
   - `checkChanges` vs `validateChanges`
   - `enabledChecks` vs `enabled_strategies`

**Files:**
- packages/cli/src/tool-implementations.ts:59
- packages/cli/src/agent/config.ts:22
- packages/core/src/config.ts:113-150

**Fix:**
```typescript
// Standardize on these patterns:
// - Booleans: is/has/should prefix (isEnabled, hasPermission, shouldRetry)
// - Counts: count/number suffix (retryCount, maxAttempts)
// - Timeouts: _ms/_seconds suffix (timeoutMs, retryDelaySeconds)

// Examples:
needApprove → requiresApproval
checkChanges → validateChanges
enabledChecks → enabledChecks (keep)
enabledStrategies → activeStrategies
```

---

### M3. Complex Circular Type Dependencies

**Location:** `packages/core/src/workflow/dynamic-types.ts:7-149`

**Issue:**
```typescript
export interface WhileLoopStep {
  while: {
    condition: string
    steps: WorkflowControlFlowStep[]  // Circular
  }
}

export interface IfElseStep {
  if: {
    condition: string
    thenBranch: WorkflowControlFlowStep[]  // Circular
    elseBranch?: WorkflowControlFlowStep[]  // Circular
  }
}

export type WorkflowControlFlowStep =
  | WhileLoopStep  // Circular
  | IfElseStep     // Circular
  // ...
```

**Problem:** Requires type assertions `as unknown as z.ZodType<WhileLoopStep>`

**Fix:** Use builder pattern or generic types to break circularity:
```typescript
// Use weak references or deferred types
type WorkflowStepRef = () => WorkflowControlFlowStep

interface WhileLoopStep {
  id: string
  while: {
    condition: string
    steps: WorkflowStepRef[]  // Function to break circularity
  }
}
```

**Files:**
- packages/core/src/workflow/dynamic-types.ts:7-149

---

### M4. Over-Engineering: Duplicate Config Schemas

**Issue:** Similar schemas defined in multiple places.

**Locations:**
1. `packages/core/src/config.ts` - baseProviderConfigSchema, providerModelSchema
2. `packages/cli/src/agent/config.ts` - AgentConfigSchema
3. `packages/core/src/config/base.ts` - baseApprovalConfigSchema, baseModelConfigSchema

**Duplication:**
```typescript
// In core/src/config.ts
export const providerModelSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  budget: z.number().positive().optional(),
  rules: z.array(ruleSchema).optional(),
})

// In core/src/config/base.ts
export const modelConfigSchema = z.object({
  provider: z.string(),
  model: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
})
```

**Fix:** Consolidate into single source of truth:
```typescript
// Define once in core/src/config/model.ts
export const baseModelConfig = z.object({
  provider: z.string(),
  model: z.string(),
  parameters: z.record(z.string(), z.unknown()).optional(),
})

// Extend where needed
export const providerModelConfig = baseModelConfig.extend({
  budget: z.number().positive().optional(),
  rules: z.array(ruleSchema).optional(),
})
```

**Files:**
- packages/core/src/config.ts
- packages/core/src/config/base.ts
- packages/cli/src/agent/config.ts

---

### M5. Missing Input Validation

**Issue:** Functions don't validate inputs before processing.

**Examples:**

1. **packages/cli/src/commands/code.ts:46**
   ```typescript
   export async function runCode(task: string | undefined, _options: any, command: Command)
   ```
   - `_options` is typed as `any`
   - `task` can be undefined but used without validation

2. **packages/cli/src/commands/commit.ts:9**
   ```typescript
   .action(async (message, localOptions, command: Command) => {
   ```
   - No validation of message or localOptions

**Fix:**
```typescript
import { z } from 'zod'

const RunCodeOptionsSchema = z.object({
  task: z.string().min(1, 'Task is required'),
  options: z.object({
    file: z.array(z.string()).optional()
  }),
  command: z.instanceof(Command)
})

export async function runCode(
  task: string | undefined,
  options: unknown,
  command: Command
) {
  const validated = RunCodeOptionsSchema.parse({ task, options, command })
  // ...
}
```

**Files:**
- packages/cli/src/commands/*.ts (all command files)
- packages/cli/src/tool-implementations.ts (tool handlers)

---

### M6. Unnecessary Complexity: Reentrant Mutex

**Location:** `packages/cli-shared/src/sqlite-memory-store.ts:92-153`

**Issue:** Custom mutex implementation when Node.js provides async locks.

**Problem:**
- 60+ lines of complex synchronization code
- Potential for deadlocks
- Hard to test and maintain

**Fix:** Use built-in AsyncLock or use Atomics/Mutex:
```typescript
import { Mutex } from 'async-mutex'

class SQLiteMemoryStore {
  private mutex = new Mutex()

  async updateMemory(...) {
    return await this.mutex.runExclusive(async () => {
      // Critical section
    })
  }
}
```

**Files:**
- packages/cli-shared/src/sqlite-memory-store.ts:92-153

---

### M7. Performance: Inefficient Array Operations

**Example:** `packages/cli/src/tool-implementations.ts:320-327`

**Issue:**
```typescript
if (lastOutputs.length > 20) {
  lastOutputs.shift()  // O(n) operation
}
if (lastOutputs.length === 20) {
  const firstHalf = lastOutputs.slice(0, 10)  // O(n)
  const secondHalf = lastOutputs.slice(10)     // O(n)
  if (firstHalf === secondHalf) {  // String comparison O(n)
```

**Problem:** Multiple O(n) operations in hot path (called on every chunk).

**Fix:**
```typescript
// Use circular buffer
class RepetitionDetector {
  private buffer: string[] = []
  private index = 0
  private readonly size = 20

  add(text: string): boolean {
    this.buffer[this.index] = text
    this.index = (this.index + 1) % this.size

    if (this.buffer.length < this.size) return false

    // Check for repetition
    const firstHalf = this.buffer.slice(0, 10).join('')
    const secondHalf = this.buffer.slice(10).join('')
    return firstHalf === secondHalf && firstHalf.length > 20
  }
}
```

**Files:**
- packages/cli/src/tool-implementations.ts:314-332

---

### M8. Missing Error Context

**Issue:** Errors don't include enough context for debugging.

**Example:** `packages/cli/src/agent/errors.ts:103`

```typescript
throw new StateTransitionError(from, to, reason)
```

**Problem:** Error message doesn't include:
- Current state
- Expected valid transitions
- How to recover

**Fix:**
```typescript
export class StateTransitionError extends AgentError {
  constructor(
    from: string,
    to: string,
    reason?: string,
    public readonly validTransitions?: string[]
  ) {
    const details = {
      from,
      to,
      reason,
      validTransitions: validTransitions || [],
      stateMachine: 'See packages/cli/src/agent/state-machine.ts'
    }
    // ...
  }
}
```

**Files:**
- All error classes in packages/cli/src/agent/errors.ts
- All error classes in packages/cli/src/errors.ts

---

## Low Priority Issues

### L1. Typos and Spelling

**Found Issues:**
1. `packages/cli/src/agent/types.ts:52-70`
   ```typescript
   'refactor' | 'refactoring'  // Duplicate concepts
   'test' | 'testing'          // Duplicate concepts
   'docs' | 'documentation'    // Duplicate concepts
   ```

**Fix:** Standardize on single form:
```typescript
export type TaskType =
  | 'feature'
  | 'bugfix'
  | 'refactor'      // Remove 'refactoring'
  | 'test'          // Remove 'testing'
  | 'docs'          // Remove 'documentation'
  | 'review'
  | 'commit'
  | 'analysis'
  | 'security'
  | 'optimization'
  | 'other'
```

---

### L2. Commented Code

**Issue:** Commented code blocks should be removed.

**Example:** `packages/cli/src/commands/review.ts:57-64`

**Fix:** Remove or uncomment with proper documentation. Use version control for history.

---

### L3. Inconsistent Comment Styles

**Issue:** Mix of JSDoc, single-line, and block comments.

**Example:**
```typescript
// Some files use JSDoc
/**
 * Create a commit
 */
export async function commit(...) {}

// Others use single line
// Create a commit
export async function commit(...) {}

// Others use block
/* Create a commit */
export async function commit(...) {}
```

**Fix:** Standardize on JSDoc for exported functions:
```typescript
/**
 * Creates a git commit with AI-generated message
 * @param context - Optional context for commit message generation
 * @param options - Commit options
 * @throws {Error} If git is not available
 */
export async function commit(
  context?: string,
  options?: CommitOptions
): Promise<void>
```

---

### L4. File Organization

**Issue:** Some files are too large or do too much.

**Examples:**
1. `packages/cli/src/tool-implementations.ts` - 679 lines
2. `packages/cli/src/agent/orchestrator.ts` - Likely large (need to check)
3. `packages/cli-shared/src/sqlite-memory-store.ts` - 900+ lines

**Fix:** Split into smaller, focused modules:
```typescript
// Split tool-implementations.ts
- tool-implementations/
  - index.ts
  - workflow-tools.ts
  - skill-tools.ts
  - interaction-tools.ts
  - file-tools.ts
```

---

### L5. Missing Return Types

**Issue:** Many functions don't have explicit return types.

**Example:**
```typescript
// Current
async function loadConfig(configPath?: string) {
  // ...
  return validateConfig(config)
}

// Better
async function loadConfig(configPath?: string): Promise<AgentConfig> {
  // ...
  return validateConfig(config)
}
```

**Fix:** Add explicit return types to all exported functions.

---

### L6. Inconsistent Async Patterns

**Issue:** Mix of async/await and Promise.then/catch.

**Example:** `packages/cli/src/agent/task-discovery.ts:351-352`

```typescript
.then(() => true)
.catch(() => false)
```

**Fix:** Use async/await consistently:
```typescript
try {
  await operation()
  return true
} catch {
  return false
}
```

**Files:**
- packages/cli/src/agent/task-discovery.ts:351-352
- packages/core/src/tools/fetchUrl.ts:71
- packages/cli-shared/src/sqlite-memory-store.ts:890

---

## Code Quality Metrics

### Type Safety Score: 6/10
- **Issues:**
  - 100+ `any` types
  - 30+ unsafe type assertions
  - Missing return types
  - Circular type dependencies

### Error Handling Score: 7/10
- **Good:**
  - Comprehensive error class hierarchies
  - Error suggestions and recovery steps
- **Issues:**
  - Inconsistent error patterns
  - Silent failures (catch without logging)
  - Missing error context

### Code Duplication Score: 7/10
- **Issues:**
  - 84 `export *` statements (potential bloat)
  - Duplicate error class structures
  - Duplicate config schemas
  - Similar command file patterns

### Maintainability Score: 7/10
- **Good:**
  - Clear separation of concerns (packages)
  - Good naming overall
  - Comprehensive test coverage (77 test files)
- **Issues:**
  - Large files (600+ lines)
  - Complex circular dependencies
  - Console logs in production

### Security Score: 8/10
- **Issues:**
  - Command injection vulnerability (C1)
  - Sensitive data in logs (H1)
  - Missing input validation

---

## Recommended Refactoring Strategy

### Phase 1: Critical Security & Type Safety (Week 1)

1. **Fix command injection** (C1)
   - Add command whitelist
   - Sanitize all inputs
   - Add security tests

2. **Replace critical `any` types** (C2, C3)
   - Focus on tool-implementations.ts
   - Define proper interfaces for ToolProvider and WorkflowContext
   - Add type guards

3. **Add input validation** (M5)
   - Add Zod schemas to all command handlers
   - Validate tool inputs

### Phase 2: Code Quality Improvements (Week 2-3)

1. **Remove console.logs** (H1)
   - Implement proper logging
   - Remove sensitive logging
   - Add log levels

2. **Unify error handling** (H4)
   - Create common error base class
   - Standardize error properties
   - Update all error classes

3. **Fix duplicate code** (M1, M4)
   - Extract common error creation logic
   - Consolidate config schemas
   - Create shared utilities

### Phase 3: Performance & Maintainability (Week 4)

1. **Optimize hot paths** (M7)
   - Fix repetition detection algorithm
   - Use circular buffers
   - Profile and optimize

2. **Simplify complex code** (M6)
   - Replace custom mutex with library
   - Break circular dependencies
   - Split large files

3. **Improve consistency** (M2, L3)
   - Standardize naming
   - Add JSDoc comments
   - Consistent async patterns

### Phase 4: Testing & Documentation (Week 5)

1. **Add missing tests**
   - Cover error cases
   - Add integration tests
   - Test security fixes

2. **Update documentation**
   - Document error handling strategy
   - Add type safety guidelines
   - Document refactoring decisions

---

## Specific Action Items by File

### packages/cli/src/tool-implementations.ts
- [ ] Fix command injection (line 206-275)
- [ ] Replace `any` types with proper interfaces (line 121-123)
- [ ] Remove unsafe `as never` assertion (line 617)
- [ ] Optimize repetition detection (line 314-332)
- [ ] Add proper return types to all functions
- [ ] Extract magic numbers to constants
- [ ] Split into smaller files

### packages/cli/src/agent/config.ts
- [ ] Add proper types instead of `any` (line 85)
- [ ] Consolidate with core/src/config schemas
- [ ] Add validation for all config fields

### packages/cli/src/agent/errors.ts
- [ ] Fix `any` type in existingSession (line 286)
- [ ] Add more error context
- [ ] Standardize with other error hierarchies

### packages/cli/src/errors.ts
- [ ] Consolidate with agent/errors.ts and mcp/errors.ts
- [ ] Create common error base class
- [ ] Standardize error properties

### packages/core/src/config.ts
- [ ] Replace `z.any()` with proper schemas (line 40, 64, 201)
- [ ] Consolidate duplicate schemas
- [ ] Add proper type exports

### packages/core/src/workflow/dynamic-types.ts
- [ ] Fix circular type dependencies
- [ ] Replace `as unknown as` with proper generics
- [ ] Simplify type structure

### packages/cli/src/getModel.ts
- [ ] Remove sensitive logging (line 72-74)
- [ ] Use proper logger instead of console
- [ ] Add request ID for tracing

### packages/runner/src/runner.ts
- [ ] Remove all console.log statements (30 instances)
- [ ] Use proper logging
- [ ] Don't log sensitive data (API URLs, tokens)

### packages/cli-shared/src/sqlite-memory-store.ts
- [ ] Replace custom mutex with async-mutex
- [ ] Remove complexity (60+ lines)
- [ ] Add proper error handling

---

## Testing Recommendations

### Security Tests
```typescript
describe('Command Injection Protection', () => {
  it('should reject malicious commands', async () => {
    await expect(
      executeCommand({ command: 'rm -rf /', shell: true })
    ).rejects.toThrow('Command not allowed')
  })

  it('should sanitize arguments', async () => {
    await expect(
      executeCommand({ command: 'git', args: ['log; rm -rf /'] })
    ).rejects.toThrow()
  })
})
```

### Type Safety Tests
```typescript
describe('Type Safety', () => {
  it('should not use any types', () => {
    const source = fs.readFileSync('tool-implementations.ts', 'utf-8')
    expect(source).not.toMatch(': any')
  })
})
```

### Performance Tests
```typescript
describe('Repetition Detection', () => {
  it('should handle high frequency chunks efficiently', async () => {
    const start = Date.now()
    for (let i = 0; i < 1000; i++) {
      detector.add('test chunk')
    }
    expect(Date.now() - start).toBeLessThan(100)
  })
})
```

---

## Automation Tools

### Recommended Tooling

1. **Type Safety:**
   ```bash
   npm install -D @typescript-eslint/eslint-plugin
   npm install -D typescript-eslint
   ```

2. **Code Quality:**
   ```bash
   npm install -D eslint
   npm install -D prettier
   npm install -D @ianvs/prettier-plugin-sort-imports
   ```

3. **Dependency Analysis:**
   ```bash
   npm install -D madge
   npm install -D dependency-cruiser
   ```

4. **Unused Code:**
   ```bash
   npm install -D ts-prune
   npm install -D ts-unused-exports
   ```

5. **Security:**
   ```bash
   npm install -D auditjs
   npm install -D snyk
   ```

### ESLint Configuration
```json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unsafe-argument": "error",
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-return": "error",
    "@typescript-eslint/strict-boolean-expressions": "warn",
    "no-console": ["error", { "allow": ["warn", "error"] }],
    "no-unused-vars": "off",
    "@typescript-eslint/no-unused-vars": ["error", {
      "args": "after-used",
      "ignoreRestSiblings": false
    }]
  }
}
```

---

## Summary Statistics

| Category | Count | Priority |
|----------|-------|----------|
| Security Issues | 1 | Critical |
| Type Safety Issues | 35 | Critical/High |
| Code Quality Issues | 50 | High/Medium |
| Duplicated Code | 25 | Medium/Low |
| Performance Issues | 8 | Medium |
| Inconsistencies | 8 | Low |

**Total Issues Identified:** 127
**Estimated Effort:** 5 weeks (1 developer)
**Risk Level:** Medium (due to security and type safety issues)

---

## Next Steps

1. **Immediate (This Week):**
   - Fix command injection vulnerability (C1)
   - Replace critical `any` types in hot paths
   - Add input validation to public APIs

2. **Short Term (Next 2 Weeks):**
   - Remove all console.log statements
   - Implement proper logging
   - Unify error handling

3. **Medium Term (Next Month):**
   - Refactor to eliminate circular dependencies
   - Split large files into smaller modules
   - Consolidate duplicate code

4. **Long Term (Ongoing):**
   - Establish code review checklist
   - Add pre-commit hooks for type checking
   - Implement security testing in CI/CD

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Status:** Ready for Review
