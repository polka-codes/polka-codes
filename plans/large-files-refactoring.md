# Large Files Refactoring Plan

**Date:** 2026-01-04
**Status:** Planning

---

## Files Analysis

### 1. `packages/core/src/workflow/dynamic.ts` (1,315 lines) 🔴

**Current Structure:**
- Lines 1-140: JSON Schema to Zod conversion
- Lines 141-225: Validation functions
- Lines 226-322: Type definitions and parsing
- Lines 323-919: Condition/value evaluation logic
- Lines 920-975: Control flow helpers
- Lines 976-1315: Main workflow runner

**Issues:**
- Too many concerns in one file
- 600+ lines of evaluation logic could be extracted
- Hard to navigate and maintain

**Proposed Split:**
```
packages/core/src/workflow/
├── dynamic/
│   ├── index.ts                 # Main exports and createDynamicWorkflow
│   ├── schema-converter.ts      # JSON Schema to Zod conversion
│   ├── validation.ts            # validateWorkflowFile, parseDynamicWorkflowDefinition
│   ├── evaluator.ts             # Condition/value evaluation (600 lines)
│   ├── control-flow.ts          # Control flow helpers (isBreakStep, etc.)
│   └── types.ts                 # All type definitions
```

**Benefits:**
- Each module has single responsibility
- Easier to test individual components
- Better code organization
- Reduced cognitive load

**Estimated Effort:** 4-6 hours

---

### 2. `packages/cli/src/workflows/epic.workflow.ts` (852 lines) 🟡

**Current Structure:**
- Lines 1-43: Imports and type definitions
- Lines 44-719: Epic context types and helper functions
- Lines 720-852: Main epicWorkflow function

**Issues:**
- Large workflow function with inline logic
- Could extract helper functions
- Type definitions mixed with implementation

**Proposed Split:**
```
packages/cli/src/workflows/
├── epic/
│   ├── index.ts                 # Main epicWorkflow export
│   ├── types.ts                 # EpicContext and related types
│   ├── helpers.ts               # Helper functions
│   └── tasks.ts                 # Task breakdown logic
```

**Benefits:**
- Separation of concerns
- Reusable helper functions
- Cleaner main workflow file

**Estimated Effort:** 2-3 hours

---

### 3. `packages/cli/src/agent/types.ts` (805 lines) 🟢

**Current Structure:**
- All type definitions for the agent module

**Assessment:**
✅ **No action needed**

**Reason:**
- Type definitions file is expected to be large
- Splitting would make imports more complex
- No logic, just data/definitions
- Easy to navigate with IDE go-to-definition

**Recommendation:** Keep as-is

---

### 4. `packages/cli/src/tool-implementations.ts` (700 lines) 🟢

**Status:** At 700 lines, right on the boundary

**Assessment:**
- Contains tool implementation functions
- Each tool is self-contained
- Easy to navigate with editor folding

**Recommendation:** Monitor growth, consider splitting if exceeds 800 lines

---

## Implementation Priority

### Phase 1: High Priority - ATTEMPTED ⚠️
1. ⚠️ **Analyzed `dynamic.ts` for refactoring** (2 hours)
   - Created modular structure plan
   - Identified logical boundaries
   - **Issue Discovered:** Tight coupling between components
     - Evaluator uses schema converter
     - Control flow uses evaluator
     - Main runner uses everything
   - **Risk:** Splitting would create circular dependencies
   - **Decision:** Postpone full refactoring
   - **Alternative:** Extract only the evaluator (~600 lines) as it's the most independent

### Phase 2: Revised Medium Priority
2. **Extract evaluator module** (1-2 hours)
   - `evaluateCondition`, `evaluateConditionSafe` (~280 lines)
   - `evaluateValue`, `getNestedProperty`, `compareValues` (~100 lines)
   - Helper functions: `findTopLevelOperator`, `hasEnclosingParens` (~220 lines)
   - This is the largest self-contained section
   - Would reduce main file from 1,315 to ~715 lines

3. **Refactor `epic.workflow.ts`** (2-3 hours)
   - Moderate complexity
   - User-facing feature
   - Would improve maintainability

### Phase 3: Low Priority
3. **Monitor `tool-implementations.ts`**
   - Currently acceptable
   - Review if it exceeds 800 lines

---

## Risk Assessment

### Risks:
- Breaking import statements across codebase
- Circular dependencies
- Test failures due to moved exports
- Runtime errors from incorrect imports

### Mitigation:
- Use index.ts for backward compatibility
- Run full test suite after each split
- Create comprehensive integration tests
- Update all imports atomically

---

## Testing Strategy

1. **Before Refactoring:**
   - Ensure all tests pass
   - Create baseline test coverage report

2. **During Refactoring:**
   - Run tests after each file split
   - Verify exports are accessible
   - Check for circular dependencies

3. **After Refactoring:**
   - Full test suite
   - Integration tests
   - Manual smoke tests

---

## Success Criteria

- ✅ All tests passing
- ✅ No circular dependencies
- ✅ No breaking changes to public API
- ✅ Files under 700 lines (except types.ts)
- ✅ Improved code organization
- ✅ Better testability

---

## Next Steps

1. ✅ Create this refactoring plan
2. Get approval for Phase 1 refactoring
3. Start with `dynamic.ts` schema-converter extraction
4. Incrementally split other modules
5. Run tests after each change
6. Update documentation

---

**Generated by:** Claude Code Agent
**Date:** 2026-01-04
**Status:** Ready for implementation
