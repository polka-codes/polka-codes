# Plan to Eliminate `any` Types

## Overview

This plan addresses the systematic elimination of `any` types throughout the polka-codes codebase. Removing `any` types improves type safety, developer experience, and reduces runtime errors.

## Current State Analysis

### Statistics
- **Total `any` usages**: ~95 in non-test files across packages/cli and packages/core
- **Categories**:
  1. **Logger interfaces** (~30 usages) - Acceptable for flexible logging
  2. **Error handling** (~10 usages) - Catch blocks and error types
  3. **Dynamic workflow execution** (~25 usages) - Critical for dynamic workflows
  4. **Agent/AI integration** (~15 usages) - Tool inputs/outputs
  5. **Configuration/data objects** (~10 usages) - Can be properly typed
  6. **Test helpers** (~5 usages) - Acceptable in test utilities

### Priority Categories

#### 🔴 HIGH PRIORITY (Type Safety Risks)

##### 1. Dynamic Workflow System (packages/core/src/workflow/dynamic.ts)
**Lines**: 33, 39, 49, 154, 263, 283, 550, 610, 623, 768, 967, 1012, 1038, 1118, 1161, 1198, 1275

**Issues**:
- `enum?: any[]` - JSON Schema enum values
- `Record<string, any>` - Dynamic input/state objects
- Function return types - `any` used for dynamic evaluation results

**Solutions**:
1. **Enum values**: Create proper union type from JSON Schema
   ```typescript
   type JsonSchemaEnum = (string | number | boolean)[]
   ```

2. **Dynamic input/state**: Use generics with constraints
   ```typescript
   function evaluateValue<T = unknown>(
     expr: string,
     input: Record<string, T>,
     state: Record<string, T>
   ): T | undefined
   ```

3. **Tool invocation**: Use proper tool registry types
   ```typescript
   type ToolInvokeResult = ToolResponse<unknown> // Better than any
   ```

4. **Step results**: Create union type for control flow results
   ```typescript
   type StepResult =
     | { type: 'continue'; value: unknown }
     | { type: 'break'; value?: unknown }
     | { type: 'return'; value: unknown }
   ```

##### 2. Agent Tool Inputs/Outputs (packages/core/src/workflow/agent.workflow.ts)
**Line**: 37

**Issue**:
```typescript
input: { toolName: string; input: any }
```

**Solution**:
```typescript
// Define in workflow-tools.ts or similar
type AgentToolInput<T extends keyof ToolRegistry> = {
  toolName: T
  input: ToolSignatureToInput<T>
}
```

##### 3. Configuration Objects (packages/cli/src/workflows/init.workflow.ts)
**Line**: 44

**Issue**:
```typescript
let generatedConfig: any = {}
```

**Solution**:
```typescript
type GeneratedConfig = {
  [key: string]: {
    type: 'object' | 'string' | 'number' | 'boolean'
    properties?: Record<string, unknown>
    required?: string[]
  }
}

let generatedConfig: GeneratedConfig = {}
```

##### 4. API Provider Options (packages/cli/src/api.ts)
**Lines**: 493, 540

**Issue**:
```typescript
getProvider?: (opt: any) => any
```

**Solution**:
```typescript
import type { LanguageModelV1Provider } from 'ai'

getProvider?: (opt: {
  provider?: string
  model?: string
  parameters?: Record<string, unknown>
}) => LanguageModelV1Provider
```

#### 🟡 MEDIUM PRIORITY (Developer Experience)

##### 5. Tool Implementation Context (packages/cli/src/tool-implementations.ts)
**Lines**: 118, 120

**Issue**:
```typescript
toolProvider: any
workflowContext: any
```

**Solution**:
```typescript
import type { ToolProvider } from '@ai-sdk/provider'
import type { WorkflowContext } from '@polka-codes/core'

toolProvider: ToolProvider
workflowContext: WorkflowContext<CliToolRegistry>
```

##### 6. Error Details (packages/cli/src/agent/errors.ts)
**Lines**: 38, 189, 276

**Issue**:
```typescript
public readonly details?: any
```

**Solution**:
```typescript
public readonly details?: Record<string, unknown> | ErrorDetail[]

interface ErrorDetail {
  field?: string
  message: string
  value?: unknown
}
```

##### 7. Command Options (packages/cli/src/commands/*.ts)
**Multiple files**: agent.ts, code.ts, epic.ts, workflow.ts

**Issue**:
```typescript
export async function runAgent(goal: string | undefined, options: any, command: Command)
```

**Solution**:
```typescript
interface CommandOptions {
  verbose?: number
  yes?: boolean
  file?: string
  cwd?: string
  context?: Record<string, unknown>
  // ... other options
}

export async function runAgent(
  goal: string | undefined,
  options: CommandOptions,
  command: Command
)
```

#### 🟢 LOW PRIORITY (Acceptable `any` Usage)

##### 8. Logger Interfaces
**Files**: logger.ts, agent/logger.ts

**Current**:
```typescript
debug: (...args: any[]) => void
info: (message: string, ...args: any[]) => void
```

**Verdict**: ✅ **ACCEPTABLE**
- Logging needs to accept arbitrary types
- TypeScript's `any[]` for rest parameters is appropriate here
- The values are only converted to strings, not used in type-safe ways

##### 9. Test Mocks and Helpers
**Files**: *.test.ts files

**Verdict**: ✅ **ACCEPTABLE**
- Test code often uses `any` for flexibility
- Not production code
- Changing to strict types would make tests more brittle

##### 10. Dynamic Type Conversions
**Files**: json-schema-conversion.ts, dynamic-types.ts

**Current**:
```typescript
export const WhileLoopStepSchema: any = z.object({...})
```

**Verdict**: ⚠️ **CAN BE IMPROVED**
- These are Zod schemas that should export their proper type
- Use `.infer()` to extract the type:
```typescript
export const WhileLoopStepSchema = z.object({...})
export type WhileLoopStep = z.infer<typeof WhileLoopStepSchema>
```

##### 11. GitHub Types (packages/github/src/types/github-types.ts)
**Lines**: Throughout file

**Verdict**: ✅ **ACCEPTABLE**
- Auto-generated GraphQL types
- Changing them would break when regenerating
- These types come from external GraphQL schema

---

## Implementation Plan

### Phase 1: Critical Type Safety (HIGH PRIORITY)

**Estimated Effort**: 2-3 days

1. **Dynamic Workflow Types** (packages/core/src/workflow/dynamic.ts)
   - [ ] Create proper types for `evaluateValue` function
   - [ ] Add type constraints to `input` and `state` parameters
   - [ ] Create union type for step results instead of `any`
   - [ ] Type enum handling properly
   - [ ] Add comprehensive tests for type safety

2. **Agent Tool Inputs** (packages/core/src/workflow/agent.workflow.ts)
   - [ ] Create `AgentToolInput` type with proper generics
   - [ ] Update `invokeTool` signature
   - [ ] Add type tests for tool invocation

3. **Configuration Objects** (packages/cli/src/workflows/init.workflow.ts)
   - [ ] Define `GeneratedConfig` interface
   - [ ] Update `generatedConfig` variable
   - [ ] Add validation for config structure

4. **API Provider** (packages/cli/src/api.ts)
   - [ ] Import proper AI SDK types
   - [ ] Type the `getProvider` callback
   - [ ] Add runtime validation if needed

### Phase 2: Developer Experience (MEDIUM PRIORITY)

**Estimated Effort**: 1-2 days

5. **Tool Implementation Context** (packages/cli/src/tool-implementations.ts)
   - [ ] Import proper types from AI SDK
   - [ ] Type `toolProvider` and `workflowContext`
   - [ ] Update type assertions to proper type guards

6. **Error Details** (packages/cli/src/agent/errors.ts)
   - [ ] Define `ErrorDetail` interface
   - [ ] Update error classes to use proper type
   - [ ] Update error handling code

7. **Command Options** (packages/cli/src/commands/*.ts)
   - [ ] Create shared `CommandOptions` interface
   - [ ] Update all command handlers
   - [ ] Add options validation

### Phase 3: Schema Types (LOW-MEDIUM PRIORITY)

**Estimated Effort**: 0.5-1 day

8. **Zod Schema Exports** (packages/core/src/workflow/dynamic-types.ts)
   - [ ] Replace `: any` exports with proper `.infer()` types
   - [ ] Export both schema and inferred type
   - [ ] Update all references

### Phase 4: Documentation and Validation (ONGOING)

**Estimated Effort**: 0.5 day

9. **Add ESLint Rules**
   ```typescript
   // .eslintrc.js
   rules: {
     '@typescript-eslint/no-explicit-any': 'warn',
     '@typescript-eslint/no-unsafe-assignment': 'warn',
   }
   ```

10. **Create Type Safety Documentation**
    - [ ] Document acceptable `any` usage (logging, tests)
    - [ ] Create type safety guidelines for contributors
    - [ ] Add examples of proper typing patterns

---

## Success Criteria

### Metrics
- [ ] Reduce production `any` usage by 70% (from ~95 to ~30)
- [ ] Eliminate all HIGH PRIORITY `any` usages
- [ ] Fix all MEDIUM PRIORITY `any` usages
- [ ] Maintain 100% test pass rate
- [ ] No increase in build time

### Quality Gates
- [ ] All TypeScript errors resolved
- [ ] No new `@ts-ignore` or `@ts-expect-error` comments
- [ ] ESLint passes without new warnings
- [ ] All existing tests pass
- [ ] New type-safety tests added

---

## Risk Mitigation

### Potential Issues

1. **Breaking Changes**: Type changes could affect downstream code
   - **Mitigation**: Use gradual migration with optional types
   - **Mitigation**: Add runtime validation where needed

2. **Zod Type Inference**: Complex schemas may not infer well
   - **Mitigation**: Use manual type definitions where inference fails
   - **Mitigation**: Keep `as any` as last resort with documentation

3. **Dynamic Workflows**: Too restrictive types might break workflows
   - **Mitigation**: Use generous generics with proper constraints
   - **Mitigation**: Keep some flexibility in `input` and `state` types

4. **Test Failures**: Type changes may break test mocks
   - **Mitigation**: Update tests alongside production code
   - **Mitigation**: Create proper test utilities that are type-safe

### Rollback Plan

If critical issues arise:
1. Revert changes to specific files
2. Keep documentation for future reference
3. File issues for each problematic change
4. Revisit with alternative approach

---

## Recommended Next Steps

1. **Start with Phase 1** - Focus on critical type safety issues
2. **Create feature branch** - `feature/eliminate-any-types`
3. **Work incrementally** - One file/category at a time
4. **Test thoroughly** - Run full test suite after each change
5. **Document decisions** - Comment why certain `any` usages remain

---

## Acceptable `any` Usage (Do Not Change)

✅ **Logger rest parameters**: `...args: any[]`
✅ **Test code mocks and fixtures**
✅ **Auto-generated types** (GitHub GraphQL)
✅ **Catch block error variables**: `error: any` (when you need `error.details`)
✅ **Intentionally dynamic data**: With proper documentation

## Timeline Estimate

- **Phase 1**: 2-3 days
- **Phase 2**: 1-2 days
- **Phase 3**: 0.5-1 day
- **Phase 4**: 0.5 day
- **Testing & Validation**: 1 day

**Total**: 5-8 days depending on complexity and testing

---

## Conclusion

This plan provides a structured approach to eliminating unnecessary `any` types while:
- Maintaining code flexibility where needed
- Improving type safety in critical areas
- Following TypeScript best practices
- Keeping the codebase maintainable

The phased approach allows for incremental progress with continuous validation.
