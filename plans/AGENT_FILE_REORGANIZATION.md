# Agent File Reorganization Plan

## Current State

### Directory Structure
```
packages/cli/src/agent/
├── __snapshots__/           (empty directory)
├── __tests__/               (contains 1 misplaced test)
│   └── error-handling.test.ts
├── safety/                  (3 source files, 0 tests)
│   ├── approval.ts
│   ├── checks.ts
│   └── interrupt.ts
├── [26 source files]
└── [14 test files]
```

### Issues Identified

#### 1. Inconsistent Test Organization
- **Problem**: `error-handling.test.ts` exists in TWO locations:
  - `/agent/__tests__/error-handling.test.ts` (original, 36 lines)
  - `/agent/error-handling.test.ts` (duplicate, 88 lines)

- **Problem**: `__tests__/` directory violates the project convention
  - AGENTS.md rule: tests should be `*.test.ts` next to source files
  - All other tests follow this pattern correctly

#### 2. Empty Directory
- `__snapshots__/` exists but is empty (no snapshot tests currently used)

#### 3. Missing Test Coverage

**Core Files Without Tests** (9 files):
- `orchestrator.ts` - Main agent orchestrator (539 lines)
- `state-manager.ts` - State persistence
- `task-history.ts` - Execution history tracking
- `task-prioritizer.ts` - Task prioritization logic
- `health-monitor.ts` - Health checking
- `resource-monitor.ts` - Resource usage monitoring
- `errors.ts` - Custom error types
- `types.ts` - Type definitions
- `test-fixtures.ts` - Test utilities (meta, doesn't need its own test)

**Discovery Files Without Tests** (2 files):
- `advanced-discovery.ts` - Advanced task discovery strategies
- `working-dir-discovery.ts` - Working directory discovery

**Other Files Without Tests** (3 files):
- `planner.constants.ts` - Planning constants
- `index.ts` - Module exports
- `config.ts` - Configuration (has test, but verify coverage)

**Safety Subdirectory** (3 files, 0 tests):
- `safety/approval.ts` - Approval management
- `safety/checks.ts` - Safety validation
- `safety/interrupt.ts` - Interrupt handling

### Current Test Coverage
- **With tests**: 14 files
- **Without tests**: 17 files
- **Coverage**: ~45%

## Reorganization Plan

### Phase 1: Remove Duplicates and Fix Organization ✅

**Action**: Remove duplicate test file and empty directories

```bash
# Remove duplicate test (keep the larger, more complete version)
rm packages/cli/src/agent/__tests__/error-handling.test.ts

# Remove empty __snapshots__ directory
rm -rf packages/cli/src/agent/__snapshots__

# Remove now-empty __tests__ directory
rm -rf packages/cli/src/agent/__tests__
```

**Rationale**:
- `error-handling.test.ts` in root has 88 lines vs 36 in __tests__
- Keep the more complete version
- Eliminate confusion of having tests in two locations

### Phase 2: Safety Subdirectory Test Organization ✅

**Option A (Recommended)**: Co-locate tests with source files

```
packages/cli/src/agent/safety/
├── approval.ts
├── approval.test.ts       (NEW)
├── checks.ts
├── checks.test.ts         (NEW)
├── interrupt.ts
└── interrupt.test.ts      (NEW)
```

**Option B**: Separate test subdirectory for safety
```
packages/cli/src/agent/safety/
├── __tests__/
│   ├── approval.test.ts
│   ├── checks.test.ts
│   └── interrupt.test.ts
├── approval.ts
├── checks.ts
└── interrupt.ts
```

**Recommendation**: Option A (co-location)
- Consistent with rest of codebase
- Follows AGENTS.md convention
- Easier to find tests when editing source

### Phase 3: Add Missing Tests (Future Work)

**Priority 1 - Core Functionality** (High Impact):
1. `orchestrator.test.ts` - Main agent logic
2. `state-manager.test.ts` - State persistence
3. `safety/approval.test.ts` - Approval system
4. `safety/checks.test.ts` - Safety validation

**Priority 2 - Monitoring & Reliability**:
5. `health-monitor.test.ts`
6. `resource-monitor.test.ts`
7. `task-history.test.ts`
8. `safety/interrupt.test.ts`

**Priority 3 - Discovery & Planning**:
9. `task-prioritizer.test.ts`
10. `advanced-discovery.test.ts`
11. `working-dir-discovery.test.ts`

**Priority 4 - Low Priority / Optional**:
12. `errors.test.ts` (mostly type definitions)
13. `types.test.ts` (type definitions, minimal logic)
14. `planner.constants.test.ts` (constants only)

### Phase 4: File Naming Consistency ✅

**Current**: All files follow consistent naming
- Source: `name.ts`
- Tests: `name.test.ts`

**No changes needed** - naming is already consistent

## Final Structure

### After Phase 1-3:
```
packages/cli/src/agent/
├── safety/
│   ├── approval.ts
│   ├── approval.test.ts        (NEW)
│   ├── checks.ts
│   ├── checks.test.ts          (NEW)
│   ├── interrupt.ts
│   └── interrupt.test.ts       (NEW)
├── advanced-discovery.ts
├── advanced-discovery.test.ts  (NEW)
├── config.ts
├── config.test.ts              (EXISTS)
├── constants.ts
├── constants.test.ts           (EXISTS)
├── debug-logger.ts
├── debug-logger.test.ts        (EXISTS)
├── error-handling.ts
├── error-handling.test.ts      (EXISTS, consolidated)
├── errors.ts
├── executor.ts
├── executor.test.ts            (EXISTS)
├── goal-decomposer.ts
├── goal-decomposer.test.ts     (EXISTS)
├── health-monitor.ts
├── health-monitor.test.ts      (NEW)
├── improvement-loop.ts
├── improvement-loop.test.ts    (EXISTS)
├── index.ts
├── metrics.ts
├── metrics.test.ts             (EXISTS)
├── orchestrator.ts
├── orchestrator.test.ts        (NEW)
├── planner.constants.ts
├── planner.ts
├── planner.test.ts             (EXISTS)
├── progress.ts
├── progress.test.ts            (EXISTS)
├── resource-monitor.ts
├── resource-monitor.test.ts    (NEW)
├── session.ts
├── session.test.ts             (EXISTS)
├── state-manager.ts
├── state-manager.test.ts       (NEW)
├── task-discovery.ts
├── task-discovery.test.ts      (EXISTS)
├── task-history.ts
├── task-history.test.ts        (NEW)
├── task-prioritizer.ts
├── task-prioritizer.test.ts    (NEW)
├── test-fixtures.ts
├── types.ts
├── working-dir-discovery.ts
├── working-dir-discovery.test.ts (NEW)
├── workflow-adapter.ts
├── workflow-adapter.test.ts    (EXISTS)
├── working-space.ts
└── working-space.test.ts       (EXISTS)
```

## Implementation Steps

### Step 1: Execute Phase 1 (Cleanup) - Do Now
```bash
git mv packages/cli/src/agent/__tests__/error-handling.test.ts \
        packages/cli/src/agent/__tests__/error-handling.test.ts.bak

# Verify the root version is more complete
rm -rf packages/cli/src/agent/__snapshots__
rm -rf packages/cli/src/agent/__tests__
```

### Step 2: Create Safety Tests (Phase 2) - Do Now
Create three test files in `safety/` subdirectory

### Step 3: Add Priority 1 Tests (Future)
Create test files for core functionality

### Step 4: Add Priority 2-4 Tests (Future)
Fill in remaining test coverage as needed

## Benefits

1. **Consistency**: All tests follow same `*.test.ts` pattern co-located with source
2. **Clarity**: No confusion about where tests live
3. **Discoverability**: Tests immediately visible when editing source files
4. **Coverage**: Increased test coverage for critical components
5. **Maintenance**: Easier to keep tests in sync with implementation

## Notes

- `index.ts` and `test-fixtures.ts` don't need their own tests (export only / utilities)
- `types.ts` and `errors.ts` are low priority (mostly type definitions)
- `planner.constants.ts` is low priority (constants only)
- Focus on testing files with actual logic first

## Status

- [ ] Phase 1: Remove duplicates and empty directories
- [ ] Phase 2: Create safety subdirectory tests
- [ ] Phase 3a: Add Priority 1 tests (core functionality)
- [ ] Phase 3b: Add Priority 2 tests (monitoring)
- [ ] Phase 3c: Add Priority 3 tests (discovery)
- [ ] Phase 4: Verify all naming consistency
