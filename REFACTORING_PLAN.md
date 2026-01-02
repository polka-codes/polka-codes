# Codebase Refactoring Plan

**Generated:** 2025-12-31
**Status:** Draft
**Priority:** High

## Executive Summary

This document outlines a comprehensive refactoring plan to address code complexity issues identified in the polka-codes codebase. The plan focuses on improving maintainability, testability, and extensibility by breaking down large functions, reducing duplication, and improving separation of concerns.

---

## Issues at a Glance

### Critical Issues (8 identified)
- 🔴 **4 long functions** (>100 lines each)
- 🔴 **3 functions** with excessive parameters (8-11 parameters)
- 🔴 **6 areas** with deeply nested logic (5-6 levels)

### Moderate Issues (12 identified)
- 🟡 **5+ patterns** of duplicated code
- 🟡 **3 complex type definitions** using intersection types
- 🟡 **Poor separation of concerns** in 4 major workflows

---

## Phase 1: Extract Common Utilities (Quick Wins)

**Estimated Effort:** 2-3 days
**Impact:** Reduces duplication by ~200 lines
**Risk:** Low

### 1.1 Create Git Operations Helper

**Files Affected:**
- `packages/cli/src/workflows/review.workflow.ts`
- `packages/cli/src/workflows/fix.workflow.ts`
- `packages/cli/src/workflows/commit.workflow.ts`

**Problem:**
Git file change parsing logic duplicated 3+ times across workflows. Each occurrence has:
```typescript
const diffResult = await tools.executeCommand({
  command: 'git',
  args: ['--no-pager', 'diff', '--name-status', '--no-color', range],
})
// +10 more lines of parsing logic
```

**Solution:**
Create `packages/cli/src/git-operations.ts`:

```typescript
export interface GitFileChange {
  path: string
  status: 'A' | 'D' | 'M' | 'R' | 'C'
  insertions?: number
  deletions?: number
}

export class GitOperations {
  constructor(private tools: WorkflowTools<CliToolRegistry>) {}

  async getFileChanges(range?: string): Promise<GitFileChange[]> {
    const diffArgs = range
      ? ['--no-pager', 'diff', '--name-status', '--no-color', range]
      : ['--no-pager', 'diff', '--name-status', '--no-color', 'HEAD']

    const diffResult = await this.tools.executeCommand({
      command: 'git',
      args: diffArgs,
    })

    if (diffResult.exitCode !== 0) {
      throw new Error(`Git diff failed: ${diffResult.stderr}`)
    }

    const files = this.parseNameStatus(diffResult.stdout)
    await this enrichWithNumStats(files, range)
    return files
  }

  private parseNameStatus(stdout: string): GitFileChange[] {
    // Parse "M\tpath/to/file" format
  }

  private async enrichWithNumStats(files: GitFileChange[], range?: string) {
    // Add insertions/deletions using git diff --numstat
  }
}
```

**Benefits:**
- Removes ~30 lines of duplication per usage
- Centralizes git error handling
- Easier to test git operations independently
- Consistent behavior across all workflows

---

### 1.2 Create Agent Workflow Builder

**Files Affected:**
- `packages/cli/src/workflows/plan.workflow.ts`
- `packages/cli/src/workflows/fix.workflow.ts`
- `packages/cli/src/workflows/code.workflow.ts`
- `packages/cli/src/workflows/epic.workflow.ts`
- `packages/cli/src/workflows/review.workflow.ts`

**Problem:**
Tool list construction duplicated 5+ times:
```typescript
const agentTools: FullToolInfo[] = [
  readFile, writeToFile, replaceInFile, searchFiles,
  listFiles, executeCommand, fetchUrl, readBinaryFile,
  removeFile, renameFile,
]
if (additionalTools?.search) {
  agentTools.push(additionalTools.search)
}
if (additionalTools?.mcpTools) {
  agentTools.push(...additionalTools.mcpTools)
}
```

**Solution:**
Create `packages/cli/src/workflows/agent-builder.ts`:

```typescript
export interface AgentToolConfig {
  includeInteractive?: boolean
  additionalTools?: {
    search?: FullToolInfo
    mcpTools?: FullToolInfo[]
  }
}

export function buildAgentToolList(config: AgentToolConfig = {}): FullToolInfo[] {
  const tools: FullToolInfo[] = [
    readFile,
    writeToFile,
    replaceInFile,
    searchFiles,
    listFiles,
    executeCommand,
    fetchUrl,
    readBinaryFile,
    removeFile,
    renameFile,
  ]

  if (config.includeInteractive) {
    tools.push(askFollowupQuestion)
  }

  if (config.additionalTools?.search) {
    tools.push(config.additionalTools.search)
  }

  if (config.additionalTools?.mcpTools) {
    tools.push(...config.additionalTools.mcpTools)
  }

  return tools
}

// Typed wrapper for consistent error handling
export async function runAgentWithSchema<T extends z.ZodSchema>(
  input: {
    systemPrompt: string
    userMessage: string
    tools?: FullToolInfo[]
    schema: T
    toolConfig?: AgentToolConfig
  },
  context: WorkflowContext<CliToolRegistry>
): Promise<z.infer<T>> {
  const tools = input.tools || buildAgentToolList(input.toolConfig)

  const result = await agentWorkflow(
    {
      systemPrompt: input.systemPrompt,
      userMessage: [{ role: 'user', content: input.userMessage }],
      tools,
      outputSchema: input.schema,
    },
    context,
  )

  if (result.type !== 'Exit' || !result.object) {
    throw new Error(`Agent workflow failed with type: ${result.type}`)
  }

  return result.object as z.infer<T>
}
```

**Benefits:**
- Removes ~15 lines of duplication per usage
- Consistent tool list across all workflows
- Centralized error handling for agent workflows
- Type-safe schema validation wrapper

---

### 1.3 Create File Attachment Helper

**Files Affected:**
- `packages/cli/src/workflows/epic.workflow.ts`
- `packages/cli/src/workflows/plan.workflow.ts`
- `packages/cli/src/workflows/code.workflow.ts`

**Problem:**
File attachment logic duplicated 3+ times:
```typescript
if (files) {
  for (const file of files) {
    if (file.type === 'file') {
      content.push({
        type: 'file',
        mediaType: file.mediaType,
        filename: file.filename,
        data: { type: 'base64', value: file.data },
      })
    } else if (file.type === 'image') {
      content.push({
        type: 'image',
        mediaType: file.mediaType,
        image: { type: 'base64', value: file.image },
      })
    }
  }
}
```

**Solution:**
Add to `packages/cli/src/workflows/workflow.utils.ts`:

```typescript
export function attachFilesToContent(
  content: JsonUserContent,
  files?: (JsonFilePart | JsonImagePart)[]
): JsonUserContent {
  if (!files || files.length === 0) return content

  for (const file of files) {
    if (file.type === 'file') {
      content.push({
        type: 'file',
        mediaType: file.mediaType,
        filename: file.filename,
        data: { type: 'base64', value: file.data },
      })
    } else if (file.type === 'image') {
      content.push({
        type: 'image',
        mediaType: file.mediaType,
        image: { type: 'base64', value: file.image },
      })
    }
  }

  return content
}
```

**Benefits:**
- Removes ~15 lines of duplication per usage
- Single place to update file attachment logic
- Easier to add new file types in future

---

## Phase 2: Break Down Large Functions (Critical)

**Estimated Effort:** 5-7 days
**Impact:** Improves maintainability of core workflows
**Risk:** Medium (requires careful testing)

### 2.1 Refactor Dynamic Workflow Control Flow

**File:** `packages/core/src/workflow/dynamic.ts`
**Function:** `executeControlFlowStep` (238 lines!)

**Problem:**
One massive function handles all control flow types:
- While loops
- If/else branches
- Try/catch blocks
- Break/continue statements
- Basic steps

**Solution:**
Use Strategy Pattern with separate handlers:

```typescript
// Step execution strategy interface
interface StepExecutionStrategy {
  canHandle(step: WorkflowControlFlowStep): boolean
  execute(
    step: WorkflowControlFlowStep,
    ctx: ControlFlowExecutionContext
  ): Promise<StepExecutionResult>
}

// Context object to group related parameters
interface ControlFlowExecutionContext {
  workflowId: string
  input: Record<string, any>
  state: Record<string, any>
  context: WorkflowContext<TTools>
  options: DynamicWorkflowRunnerOptions
  runInternal: (string, Record<string, any>, WorkflowContext<TTools>, Record<string, any>) => Promise<any>
  loopDepth: number
  breakFlag: { value: boolean }
  continueFlag: { value: boolean }
}

// Individual strategy implementations
class WhileLoopStrategy implements StepExecutionStrategy {
  canHandle(step: WorkflowControlFlowStep): boolean {
    return typeof step === 'object' && step !== null && 'while' in step
  }

  async execute(step: WorkflowControlFlowStep, ctx: ControlFlowExecutionContext) {
    // Lines 610-673 from current implementation
  }
}

class IfElseStrategy implements StepExecutionStrategy {
  canHandle(step: WorkflowControlFlowStep): boolean {
    return typeof step === 'object' && step !== null && 'if' in step
  }

  async execute(step: WorkflowControlFlowStep, ctx: ControlFlowExecutionContext) {
    // Lines 676-728 from current implementation
  }
}

class TryCatchStrategy implements StepExecutionStrategy {
  canHandle(step: WorkflowControlFlowStep): boolean {
    return typeof step === 'object' && step !== null && 'try' in step
  }

  async execute(step: WorkflowControlFlowStep, ctx: ControlFlowExecutionContext) {
    // Lines 731-806 from current implementation
  }
}

class BasicStepStrategy implements StepExecutionStrategy {
  canHandle(step: WorkflowControlFlowStep): boolean {
    return 'id' in step && 'task' in step
  }

  async execute(step: WorkflowControlFlowStep, ctx: ControlFlowExecutionContext) {
    // Lines 808-812 from current implementation
  }
}

// Main executor using strategies
class ControlFlowExecutor {
  private strategies: StepExecutionStrategy[] = [
    new BreakStrategy(),
    new ContinueStrategy(),
    new WhileLoopStrategy(),
    new IfElseStrategy(),
    new TryCatchStrategy(),
    new BasicStepStrategy(),
  ]

  async executeStep(
    step: WorkflowControlFlowStep,
    ctx: ControlFlowExecutionContext
  ): Promise<StepExecutionResult> {
    for (const strategy of this.strategies) {
      if (strategy.canHandle(step)) {
        return await strategy.execute(step, ctx)
      }
    }

    throw new Error(`Unknown step type: ${JSON.stringify(step)}`)
  }
}
```

**Migration Steps:**
1. Create new file: `packages/core/src/workflow/control-flow-executor.ts`
2. Implement strategy classes one by one
3. Add unit tests for each strategy
4. Replace `executeControlFlowStep` with `ControlFlowExecutor`
5. Run all tests to verify behavior unchanged
6. Delete old implementation

**Benefits:**
- 238-line function → ~80 lines across 7 focused classes
- Easy to add new control flow types
- Each strategy independently testable
- Clear separation of concerns

---

### 2.2 Refactor Epic Workflow

**File:** `packages/cli/src/workflows/epic.workflow.ts`
**Function:** `epicWorkflow` (132 lines)

**Problem:**
God function handling 10+ responsibilities:
- Preflight checks
- Plan creation
- Branch management
- Todo management
- Implementation loop
- Review cycles
- Cleanup
- Usage reporting

**Solution:**
Split into orchestrator + specialized managers:

```typescript
// Epic workflow orchestrator
class EpicWorkflowOrchestrator {
  constructor(
    private git: EpicGitManager,
    private planner: EpicPlanManager,
    private todos: EpicTodoManager,
    private reviewer: EpicReviewManager,
    private cleanup: EpicCleanupManager,
    private reporter: UsageReporter
  ) {}

  async execute(input: EpicWorkflowInput): Promise<EpicWorkflowOutput> {
    // Preflight checks
    await this.git.preflightCheck(input.branch)

    // Plan creation
    const plan = await this.planner.createAndApprovePlan(input)

    // Branch setup
    await this.git.createAndCheckoutBranch(plan.branchName)

    // Todo initialization
    await this.todos.initializeFromPlan(plan)

    // Main implementation loop
    await this.runImplementationLoop(plan)

    // Final review
    await this.reviewer.performFinalReview(plan)

    // Cleanup
    await this.cleanup.perform()

    // Report usage
    this.reporter.report()

    return { success: true }
  }

  private async runImplementationLoop(plan: Plan): Promise<void> {
    // Extract current lines 495-611 to this method
    // Use other managers for sub-tasks
  }
}

// Manager implementations (in separate files)

// epic-git-manager.ts
class EpicGitManager {
  async preflightCheck(branch: string): Promise<void> { }
  async createAndCheckoutBranch(branchName: string): Promise<void> { }
  async getCurrentBranch(): Promise<string> { }
  async hasUncommittedChanges(): Promise<boolean> { }
}

// epic-plan-manager.ts
class EpicPlanManager {
  async createAndApprovePlan(input: EpicWorkflowInput): Promise<Plan> { }
  private async generatePlan(input: EpicWorkflowInput): Promise<PlanDraft> { }
  private async approvePlan(plan: PlanDraft): Promise<Plan> { }
}

// epic-todo-manager.ts
class EpicTodoManager {
  async initializeFromPlan(plan: Plan): Promise<void> { }
  async getNextTodo(): Promise<TodoItem | null> { }
  async completeTodo(todo: TodoItem): Promise<void> { }
  async getAllTodos(): Promise<TodoItem[]> { }
}

// epic-review-manager.ts
class EpicReviewManager {
  async performReviewAndFixCycle(
    todos: TodoItem[],
    context: WorkflowContext<CliToolRegistry>
  ): Promise<ReviewResult> {
    // Extract current lines 364-473
  }

  async performFinalReview(plan: Plan): Promise<void> { }
}

// epic-cleanup-manager.ts
class EpicCleanupManager {
  async perform(): Promise<void> {
    // Switch back to original branch
    // Delete temporary branch if needed
  }
}
```

**File Structure:**
```
packages/cli/src/workflows/epic/
├── index.ts                    # Main workflow entry point
├── orchestrator.ts             # EpicWorkflowOrchestrator
├── epic-git-manager.ts         # EpicGitManager
├── epic-plan-manager.ts        # EpicPlanManager
├── epic-todo-manager.ts        # EpicTodoManager
├── epic-review-manager.ts      # EpicReviewManager
└── epic-cleanup-manager.ts     # EpicCleanupManager
```

**Migration Steps:**
1. Create new directory structure
2. Extract managers one by one
3. Add unit tests for each manager
4. Update main workflow to use orchestrator
5. Run integration tests
6. Move old implementation to backup branch
7. Delete old files after verification

**Benefits:**
- 132-line function → orchestrator + 6 focused managers
- Each manager independently testable
- Can reuse managers in other workflows
- Easier to understand and modify individual aspects

---

### 2.3 Refactor Review Workflow

**File:** `packages/cli/src/workflows/review.workflow.ts`
**Function:** Main workflow (312 lines)

**Problem:**
Three different review modes (PR, range, local) mixed in one function with 5-6 levels of nesting.

**Solution:**
Use Strategy Pattern for different review modes:

```typescript
// Review strategy interface
interface ReviewStrategy {
  getName(): string
  getFileChanges(): Promise<FileChange[]>
  getReviewContext(): Promise<ReviewContext>
}

// PR review strategy
class PullRequestReviewStrategy implements ReviewStrategy {
  constructor(
    private tools: WorkflowTools<CliToolRegistry>,
    private prNumber: number
  ) {}

  getName(): string {
    return `PR #${this.prNumber}`
  }

  async getFileChanges(): Promise<FileChange[]> {
    // Fetch PR info
    // Checkout PR branch
    // Get diff from base branch
  }

  async getReviewContext(): Promise<ReviewContext> {
    // Get PR title, description, commits
  }
}

// Range review strategy
class RangeReviewStrategy implements ReviewStrategy {
  constructor(
    private tools: WorkflowTools<CliToolRegistry>,
    private range: string
  ) {}

  getName(): string {
    return `range '${this.range}'`
  }

  async getFileChanges(): Promise<FileChange[]> {
    // Use GitOperations.getFileChanges(range)
  }

  async getReviewContext(): Promise<ReviewContext> {
    return {
      type: 'range',
      range: this.range,
    }
  }
}

// Local changes review strategy
class LocalChangesReviewStrategy implements ReviewStrategy {
  constructor(
    private tools: WorkflowTools<CliToolRegistry>,
    private mode: 'staged' | 'unstaged' | 'all'
  ) {}

  getName(): string {
    return `local ${this.mode} changes`
  }

  async getFileChanges(): Promise<FileChange[]> {
    // Use GitOperations with appropriate range
  }

  async getReviewContext(): Promise<ReviewContext> {
    return {
      type: 'local',
      mode: this.mode,
      branch: await this.tools.executeCommand({
        command: 'git',
        args: ['rev-parse', '--abbrev-ref', 'HEAD'],
      }),
    }
  }
}

// Main review orchestrator
class CodeReviewOrchestrator {
  async review(input: ReviewWorkflowInput): Promise<ReviewResult> {
    const strategy = this.createStrategy(input)
    const changes = await strategy.getFileChanges()
    const context = await strategy.getReviewContext()

    const filteredChanges = this.filterFiles(changes)
    const review = await this.performReview(filteredChanges, context)

    return {
      strategy: strategy.getName(),
      review,
      changes: filteredChanges,
    }
  }

  private createStrategy(input: ReviewWorkflowInput): ReviewStrategy {
    if (input.pr) {
      return new PullRequestReviewStrategy(this.tools, input.pr)
    }

    if (input.range) {
      return new RangeReviewStrategy(this.tools, input.range)
    }

    return new LocalChangesReviewStrategy(this.tools, this.mode)
  }
}
```

**Benefits:**
- 312-line function → orchestrator + 3 strategies (~60 lines each)
- Each review mode independently testable
- Easy to add new review modes (e.g., commit-based review)
- Reduced nesting from 5-6 levels to 2-3 levels

---

### 2.4 Refactor Fix Workflow Script Configuration

**File:** `packages/cli/src/workflows/fix.workflow.ts`
**Lines:** 56-126

**Problem:**
Complex script configuration resolution repeated 3 times for check/test/format commands.

**Solution:**
Extract to dedicated resolver class:

```typescript
// script-config-resolver.ts
export interface ResolvedCommands {
  check?: string
  test?: string
  format?: string
  default?: string
}

export class ScriptConfigResolver {
  resolve(
    config: ConfigEntry | string | undefined,
    scriptName: 'check' | 'test' | 'format' | 'default'
  ): string | undefined {
    if (typeof config === 'string') {
      return config
    }

    if (!config || typeof config !== 'object') {
      return undefined
    }

    if ('command' in config) {
      return config.command
    }

    if ('script' in config) {
      return this.buildScriptCommand(config.script)
    }

    if ('workflow' in config) {
      // Return workflow reference
      return `workflow:${config.workflow}`
    }

    return undefined
  }

  resolveAll(configFile: ConfigFile): ResolvedCommands {
    return {
      check: this.resolve(configFile.scripts?.check, 'check'),
      test: this.resolve(configFile.scripts?.test, 'test'),
      format: this.resolve(configFile.scripts?.format, 'format'),
      default: this.resolve(configFile.scripts?.default, 'default'),
    }
  }

  private buildScriptCommand(script: string): string {
    return `bun run .polka-scripts/${script}.ts`
  }
}
```

**Benefits:**
- Removes ~70 lines of duplicated config resolution logic
- Single place to update when adding new script types
- Easier to test configuration resolution independently

---

## Phase 3: Improve Type Safety

**Estimated Effort:** 2-3 days
**Impact:** Better developer experience, fewer runtime errors
**Risk:** Low (type changes only)

### 3.1 Fix WorkflowControlFlowStepSchema Type

**File:** `packages/core/src/workflow/dynamic-types.ts`
**Line:** 88

**Problem:**
```typescript
export const WorkflowControlFlowStepSchema: any = z.union([...])
```

Using `any` defeats type safety and requires manual type guards everywhere.

**Solution:**
Use proper discriminated union:

```typescript
// Add discriminator to each schema
export const WorkflowStepDefinitionSchema = z.object({
  stepType: z.literal('basic'),
  id: z.string(),
  tools: z.array(z.string()).nullish(),
  task: z.string(),
  output: z.string().nullish(),
  expected_outcome: z.string().nullish(),
  outputSchema: z.any().nullish(),
  timeout: z.number().positive().nullish(),
})

export const WhileLoopStepSchema = z.object({
  stepType: z.literal('while'),
  id: z.string(),
  while: z.object({
    condition: z.string(),
    steps: z.array(z.lazy(() => WorkflowControlFlowStepSchema)),
  }),
  output: z.string().nullish(),
})

// Similar for other step types...

// Now TypeScript can narrow the type
export const WorkflowControlFlowStepSchema = z.discriminatedUnion('stepType', [
  WorkflowStepDefinitionSchema,
  WhileLoopStepSchema,
  IfElseStepSchema,
  BreakStepSchema,
  ContinueStepSchema,
  TryCatchStepSchema,
])

// Type inference now works properly
export type WorkflowControlFlowStep = z.infer<typeof WorkflowControlFlowStepSchema>

// Type guards become automatic
function isWhileLoopStep(step: WorkflowControlFlowStep): step is Extract<WorkflowControlFlowStep, { stepType: 'while' }> {
  return step.stepType === 'while'
}
```

**Benefits:**
- Type-safe step handling without `as any` casts
- Better TypeScript autocomplete
- Catches type errors at compile time
- Type guards are trivial to implement

**Migration:**
1. Update all schemas to include `stepType` discriminator
2. Update workflow definitions in YAML to include stepType (or auto-detect during parsing)
3. Remove manual type guards
4. Run tests to verify

---

### 3.2 Fix AgentWorkflowInput Type

**File:** `packages/core/src/workflow/agent.workflow.ts`
**Lines:** 12-25

**Problem:**
```typescript
export type AgentWorkflowInput = {
  tools: Readonly<FullToolInfo[]>
  maxToolRoundTrips?: number
  userMessage: readonly JsonUserModelMessage[]
  outputSchema?: z.ZodSchema
  model?: string
} & (
  | { messages: JsonModelMessage[] }
  | { systemPrompt: string }
)
```

Intersection with union creates confusing TypeScript errors.

**Solution:**
Use explicit discriminated union:

```typescript
interface BaseAgentWorkflowInput {
  tools: Readonly<FullToolInfo[]>
  maxToolRoundTrips?: number
  userMessage: readonly JsonUserModelMessage[]
  outputSchema?: z.ZodSchema
  model?: string
}

export interface AgentWorkflowWithMessages extends BaseAgentWorkflowInput {
  inputType: 'messages'
  messages: JsonModelMessage[]
}

export interface AgentWorkflowWithSystemPrompt extends BaseAgentWorkflowInput {
  inputType: 'systemPrompt'
  systemPrompt: string
}

export type AgentWorkflowInput =
  | AgentWorkflowWithMessages
  | AgentWorkflowWithSystemPrompt
```

**Benefits:**
- Clear distinction between two modes
- Better error messages from TypeScript
- Easier to add new input types in future

---

### 3.3 Reduce Function Parameter Count

**Files:**
- `packages/core/src/workflow/dynamic.ts` (multiple functions)

**Problem:**
Functions with 8-11 parameters are hard to use and maintain.

**Solution:**
Group related parameters into context objects:

```typescript
// Create context objects instead of passing many parameters

interface StepExecutionContext<TTools extends ToolRegistry> {
  workflowId: string
  stepId: string
  input: Record<string, any>
  state: Record<string, any>
  tools: WorkflowTools<TTools>
  logger: Logger
  step: StepFn
}

interface AgentExecutionContext<TTools extends ToolRegistry> extends StepExecutionContext<TTools> {
  toolInfo: Readonly<FullToolInfo[]>
  model?: string
  maxToolRoundTrips?: number
  stepSystemPrompt?: (args: StepSystemPromptArgs) => string
  wrapAgentResultInObject?: boolean
}

interface ControlFlowState {
  loopDepth: number
  breakFlag: { value: boolean }
  continueFlag: { value: boolean }
}

// Now functions have fewer parameters
async function executeStepWithAgent<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  execContext: AgentExecutionContext<TTools>,
  controlFlow: ControlFlowState
): Promise<any> {
  // Implementation...
}

async function executeControlFlowStep<TTools extends ToolRegistry>(
  step: WorkflowControlFlowStep,
  execContext: StepExecutionContext<TTools>,
  controlFlow: ControlFlowState,
  options: DynamicWorkflowRunnerOptions
): Promise<StepExecutionResult> {
  // Implementation...
}
```

**Benefits:**
- Functions have 3-4 parameters instead of 8-11
- Related parameters grouped logically
- Easier to add new parameters without breaking existing code
- Better code documentation through context interfaces

---

## Phase 4: Reduce Duplication (Technical Debt)

**Estimated Effort:** 3-4 days
**Impact:** Removes ~300 lines of duplication
**Risk:** Low

### 4.1 Consolidate Tool List Construction

Already covered in Phase 1.2 (Agent Workflow Builder)

### 4.2 Consolidate Git File Parsing

Already covered in Phase 1.1 (Git Operations Helper)

### 4.3 Create File Helper Utilities

Create `packages/cli/src/utils/file-helpers.ts`:

```typescript
export class FileHelpers {
  static filterFilesByPatterns(
    files: string[],
    includePatterns?: string[],
    excludePatterns?: string[]
  ): string[] {
    let filtered = files

    if (includePatterns?.length) {
      filtered = filtered.filter(file =>
        includePatterns.some(pattern => minimatch(file, pattern))
      )
    }

    if (excludePatterns?.length) {
      filtered = filtered.filter(file =>
        !excludePatterns.some(pattern => minimatch(file, pattern))
      )
    }

    return filtered
  }

  static normalizePath(path: string): string {
    return path.replace(/^\\/g, '').replace(/\\/g, '/')
  }

  static groupFilesByDirectory(files: string[]): Record<string, string[]> {
    const groups: Record<string, string[]> = {}

    for (const file of files) {
      const dir = path.dirname(file)
      if (!groups[dir]) {
        groups[dir] = []
      }
      groups[dir].push(file)
    }

    return groups
  }
}
```

---

## Implementation Timeline

### Week 1: Foundation (Phase 1)
- Days 1-2: Create Git Operations Helper
- Days 2-3: Create Agent Workflow Builder
- Days 3-4: Create File Attachment Helper
- Day 5: Update workflows to use new utilities

### Week 2: Core Refactoring (Phase 2.1-2.2)
- Days 1-3: Refactor Dynamic Workflow Control Flow
- Days 3-5: Refactor Epic Workflow

### Week 3: Workflow Improvements (Phase 2.3-2.4)
- Days 1-2: Refactor Review Workflow
- Days 3-4: Refactor Fix Workflow Config
- Day 5: Testing and bug fixes

### Week 4: Type Safety & Final Polish (Phase 3-4)
- Days 1-2: Improve Type Safety
- Days 3-4: Remove Remaining Duplication
- Day 5: Documentation and final testing

---

## Success Metrics

### Code Quality Metrics
- **Before:**
  - Longest function: 312 lines
  - Average function length: ~45 lines
  - Duplicated code blocks: ~500 lines
  - Functions with >5 parameters: 12
  - Maximum nesting depth: 6 levels

- **After (Target):**
  - Longest function: <80 lines
  - Average function length: ~25 lines
  - Duplicated code blocks: <100 lines
  - Functions with >5 parameters: 2
  - Maximum nesting depth: 3 levels

### Test Coverage
- Maintain current coverage (406+ tests)
- Add 50+ new tests for extracted utilities
- Integration tests for refactored workflows

### Developer Experience
- Faster onboarding for new contributors
- Easier to locate and modify specific functionality
- Better TypeScript autocomplete and error messages
- Clearer code organization

---

## Risk Mitigation

### Testing Strategy
1. **Comprehensive unit tests** for all new utilities
2. **Integration tests** for refactored workflows
3. **Backward compatibility** checks during migration
4. **Feature branch** for each major refactoring
5. **Incremental migration** to reduce risk

### Rollback Plan
1. Keep original implementation in backup branch
2. Feature flags for new implementations
3. A/B testing during transition period
4. Revert to backup if critical issues found

### Code Review Process
1. All changes require review from maintainer
2. Update documentation for any API changes
3. Run full test suite before merging
4. Update CHANGELOG with breaking changes

---

## Next Steps

1. **Review this plan** with team and gather feedback
2. **Prioritize phases** based on team capacity and immediate needs
3. **Create tracking issues** for each phase with detailed subtasks
4. **Set up feature branches** for each major refactoring
5. **Start with Phase 1** (quick wins to build momentum)

---

## Conclusion

This refactoring plan addresses the most critical code quality issues in the polka-codes codebase. By following a phased approach, we can:

- **Reduce complexity** through better separation of concerns
- **Improve maintainability** by breaking down large functions
- **Enhance testability** with focused, single-purpose units
- **Increase developer velocity** through better organization

The plan is designed to be implemented incrementally, with each phase delivering value and building momentum for the next. Starting with Phase 1 (quick wins) will provide immediate benefits while building confidence for the larger refactoring efforts in Phase 2.

**Estimated Total Effort:** 12-17 days across 4 weeks
**Expected ROI:** 3-5x (time saved in future maintenance and feature development)
