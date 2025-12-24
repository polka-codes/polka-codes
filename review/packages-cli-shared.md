# Code Review: packages/cli-shared

**Date:** 2025-12-24
**Files Reviewed:** 10 source files
**Test Coverage:** 80% (8 test files)

---

## CRITICAL BUGS (Must Fix)

### 1. Missing Timeout in Network Requests
**File:** `packages/cli-shared/src/config.ts:78-99`
**Issue:** HTTP requests without timeout mechanism

```typescript
const response = await fetch(rule.url)  // No timeout
```

**Impact:** Application hangs indefinitely if network request hangs

**Fix:** Add timeout with AbortController
```typescript
const controller = new AbortController()
const timeout = setTimeout(() => controller.abort(), 30000)
const response = await fetch(rule.url, { signal: controller.signal })
clearTimeout(timeout)
```

---

### 2. Missing Command Execution Timeout
**File:** `packages/cli-shared/src/provider.ts:270`
**Issue:** Command execution can run indefinitely

```typescript
// TODO: add timeout
const child = spawn(command, [], {
  shell: true,
  stdio: 'pipe',
})
```

**Impact:** Commands can hang indefinitely

**Fix:** Add timeout to child process

---

### 3. Unsafe Command Execution with shell: true
**File:** `packages/cli-shared/src/provider.ts:277`
**Issue:** Using `shell: true` without proper sanitization

```typescript
const child = spawn(command, [], {
  shell: true,  // Dangerous if command contains user input
  stdio: 'pipe',
})
```

**Impact:** Command injection vulnerability

**Fix:** Validate and sanitize commands, or use array form without shell

---

### 4. Mutable Global State
**File:** `packages/cli-shared/src/utils/eventHandler.ts:8-9`
**Issue:** Module-level mutable state causes test pollution

```typescript
const taskToolCallStats = new Map<string, ToolStat>()
const globalToolCallStats = new Map<string, ToolStat>()
```

**Impact:**
- State leakage between tests
- Potential race conditions
- Tests can affect each other

**Fix:** Use dependency injection or reset between tests

---

## DUPLICATED CODE

### 1. Error Handling Pattern (8+ occurrences)
**Files:** `config.ts`, `provider.ts`, `listFiles.ts`

**Pattern:**
```typescript
try {
  // operation
} catch (error) {
  console.warn(`Failed to ...: ${error}`)
  return undefined
}
```

**Recommendation:** Extract to utility
```typescript
async function safeFetch(url: string): Promise<string | undefined> {
  try {
    const response = await fetch(url)
    if (response.ok) return await response.text()
    console.warn(`Failed to fetch ${url}: ${response.statusText}`)
  } catch (error) {
    console.warn(`Error fetching ${url}: ${error}`)
  }
  return undefined
}
```

---

### 2. ID Generation Logic (2+ occurrences)
**File:** `packages/cli-shared/src/provider.ts:114-135`

**Pattern:**
```typescript
const maxId = items.reduce((max, item) => {
  const idNum = parseInt(item.id, 10)
  return Math.max(max, idNum)
}, 0)
```

**Recommendation:** Extract to `getMaxId(items)` utility

---

### 3. Hierarchical Filtering (4+ occurrences)
**File:** `packages/cli-shared/src/provider.ts:67,73,101,120-121`

**Pattern:**
```typescript
items.filter((i) =>
  i.id.startsWith(`${id}.`) &&
  i.id.split('.').length === id.split('.').length + 1
)
```

**Recommendation:** Extract to `getChildItems(parentId, items)` utility

---

## POOR CODE QUALITY

### 1. Massive getProvider Function (344 lines)
**File:** `packages/cli-shared/src/provider.ts:53-397`

**Issues:**
- Too large to understand and test
- Multiple responsibilities:
  - Todo operations
  - Memory operations
  - Sorting logic
  - ID generation

**Recommendation:** Break into smaller functions or use class-based approach

---

### 2. Complex Sorting Logic
**File:** `packages/cli-shared/src/provider.ts:80-91`

```typescript
items.sort((a, b) => {
  const aParts = a.id.split('.')
  const bParts = b.id.split('.')
  const len = Math.min(aParts.length, bParts.length)
  for (let i = 0; i < len; i++) {
    const comparison = aParts[i].localeCompare(bParts[i], undefined, { numeric: true })
    if (comparison !== 0) {
      return comparison
    }
  }
  return aParts.length - bParts.length
})
```

**Issues:**
- Manual sorting implementation
- Splits IDs multiple times
- Hard to understand at a glance

**Recommendation:** Extract to documented utility with tests

---

### 3. Magic Numbers
- `provider.ts:300` - `summaryThreshold ?? 5000` - why 5000?
- `parameterSimplifier.ts:22` - `maxCount !== 2000` - why 2000?
- `listFiles.ts:104` - Sorting without explanation

---

### 4. Unclear Variable Naming
**File:** `eventHandler.ts:8-9`

```typescript
const taskToolCallStats = new Map<string, ToolStat>()
const globalToolCallStats = new Map<string, ToolStat>()
```

**Issue:** Names don't indicate they're module-level mutable state

**Recommendation:** Use `globalTaskToolStatsRegistry` style naming

---

## TYPE SAFETY ISSUES

### 1. Excessive Use of `any`

**Files:**
- `provider.ts:377` - `vertex.tools.googleSearch({}) as any`
- `config.test.ts:282` - Mock implementation
- `searchFiles.test.ts:20,163,179` - Mock EventEmitters
- `eventHandler.test.ts:8` - `_write(chunk: any, ...)`

**Impact:** Bypasses TypeScript's type checking

---

### 2. Weak Type Definitions
**File:** `packages/cli-shared/src/parameterSimplifier.ts:1-2`

```typescript
type SimplifiedParams = Record<string, unknown>
type ParameterSimplifier = (params: Record<string, unknown>) => SimplifiedParams
```

**Issue:** Too generic, loses type information

**Recommendation:** Use discriminated unions or more specific types

---

### 3. Missing Type Guards
**File:** `packages/cli-shared/src/parameterSimplifier.ts:49`

```typescript
if (params === undefined || params === null) {
  return {}
}
```

**Issue:** TypeScript can't properly narrow types after this check

**Recommendation:** Use proper type guards

---

### 4. Unsafe Type Assertions
**File:** `packages/cli-shared/src/provider.ts:341-343`

```typescript
answerOptions.push(otherMessage)  // Mutates parameter!
```

**Issue:** Modifies input parameter, potential side effects

---

## PERFORMANCE CONCERNS

### 1. Inefficient Sorting
**File:** `packages/cli-shared/src/listFiles.ts:150`

```typescript
results.sort()  // O(n log n) on potentially large arrays
```

**Impact:** Unnecessary sort on every call

**Recommendation:** Consider lazy sorting or document why sort is needed

---

### 2. Repeated String Splitting
**File:** `packages/cli-shared/src/provider.ts:73,80-83`

```typescript
i.id.split('.').length === id.split('.').length + 1  // Splits same ID multiple times
```

**Impact:** Unnecessary string allocations

**Recommendation:** Cache split result

---

### 3. No Caching for Expensive Operations
**File:** `packages/cli-shared/src/config.ts:73-111`

**Issue:** Fetching rules from URLs every time without caching

```typescript
const response = await fetch(rule.url)  // No caching
```

**Impact:** Repeated network requests for same URLs

**Recommendation:** Implement caching with TTL

---

### 4. Synchronous File Operations
**File:** `packages/cli-shared/src/config.ts:171`

```typescript
export const readConfig = (path: string): Config => {
  const file = readFileSync(path, 'utf8')  // Synchronous!
  // ...
}
```

**Issue:** Uses `readFileSync` in codebase that's otherwise async

**Recommendation:** Use `readFile` for consistency

---

## ERROR HANDLING ISSUES

### 1. Silent Failures
**File:** `packages/cli-shared/src/config.ts:127`

```typescript
// Global config errors only warn, don't throw
console.warn('Failed to load global config...')
```

**File:** `packages/cli-shared/src/provider.ts:208-210`
```typescript
} catch {
  return undefined  // Returns undefined on error
}
```

**Impact:** Errors are swallowed, difficult debugging

---

### 2. Inconsistent Error Logging
**Issue:** Mix of `console.warn`, `console.error`, and throwing

**Locations:** Throughout `config.ts` and `provider.ts`

**Impact:** Inconsistent error handling patterns

---

### 3. Generic Error Types
**File:** `packages/cli-shared/src/config.ts:139`

```typescript
throw error  // Original error type is lost
```

**Recommendation:** Wrap errors with context

---

## SECURITY CONCERNS

### 1. Insufficient Path Validation
**File:** `packages/cli-shared/src/provider.ts:241-243`

```typescript
if (!resolvedPath.startsWith(process.cwd())) {
  throw new Error(`Access to file path "${filePath}" is restricted.`)
}
```

**Issue:** Path normalization might not be sufficient against all path traversal attacks

**Recommendation:** Use more robust path validation library

---

### 2. Unsafe Command Execution (Multiple)
- `provider.ts:277` - `shell: true` with potential user input

---

## MISSING VALIDATION

### 1. No Input Validation for Todo Operations
**File:** `packages/cli-shared/src/provider.ts:63-167`

**Issues:**
- No validation of negative IDs
- No validation of invalid characters
- No length limits

---

### 2. Parameter Mutation
**File:** `packages/cli-shared/src/provider.ts:341-343`

```typescript
answerOptions.push(otherMessage)  // Mutates input parameter!
```

**Issue:** Side effect, unexpected behavior

---

## TESTING ISSUES

### 1. Tests Skipped in CI
**File:** `packages/cli-shared/src/utils/searchFiles.test.ts:47`

```typescript
// TODO: investigate why this test is failing on CI but passes locally
describe.skipIf(!!process.env.CI)('searchFiles with real files', () => {
```

**Impact:** Reduced test coverage in CI environment

**Recommendation:** Fix the test rather than skipping

---

### 2. Mutable Global State in Tests
**File:** `packages/cli-shared/src/utils/eventHandler.test.ts:15-36`

**Issue:** Tests depend on module-level state that isn't properly reset

**Impact:** Tests can affect each other, flaky behavior

---

### 3. Excessive Mocking
**Issue:** Many tests rely on complex mock setups

**Impact:** Tests are brittle and hard to maintain

---

## INCONSISTENCIES

### 1. Mixed Async Patterns
**Issue:** Some functions use async/await, others use promises directly

**Impact:** Inconsistent code style

---

### 2. Inconsistent Return Types
**File:** `packages/cli-shared/src/provider.ts:202-210`

```typescript
// readFile returns undefined on error instead of throwing
// or returning a Result type
```

**Impact:** Callers must check for undefined, easy to forget

---

## RECOMMENDATIONS BY PRIORITY

### High Priority (Fix Immediately)
1. Add timeout to all network operations (config.ts fetch)
2. Add timeout to command execution (provider.ts)
3. Fix unsafe command execution (shell: true)
4. Fix mutable global state causing test pollution
5. Add proper path validation

### Medium Priority (Fix Soon)
1. Refactor large getProvider function (344 lines)
2. Extract common error handling patterns
3. Implement caching for expensive operations
4. Reduce usage of `any` type
5. Fix CI test issues rather than skipping

### Low Priority (Improvement)
1. Extract magic numbers to constants
2. Use async file operations consistently
3. Improve variable naming
4. Add comprehensive error types with context
5. Document complex logic with examples

---

## SUMMARY STATISTICS

| Category | Count |
|----------|-------|
| Critical Bugs | 4 |
| Duplicated Code Patterns | 3+ |
| Complex Functions (>100 lines) | 1 |
| Type Safety Issues (`any` usage) | 8+ |
| Performance Concerns | 4 |
| Security Concerns | 2 |
| Missing Error Handling | 6+ |
| Test Issues | 3 |

**Overall Assessment:** The cli-shared package has good test coverage (80%) but critical issues with missing timeouts and unsafe command execution. The massive `getProvider` function needs refactoring. Mutable global state affects test reliability.
