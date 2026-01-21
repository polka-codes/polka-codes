# File Naming Consistency Plan

## The Problem

**`planner.constants.ts`** is the ONLY file using dot notation (`.`) instead of kebab-case (`-`).

## Analysis

**File**: `planner.constants.ts` (21 lines)
```typescript
export const PLANNER_CONSTANTS = {
  MAX_DEPENDENCIES: 5,
  LONG_TASK_MINUTES: 120,
  FILE_HEAVY_THRESHOLD: 10,
  HIGH_PRIORITY: 800,
  CRITICAL_PRIORITY: 1000,
} as const
```

**Usage**: Only imported by `planner.ts` (1 location)

## Solution: Merge into planner.ts ✅

**Steps**:
1. Move `PLANNER_CONSTANTS` into `planner.ts`
2. Remove the import from `planner.ts`
3. Delete `planner.constants.ts`
4. Delete `planner.constants.test.ts`

**Result**: 26 files with consistent naming (all `name.ts` or `compound-name.ts`)

---

## Approval: Execute this plan?

Options:
- **yes** - Proceed with merge
- **no** - Choose different approach
- **show details** - See the full implementation plan
