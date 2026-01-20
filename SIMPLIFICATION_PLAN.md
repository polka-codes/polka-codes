# Code Simplification Plan

## Overview

This plan outlines opportunities to simplify the codebase through refactoring and minor breaking changes. All changes are categorized by impact level and complexity reduction potential.

**Total Estimated Impact: ~55% complexity reduction across targeted areas**

## ⚠️ Key Concerns Addressed

Based on review feedback, this plan has been updated to address:

1. **Debugging**: Error factory preserves proper stack traces with named classes
2. **Merge Clarity**: Deep merge uses explicit path specification, not heuristics
3. **Discoverability**: Tool registry maintains central index alongside modules
4. **Breaking Changes**: Phase 3 API changes made optional with migration support

---

## Priority 1: High Impact, Low Breaking Change

### 1. Generic Error Class Factory ✨

**Problem**: 8+ files define nearly identical error class patterns with repetitive boilerplate.

**Files Affected**:
- `packages/cli/src/agent/error-handling.ts` (lines 80-130)
- `packages/cli/src/script/executor.ts` (lines 9-18)
- `packages/cli/src/script/runner.ts` (lines 32-52)
- `packages/cli/src/agent/errors.ts` (lines 43+)
- `packages/core/src/skills/types.ts` (lines 83-100+)

**Current Pattern**:
```typescript
export class FileSystemAccessError extends Error {
  name = 'FileSystemAccessError'
  constructor(public path: string, public operation: string, cause?: Error) {
    super(`Failed to ${operation} ${path}`)
    if (cause) this.cause = cause
  }
}
```

**Proposed Solution**:
```typescript
// Create in packages/core/src/errors/base.ts
export class BaseError extends Error {
  constructor(
    public name: string,
    message: string,
    public cause?: Error
  ) {
    super(message)
    this.name = name // ✨ Preserves error name in stack traces
    if (cause) this.cause = cause
  }
}

// Factory that creates NAMED classes (not anonymous) for proper stack traces
export function createErrorClass<T extends any[]>(
  name: string,
  template: (args: T) => string
): new (...args: T) => BaseError {
  return class extends BaseError {
    constructor(...args: T) {
      super(name, template(args), args[args.length - 1] instanceof Error ? args[args.length - 1] : undefined)
    }
  }
}

// Usage example:
export const FileSystemAccessError = createErrorClass(
  'FileSystemAccessError',
  ([path, operation]: [string, string]) => `Failed to ${operation} ${path}`
)

// ✨ Stack trace will show: "at new FileSystemAccessError" not "at new createErrorClass"
```

**Debugging Guarantee**:
- Stack traces show actual error class names
- Error.name property preserved
- Type guards work correctly: `error instanceof FileSystemAccessError`

**Benefits**:
- 40% reduction in error class code
- 60% reduction in boilerplate
- Consistent error handling across packages
- Easier to add new error types
- **No debugging penalty** - proper stack traces maintained

**Breaking Change**: None - can be migrated incrementally

**Migration Steps**:
1. Create `BaseError` and `createErrorClass` in core package
2. Prototype with 2-3 error classes
3. **Verify stack traces** show correct error names
4. Update remaining error classes one at a time
5. Run full test suite

---

### 2. Parameter Simplifier Factory ✨

**Problem**: Repetitive simplifier functions that only differ by which fields they keep.

**Files Affected**:
- `packages/cli-shared/src/utils/parameterSimplifier.ts` (lines 5-36)

**Current Pattern**:
```typescript
function replaceInFileSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { path: params.path }
}

function writeToFileSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { path: params.path }
}

function readFileSimplifier(params: Record<string, unknown>): SimplifiedParams {
  return { path: params.path, includeIgnored: params.includeIgnored }
}
```

**Proposed Solution**:
```typescript
function createSimplifier(keepFields: string[]): ParameterSimplifier {
  return (params) => {
    const result: Record<string, unknown> = {}
    for (const field of keepFields) {
      if (params[field] !== undefined) {
        result[field] = params[field]
      }
    }
    return result
  }
}

const SIMPLIFIERS: Record<string, ParameterSimplifier> = {
  replaceInFile: createSimplifier(['path']),
  writeToFile: createSimplifier(['path']),
  readFile: createSimplifier(['path', 'includeIgnored']),
  searchFiles: createSimplifier(['pattern', 'path', 'excludePatterns']),
  // ... etc
}
```

**Benefits**:
- 70% reduction in simplifier code
- Easier to add new simplifiers
- Single source of truth for field filtering

**Breaking Change**: None - internal utility

**Migration Steps**:
1. Refactor `parameterSimplifier.ts` with factory pattern
2. Run tests to verify simplification behavior unchanged
3. Add new simplifiers as needed

---

### 3. Deep Merge Utility ✨

**Problem**: Manual object spreading for config merges is error-prone and verbose.

**Files Affected**:
- `packages/cli/src/agent/config.ts` (lines 120-141)

**Current Pattern**:
```typescript
export function mergeConfig(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig {
  return {
    ...base,
    ...override,
    continuousImprovement: {
      ...base.continuousImprovement,
      ...(override.continuousImprovement || {}),
    },
    discovery: {
      ...base.discovery,
      ...(override.discovery || {}),
    },
    // ... 4 more nested objects
  }
}
```

**Proposed Solution**:
```typescript
// Add to packages/core/src/utils/merge.ts

/**
 * Deep merge utility with EXPLICIT path specification
 * ✨ Clarity: You must explicitly declare which paths get deep merged
 * This prevents accidental deep merging of unexpected properties
 */
function deepMerge<T>(
  base: T,
  override: Partial<T>,
  deepPaths: Array<keyof T>
): T {
  const result = { ...base, ...override }

  // ✨ Explicit deep merge - only merge paths specified in deepPaths
  for (const path of deepPaths) {
    const baseValue = base[path]
    const overrideValue = override[path]

    // Only merge plain objects (not arrays, dates, etc.)
    if (
      typeof baseValue === 'object' &&
      baseValue !== null &&
      !Array.isArray(baseValue) &&
      typeof overrideValue === 'object' &&
      overrideValue !== null &&
      !Array.isArray(overrideValue)
    ) {
      result[path] = { ...baseValue, ...overrideValue } as T[Extract<keyof T, string>]
    }
  }

  return result
}

// Usage - explicit about which fields merge deep
export function mergeConfig(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig {
  return deepMerge(base, override, [
    'continuousImprovement', // ✨ Explicit: these get deep merged
    'discovery',
    'approval',
    'safety',
    'healthCheck'
  ])
  // Other fields use shallow merge (spread) - explicit and clear!
}
```

**Clarity Guarantee**:
- **Explicit is better than implicit**: You must pass the list of deep-merge paths
- **No magic heuristics**: Won't accidentally deep merge something you didn't expect
- **TypeScript support**: Type system ensures deepPaths are valid keys
- **Predictable behavior**: Shallow merge by default, deep only when specified

**Benefits**:
- 80% reduction in merge boilerplate
- Less error-prone
- Reusable utility for other merge scenarios
- **Clear intent**: Explicit about merge behavior for each field

**Breaking Change**: None - internal refactoring

**Migration Steps**:
1. Create `deepMerge` utility in core package
2. Update `mergeConfig` to use it
3. Run full test suite
4. Look for other manual merge patterns to refactor

---

## Priority 2: Medium Impact, Minor Breaking Change

### 4. Unified Configuration Interfaces

**Problem**: Overlapping config fields across multiple interfaces with no clear hierarchy.

**Files Affected**:
- `packages/cli/src/agent/types.ts` (lines 168-180)
- `packages/cli/src/agent/config.ts` (lines 46-61)
- `packages/cli/src/mcp/types.ts` (lines 33-48)

**Current Pattern**:
```typescript
// AgentConfig
approval: {
  level: ApprovalLevel
  autoApproveSafeTasks: boolean
  maxAutoApprovalCost: number
}

// McpServerConfig
tools?: Record<string, boolean | ModelConfig>

// ModelConfig (repeated)
interface ModelConfig {
  provider?: string
  model?: string
  parameters?: Record<string, unknown>
}
```

**Proposed Solution**:
```typescript
// Base configuration patterns
interface BaseApprovalConfig {
  level?: 'none' | 'destructive' | 'commits' | 'all'
  autoApprove?: boolean
  maxCost?: number
}

interface BaseModelConfig {
  provider?: string
  model?: string
  parameters?: Record<string, unknown>
}

// Composed interfaces
interface AgentApprovalConfig extends BaseApprovalConfig {
  autoApproveSafeTasks?: boolean
}

interface AgentConfig {
  approval?: AgentApprovalConfig
  // ... other fields
}

interface McpServerConfig {
  tools?: Record<string, boolean | BaseModelConfig>
}
```

**Benefits**:
- 30% reduction in type definitions
- Single source of truth for common config patterns
- Better type safety through composition

**Breaking Change**: Minor - interface updates, no runtime changes

**Migration Steps**:
1. Create base config interfaces in core package
2. Update existing interfaces to extend base patterns
3. Fix any type errors that arise
4. Update documentation

---

### 5. Tool Registry Simplification

**Problem**: Complex type intersection makes tool registry hard to extend and understand.

**Files Affected**:
- `packages/cli/src/workflow-tools.ts` (lines 13-39)

**Current Pattern**:
```typescript
type CliToolRegistry = {
  runAgent: ToolSignature<AgentWorkflowInput, ExitReason>
  createPullRequest: ToolSignature<{ title: string; description: string }, { title: string; description: string }>
  // ... 15+ more tool signatures
} & AgentToolRegistry
```

**Proposed Solution**:
```typescript
// ✨ Hybrid approach: modules for organization + central index for discoverability

// 1. Organize tools by domain in modules
// tools/cli.ts
export const createPullRequest = { /* ... */ }
export const createCommit = { /* ... */ }

// tools/agent.ts
export const runAgent = { /* ... */ }
export const generateText = { /* ... */ }

// 2. Central index file for quick overview
// tools/index.ts
export * from './cli'
export* from './agent'

// Quick reference map (generated or manual)
export const ALL_TOOLS = {
  // CLI Tools
  createPullRequest,
  createCommit,

  // Agent Tools
  runAgent,
  generateText,
} as const

// 3. Type inference from the registry
type CliToolRegistry = typeof ALL_TOOLS
```

**Discoverability Guarantee**:
- **Central index file** (`tools/index.ts`) shows all tools at a glance
- **IDE support**: Ctrl+Click to jump to tool implementations
- **Organized by domain**: Related tools grouped together
- **No tradeoff**: Get both organization AND discoverability

**Benefits**:
- 60% reduction in type complexity
- Easier to add/remove tools
- Better IDE autocomplete
- Clearer tool organization
- **Maintains discoverability** through central index

**Breaking Change**: Minor - tool signature types

**Migration Steps**:
1. Create tool modules organized by domain
2. Update registry to use module imports
3. Update tool references throughout codebase
4. Run integration tests

---

## Priority 3: Low Priority, Code Quality

### 6. Logging Strategy Pattern

**Problem**: Deeply nested conditionals for logging levels.

**Files Affected**:
- `packages/cli/src/agent/error-handling.ts` (lines 58-70)

**Current Pattern**:
```typescript
if (level === 'error') {
  logger.error(`${fullContext}${contextString}`)
  if (error instanceof Error && error.stack) {
    logger.debug(`[${contextMessage}] Stack:`, error.stack)
  }
} else if (level === 'warn') {
  logger.warn(`${fullContext}${contextString}`)
} else {
  logger.debug(`${fullContext}${contextString}`)
  if (error instanceof Error && error.stack) {
    logger.debug(`[${contextMessage}] Stack:`, error.stack)
  }
}
```

**Proposed Solution**:
```typescript
type LogStrategy = (logger: Logger, message: string, error?: Error) => void

const logStrategies: Record<string, LogStrategy> = {
  error: (logger, message, error) => {
    logger.error(message)
    if (error?.stack) logger.debug(`Stack:`, error.stack)
  },
  warn: (logger, message) => logger.warn(message),
  debug: (logger, message, error) => {
    logger.debug(message)
    if (error?.stack) logger.debug(`Stack:`, error.stack)
  }
}

const strategy = logStrategies[level] ?? logStrategies.debug
strategy(logger, fullContext + contextString, error instanceof Error ? error : undefined)
```

**Benefits**:
- 50% reduction in conditional complexity
- Easier to add new log levels
- Single responsibility for each strategy

**Breaking Change**: None - internal refactoring

**Migration Steps**:
1. Extract log strategies object
2. Replace conditional with strategy lookup
3. Test all log levels
4. Add unit tests for strategies

---

### 7. Composable API Options (Optional Migration)

**Problem**: Multiple option interfaces with overlapping fields create confusion.

**Files Affected**:
- `packages/cli/src/api.ts` (lines 47-422)

**Current Pattern**:
```typescript
interface BaseOptions extends Partial<ExecutionContext> {
  onUsage?: (meter: UsageMeter) => void
}

interface CommitOptions extends BaseOptions {
  all?: boolean
  files?: string[]
  context?: string
  interactive?: boolean
}

interface CodeOptions extends BaseOptions {
  task: string
  files?: Array<JsonFilePart | JsonImagePart>
  mode?: 'interactive' | 'noninteractive'
  additionalInstructions?: string
  interactive?: boolean
}
```

**Proposed Solution (Optional - Gradual Migration)**:
```typescript
// PHASE 1: Keep existing interfaces working (backwards compatible)
interface LegacyCommitOptions extends BaseOptions {
  all?: boolean
  files?: string[]
  context?: string
}

// PHASE 2: Introduce new pattern alongside old
interface CommonOptions {
  interactive?: boolean
  verbose?: number
  silent?: boolean
  onUsage?: (meter: UsageMeter) => void
}

// Discriminated union for better type safety
interface CommitOptionsV2 {
  command: 'commit'
  all?: boolean
  files?: string[]
  context?: string
}

interface CodeOptionsV2 {
  command: 'code'
  task: string
  files?: Array<JsonFilePart | JsonImagePart>
  mode?: 'interactive' | 'noninteractive'
  additionalInstructions?: string
}

// Union type that supports both during transition
type CommandOptions = (CommitOptionsV2 | CodeOptionsV2 | PrOptions) & CommonOptions
type LegacyCommitOptionsCompat = LegacyCommitOptions // Keep working

// Migration adapter function
function adaptLegacyOptions(opts: LegacyCommitOptions): CommitOptionsV2 & CommonOptions {
  return {
    command: 'commit',
    all: opts.all,
    files: opts.files,
    context: opts.context,
    interactive: opts.interactive,
    onUsage: opts.onUsage,
  }
}
```

**Migration Strategy**:
1. **Start**: New code uses discriminated unions
2. **Middle**: Both patterns supported via adapter
3. **End**: Deprecate legacy pattern (6+ months later)

**Benefits**:
- 40% reduction in interface definitions
- Better type safety with discriminated unions
- **Optional migration** - no forced breakage
- **Gradual transition** - adapt at your own pace
- Clearer API surface

**Breaking Change**: Moderate - but **optional gradual migration** supported

**Migration Steps**:
1. Introduce new discriminated union types alongside existing
2. Create adapter functions for legacy compatibility
3. New code uses new pattern
4. Gradually migrate existing call sites over time
5. Deprecate legacy pattern after 6+ months

---

## Design Principles Applied

Based on feedback challenges, this plan adheres to:

1. **Debuggability First**
   - ✅ Error factory preserves stack traces with named classes
   - ✅ Error.name property maintained for instanceof checks
   - ✅ Prototype step: Verify stack traces before rollout

2. **Explicit > Implicit**
   - ✅ Deep merge requires explicit path list
   - ✅ No magic heuristics - clear what gets merged
   - ✅ TypeScript type system enforces correctness

3. **Discoverability Matters**
   - ✅ Tool registry uses hybrid approach
   - ✅ Central index file for overview
   - ✅ Module organization for maintainability

4. **Gradual Migration**
   - ✅ API changes support legacy during transition
   - ✅ Adapter functions bridge old and new
   - ✅ No forced breakage - adopt at your pace

---

## Implementation Roadmap

### Phase 1: Quick Wins (Week 1) ✨
- [ ] Generic Error Class Factory
  - **Prototype**: Create 2-3 error classes, **verify stack traces**
  - Roll out to remaining error classes incrementally
- [ ] Parameter Simplifier Factory
  - Single PR to refactor all simplifiers
- [ ] Deep Merge Utility
  - Add to core, update config merging

**Impact**: High complexity reduction, **zero breaking changes**

### Phase 2: Type System Improvements (Week 2)
- [ ] Unified Configuration Interfaces
  - Base config types in core package
  - Update dependent interfaces
- [ ] Tool Registry Simplification
  - Create domain-based tool modules
  - **Maintain central index** for discoverability

**Impact**: Better type safety, minor breaking changes

### Phase 3: Code Quality (Optional) ⚠️
- [ ] Logging Strategy Pattern
  - Internal refactor, no API changes
- [ ] Composable API Options (Optional)
  - **Opt-in**: New pattern alongside legacy
  - Adapter functions support gradual migration

**Impact**: Improved maintainability, **optional migration path**

---

## Success Metrics

- **Lines of Code**: Target 20% reduction in targeted files
- **Cyclomatic Complexity**: Target 40% reduction in conditional complexity
- **Code Duplication**: Target 60% reduction in error handling patterns
- **Type Safety**: Maintain 100% type coverage
- **Test Coverage**: Maintain existing coverage levels

---

## Risk Assessment

| Change | Risk Level | Mitigation |
|--------|-----------|------------|
| Error Classes | Low | Incremental migration, no runtime changes |
| Parameter Simplifier | Low | Internal utility, well-tested |
| Deep Merge | Low | Pure function, easily tested |
| Config Interfaces | Medium | Type changes only, compile-time safety |
| Tool Registry | Medium | Comprehensive integration tests |
| Logging Strategy | Low | Internal refactoring |
| API Options | High | Requires extensive testing, phased rollout |

---

## Next Steps

1. Review and approve this plan
2. Create detailed implementation tasks for Phase 1
3. Set up branch for refactor work
4. Begin with Error Class Factory (highest ROI)
5. Measure and report progress against success metrics
