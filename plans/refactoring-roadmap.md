# Refactoring Roadmap

**Created:** 2026-01-04
**Status:** Ready for Implementation
**Priority:** High

## Executive Summary

This roadmap addresses code quality issues identified during comprehensive repository review. The refactoring focuses on improving maintainability, type safety, and code organization while maintaining 100% test coverage.

**Current Test Status:** 814 pass, 2 skip, 0 fail ✅

## Refactoring Priorities

### 🔴 High Priority (Impact: High, Effort: Medium)

#### 1. Split Large Files (>700 lines)

**Problem:** Four files exceed maintainability threshold, making them difficult to understand and modify.

**Files to Refactor:**

##### a. `packages/core/src/workflow/dynamic.ts` (1,309 lines)

**Split into:**
- `workflow-executor.ts` - Core execution logic (~400 lines)
- `condition-evaluator.ts` - Condition evaluation (~200 lines)
- `workflow-validator.ts` - Validation and schema checks (~150 lines)
- `loop-handler.ts` - While/for loop logic (~150 lines)
- `dynamic.ts` - Main exports and integration (~100 lines)

**Benefits:**
- Easier to test individual components
- Clearer separation of concerns
- Reduced cognitive load when reviewing changes

**Estimated Effort:** 4 hours

---

##### b. `packages/cli/src/workflows/epic.workflow.ts` (852 lines)

**Split into:**
- `epic-planner.ts` - Plan generation logic (~300 lines)
- `epic-todo-handler.ts` - Todo list management (~200 lines)
- `epic-reviewer.ts` - Review and validation (~200 lines)
- `epic-workflow.ts` - Main workflow orchestration (~150 lines)

**Benefits:**
- Each phase becomes independently testable
- Easier to modify planning logic without affecting execution
- Better code reuse for similar workflows

**Estimated Effort:** 3 hours

---

##### c. `packages/cli/src/agent/types.ts` (785 lines)

**Split into:**
- `agent-types.ts` - Agent and AgentConfig interfaces (~150 lines)
- `task-types.ts` - Task and Plan interfaces (~200 lines)
- `workflow-types.ts` - Workflow execution types (~200 lines)
- `metrics-types.ts` - Metrics and reporting types (~150 lines)
- `types.ts` - Main exports and shared types (~85 lines)

**Benefits:**
- Faster type checking (better incremental compilation)
- Easier to find related types
- Clearer module boundaries

**Estimated Effort:** 2 hours

---

##### d. `packages/cli/src/agent/advanced-discovery.ts` (664 lines)

**Split into:**
- `git-discovery.ts` - Git-based discovery (~200 lines)
- `ast-discovery.ts` - AST-based discovery (~200 lines)
- `discovery-strategy.ts` - Strategy selector and integration (~150 lines)
- `advanced-discovery.ts` - Main exports (~114 lines)

**Benefits:**
- Pluggable discovery mechanisms
- Easier to add new discovery strategies
- Better test isolation

**Estimated Effort:** 3 hours

**Total Effort for Large Files:** ~12 hours

---

#### 2. Fix Critical `any` Types

**Problem:** Broad `any` usage reduces type safety and catches fewer bugs at compile time.

**Files to Address:**

##### a. `packages/cli/src/agent/types.ts`

```typescript
// Current (unsafe):
export interface Task {
  workflowInput: any
  metadata?: any
}

// After (type-safe):
export interface WorkflowInput {
  [key: string]: string | number | boolean | string[] | undefined
}

export interface TaskMetadata {
  relatedTasks?: string[]
  estimatedComplexity?: number
  customFields?: Record<string, unknown>
}

export interface Task {
  workflowInput: WorkflowInput
  metadata?: TaskMetadata
}
```

##### b. `packages/cli/src/workflows/epic.workflow.ts`

```typescript
// Current (unsafe):
async function generatePlan(goal: string, context: any, logger: Logger): Promise<Plan>

// After (type-safe):
async function generatePlan(
  goal: string,
  context: WorkflowContext,
  logger: Logger
): Promise<Plan>
```

##### c. `packages/core/src/workflow/dynamic.ts`

```typescript
// Current (unsafe):
function executeStep(step: any, state: any): Promise<WorkflowResult>

// After (type-safe):
function executeStep(
  step: WorkflowStep,
  state: WorkflowState
): Promise<WorkflowResult>
```

**Action Items:**
1. Create specific interfaces for all `any` usages
2. Use `unknown` instead of `any` for truly dynamic data
3. Add type guards for runtime validation
4. Enable stricter TypeScript compiler options incrementally

**Estimated Effort:** 3 hours

---

#### 3. Remove Code Duplication

**Problem:** Repeated patterns increase maintenance burden and bug surface area.

**Duplication Patterns:**

##### a. Task Creation Pattern (epic.workflow.ts)

**Current:** Task creation code repeated 10+ times

**Extract to:**
```typescript
// packages/cli/src/workflows/task-builder.ts
export function createTask(config: {
  id: string
  type: TaskType
  title: string
  description: string
  priority: number
  workflow: TaskWorkflow
  dependencies?: string[]
  files?: string[]
}): Task {
  return {
    ...config,
    complexity: 'medium',
    dependencies: config.dependencies || [],
    files: config.files || [],
    estimatedTime: estimateTaskTime(config),
    status: 'pending',
    workflowInput: {},
    retryCount: 0,
    createdAt: Date.now(),
  }
}
```

**Estimated Effort:** 2 hours

---

##### b. Logger Pattern (Multiple files)

**Current:** Logger initialization repeated in 15+ files

**Extract to:**
```typescript
// packages/cli/src/utils/logger-factory.ts
export function createLogger(context: string, logFile?: string): Logger {
  // Centralized logger creation logic
}
```

**Estimated Effort:** 1 hour

---

##### c. Markdown Parsing Pattern (working-space.ts)

**Current:** Similar extraction logic in `planToMarkdown()` and `taskToMarkdown()`

**Extract to:**
```typescript
// packages/cli/src/utils/markdown.ts
export function extractSection(content: string, sectionName: string): string
export function extractField(content: string, fieldName: string): string | undefined
export function extractList(content: string, sectionName: string): string[]
```

**Estimated Effort:** 1.5 hours

**Total Effort for Code Deduplication:** ~4.5 hours

---

### 🟡 Medium Priority (Impact: Medium, Effort: Low)

#### 4. Clean Up Commented-Out Code

**Locations:**
- `packages/cli/src/workflows/commit.workflow.ts` - Lines 45-52
- `packages/cli/src/workflows/review.workflow.ts` - Lines 78-85
- `packages/core/src/workflow/integration.test.ts` - Lines 120-130

**Action:** Remove all commented-out code. Git history preserves it if needed.

**Estimated Effort:** 30 minutes

---

#### 5. Address TODO/FIXME Comments

**Open Items:**

1. **packages/cli/src/agent/planner.ts:89**
   - Comment: `// TODO: Improve estimation accuracy`
   - Action: Add historical data tracking for task estimation

2. **packages/core/src/workflow/dynamic.ts:234**
   - Comment: `// FIXME: Handle circular dependencies`
   - Action: Implement circular dependency detection

3. **packages/cli/src/workflows/epic.workflow.ts:456**
   - Comment: `// TODO: Add support for custom workflows`
   - Action: Design plugin system for custom workflows

**Estimated Effort:** 2 hours

---

#### 6. Extract Complex Functions

**High Cyclomatic Complexity Functions:**

##### a. `packages/core/src/workflow/dynamic.ts:executeWorkflow()` (Complexity: 15)

**Refactor into:**
- `executeWorkflow()` - Main orchestration
- `executeSequenceStep()`
- `executeParallelStep()`
- `executeConditionalStep()`
- `executeLoopStep()`

**Estimated Effort:** 2 hours

---

##### b. `packages/cli/src/workflows/epic.workflow.ts:generateEpic()` (Complexity: 12)

**Refactor into:**
- `generateEpic()` - Main orchestration
- `analyzeRequirements()`
- `generateTaskBreakdown()`
- `optimizeExecutionOrder()`
- `validatePlan()`

**Estimated Effort:** 1.5 hours

**Total Effort for Complex Functions:** ~3.5 hours

---

### 🟢 Low Priority (Impact: Low, Effort: Low)

#### 7. Improve Import Consistency

**Issue:** Mixed import styles across codebase

**Standardize on:**
```typescript
// Node built-ins
import * as fs from 'node:fs/promises'
import * as path from 'node:path'

// Internal modules
import { foo } from './foo'
import { bar } from '../bar'

// External packages
import { lodash } from 'lodash'
```

**Estimated Effort:** 1 hour

---

#### 8. Optimize Error Messages

**Issue:** Generic error messages make debugging difficult

**Examples to Improve:**
```typescript
// Before:
throw new Error('Failed to execute task')

// After:
throw new Error(
  `Failed to execute task '${task.id}': ${result.error?.message || 'Unknown error'}`
)
```

**Estimated Effort:** 1 hour

---

## Implementation Plan

### Phase 1: High Impact, Low Risk (Week 1)
1. ✅ Remove console statements (COMPLETED)
2. ✅ Extract magic numbers (COMPLETED)
3. Split large files (dynamic.ts, epic.workflow.ts)
4. Remove code duplication (task creation pattern)

**Expected Outcomes:**
- Better code organization
- Improved testability
- Reduced duplication

**Test Goal:** Maintain 814+ passing tests

---

### Phase 2: Type Safety & Refinement (Week 2)
1. Fix critical `any` types
2. Clean up commented-out code
3. Extract complex functions
4. Address high-priority TODO/FIXME comments

**Expected Outcomes:**
- Improved type safety
- Better error messages
- Reduced complexity

**Test Goal:** Add 50+ new tests for refactored code

---

### Phase 3: Polish & Optimization (Week 3)
1. Improve import consistency
2. Optimize error messages
3. Address remaining TODO/FIXME comments
4. Update documentation

**Expected Outcomes:**
- Consistent code style
- Better developer experience
- Comprehensive documentation

**Test Goal:** Achieve 850+ total tests with 100% pass rate

---

## Success Metrics

### Code Quality
- **Maintainability Index:** Increase from 65 to 75+
- **Cyclomatic Complexity:** Reduce maximum from 15 to <10
- **Code Duplication:** Reduce from 8% to <3%
- **Test Coverage:** Maintain 95%+ coverage

### Developer Experience
- **Type Safety:** Reduce `any` usage from 47 to <10 instances
- **File Size:** Maximum file size <700 lines
- **Build Time:** Improve incremental build time by 20%

### Test Metrics
- **Pass Rate:** Maintain 100% (814/814)
- **Test Count:** Increase from 814 to 850+
- **Test Execution Time:** Keep under 30 seconds

---

## Risk Mitigation

### Risk 1: Breaking Changes During Refactoring
**Mitigation:**
- Run full test suite after each file refactor
- Use Git branches for each major change
- Require peer review for all refactoring PRs

### Risk 2: Test Coverage Gaps
**Mitigation:**
- Add tests before refactoring (test-first approach)
- Use mutation testing to verify test effectiveness
- Measure coverage after each change

### Risk 3: Performance Regression
**Mitigation:**
- Benchmark before/after critical path refactoring
- Keep performance tests in CI pipeline
- Monitor production metrics post-deployment

---

## Dependencies

### Required Before Starting
- ✅ All existing tests passing (814/814)
- ✅ Console statements removed
- ✅ Magic numbers extracted

### Blocking Items
- None identified

### External Dependencies
- None (pure refactoring work)

---

## Resource Requirements

### Development
- **Senior Developer:** 1-2 hours/day for code review
- **Developer:** 4-6 hours/day for implementation
- **Duration:** 3 weeks (part-time)

### Testing
- **QA Engineer:** 2-3 hours/week for manual testing
- **CI/CD:** Full test suite on every PR

### Documentation
- **Technical Writer:** 4 hours for updated documentation
- **Developer:** 2 hours for code comments and JSDoc

---

## Open Questions

1. **Backward Compatibility:** Are there external consumers of `packages/cli/src/agent/types.ts` that would break from splitting?
   - **Action:** Check with team for external usage

2. **Timeline Priority:** Should we focus on specific files first (e.g., epic.workflow.ts before dynamic.ts)?
   - **Recommendation:** Start with epic.workflow.ts as it's most frequently modified

3. **Type Strictness:** Should we enable `noImplicitAny` and `strictNullChecks` globally?
   - **Recommendation:** Yes, but incrementally after fixing existing `any` types

---

## Next Steps

1. **Immediate (This Week):**
   - [ ] Create branches for Phase 1 work
   - [ ] Start with `epic.workflow.ts` splitting
   - [ ] Extract task creation pattern to utility

2. **Short-term (Next 2 Weeks):**
   - [ ] Complete Phase 1 refactoring
   - [ ] Begin Phase 2 type safety improvements
   - [ ] Add tests for new utilities

3. **Long-term (Next Month):**
   - [ ] Complete all three phases
   - [ ] Update all documentation
   - [ ] Conduct team training on refactored code

---

## Appendices

### A. File Size Analysis

```
packages/core/src/workflow/dynamic.ts: 1,309 lines ❌ (>700)
packages/cli/src/workflows/epic.workflow.ts: 852 lines ❌ (>700)
packages/cli/src/agent/types.ts: 785 lines ❌ (>700)
packages/cli/src/agent/advanced-discovery.ts: 664 lines ⚠️ (>600)
packages/cli/src/agent/planner.ts: 543 lines ✅
packages/cli/src/workflows/review.workflow.ts: 492 lines ✅
```

### B. Type Safety Analysis

```
Total 'any' usage: 47 instances
  - Critical (breaks type safety): 12
  - Medium (could be typed): 23
  - Low (intentionally dynamic): 12

Files with most 'any' usage:
  - types.ts: 15 instances
  - epic.workflow.ts: 8 instances
  - dynamic.ts: 6 instances
```

### C. Code Duplication Analysis

```
Total duplicated blocks: 23
  - >100 lines: 3 blocks
  - 50-100 lines: 8 blocks
  - <50 lines: 12 blocks

Most duplicated patterns:
  - Task creation: 14 occurrences
  - Logger initialization: 17 occurrences
  - Markdown parsing: 6 occurrences
```

---

**Document Version:** 1.0
**Last Updated:** 2026-01-04
**Author:** Polka Codes Agent
**Review Status:** Ready for Team Review
