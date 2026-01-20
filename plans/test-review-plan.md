# Test Review Plan

**Created**: 2025-01-20
**Scope**: All 77 test files across packages/core, packages/cli, packages/cli-shared, packages/github, and packages/runner
**Goal**: Improve test quality, reduce maintenance overhead, and ensure tests provide real value

## Executive Summary

This plan addresses common testing anti-patterns found across the codebase:
- **Redundant tests** that duplicate type system guarantees
- **Excessive mocking** that indicates tight coupling
- **Snapshot testing** without proper management
- **Missing edge cases** and error paths
- **Poor test isolation** and cleanup practices
- **Inconsistent test organization**

## Priority Levels

- **P0 (Critical)**: Tests that are misleading, broken, or causing false confidence
- **P1 (High)**: Tests that need refactoring for maintainability
- **P2 (Medium)**: Tests that could be improved but are currently functional
- **P3 (Low)**: Nice-to-have improvements

---

## 1. Redundant Tests - Type System Overassertion

### Problem
Tests that verify what TypeScript's type system already guarantees provide no additional value and increase maintenance burden.

### Examples Found

#### P1: `packages/cli/src/agent/constants.test.ts:14-30`
```typescript
// BAD: Testing type-guaranteed constants
it('should have correct mapping structure', () => {
  expect(WORKFLOW_MAPPING).toMatchSnapshot()
})

it('should have 4 strategies', () => {
  expect(DEFAULT_DISCOVERY_STRATEGIES).toHaveLength(4)
})
```

**Issue**: These are compile-time constants. The type system ensures their structure. Runtime testing adds no value.

#### P2: `packages/core/src/utils/merge.test.ts`
```typescript
// Tests that TypeScript already validates
it('should return correct type', () => {
  const result = deepMerge(base, override, ['nested'])
  expectTypeOf(result).toMatchTypeOf<BaseType>()
})
```

**Issue**: If `deepMerge` is correctly typed, TypeScript will catch type mismatches at compile time.

### Fix Strategy

1. **Remove snapshot tests for static constants**
   - Delete tests that only verify constant values or structure
   - The compiler is the test for these

2. **Focus on runtime behavior**
   - Test logic, algorithms, and runtime validations
   - Test things that can only be verified at runtime

3. **When to keep constant tests**
   - If constants are computed or loaded dynamically
   - If constants have complex validation rules
   - If constants are user-configurable

### Action Items

- [ ] Audit all test files for redundant type assertions
- [ ] Remove snapshot tests for static constants
- [ ] Document which constant tests (if any) should be kept

---

## 2. Mock Overuse - Tight Coupling Indicators

### Problem
Excessive mocking, especially with `any` types, indicates tight coupling and makes tests brittle.

### Examples Found

#### P0: `packages/cli/src/workflows/fix.workflow.test.ts:13-32`
```typescript
// BAD: Mocking entire context with 'any'
const createMockContext = () => {
  const tools = {
    executeCommand: mock<any>(),
    input: mock<any>(),
    generateText: mock<any>(),
    taskEvent: mock<any>(),
    getMemoryContext: mock<any>(async () => ''),
    updateMemory: mock<any>(),
    // ... 15+ more mocks
  }
  const step = mock(async (_name: string, arg2: any, arg3: any) => {
    const fn = typeof arg2 === 'function' ? arg2 : arg3
    return fn()
  })
}
```

**Issues**:
- Uses `any` which defeats type safety
- Mocks entire workflow context - what are we actually testing?
- Tests mock behavior, not real behavior
- Brittle - breaks when context interface changes

#### P1: `packages/cli/src/workflows/commit.workflow.test.ts`
```typescript
// Similar pattern - 20+ mock calls
const mockContext = createMockContext()
mockContext.tools.executeCommand.mockResolvedValue({ /* ... */ })
mockContext.tools.generateText.mockResolvedValue({ /* ... */ })
// ... many more mock setups
```

### Fix Strategy

1. **Prefer real implementations over mocks**
   ```typescript
   // GOOD: Use real implementations where possible
   const mockProvider = new MockProvider()
   const context = createContext({
     provider: mockProvider,
     // Only mock what's necessary
   })
   ```

2. **Create proper test doubles with specific types**
   ```typescript
   // GOOD: Typed test double
   interface TestContext {
     generateText: Mock<typeof generateText>
     executeCommand: Mock<typeof executeCommand>
   }
   ```

3. **Use builder pattern for complex test data**
   ```typescript
   // GOOD: Builder pattern
   const context = new TestContextBuilder()
     .withProvider(mockProvider)
     .withMemoryStore(testStore)
     .build()
   ```

4. **Extract shared fixtures**
   - Create reusable test utilities in `test/fixtures/`
   - Build domain-specific test data factories

### Action Items

- [ ] Audit workflow tests for mock overuse
- [ ] Create typed test double utilities
- [ ] Extract common test fixtures to shared location
- [ ] Refactor workflow tests to use real implementations where possible
- [ ] Set maximum mock count per test (recommendation: 3-5)

---

## 3. Snapshot Testing - Poor Management

### Problem
Snapshots are used extensively without clear strategy, leading to:
- Large snapshot files that are hard to review
- Snapshots for simple values that should be asserted directly
- No process for snapshot updates

### Examples Found

#### P1: `packages/cli/src/workflows/plan.workflow.test.ts:50-60`
```typescript
// QUESTIONABLE: Snapshot for simple object
it('should create a plan', async () => {
  const result = await planWorkflow({}, mockContext)
  expect(result).toMatchSnapshot() // 50+ lines of snapshot
})
```

**Better approach**:
```typescript
it('should create a plan with required fields', async () => {
  const result = await planWorkflow({}, mockContext)
  expect(result).toMatchObject({
    status: 'success',
    plan: expect.any(String),
    steps: expect.any(Array),
  })
  // Only snapshot complex nested structures
  expect(result.steps).toMatchSnapshot()
})
```

#### P2: `packages/core/src/tools/*.test.ts`
Multiple files use snapshots for tool outputs that could be asserted directly.

### Fix Strategy

1. **When to use snapshots**
   - Complex nested structures that would be tedious to assert
   - Error messages that are unlikely to change
   - Generated code/output where exact format matters

2. **When NOT to use snapshots**
   - Simple objects with 3-5 properties
   - Status responses (success/error)
   - Booleans, numbers, strings
   - Arrays that can be tested with `toHaveLength()`

3. **Snapshot best practices**
   ```typescript
   // GOOD: Focused snapshot with redaction
   expect(result).toMatchSnapshot({
     id: expect.any(String), // Redact unstable IDs
     timestamp: expect.any(Number), // Redact timestamps
     data: { /* only snapshot the complex part */ }
   })
   ```

4. **Create snapshot helpers**
   ```typescript
   // test/utils/snapshots.ts
   export function redactUnstableFields<T>(obj: T, fields: (keyof T)[]): T {
     // Redact fields like id, timestamp, etc.
   }
   ```

### Action Items

- [ ] Audit all snapshot usage (found in 20+ files)
- [ ] Create redaction helpers for unstable fields
- [ ] Replace simple snapshots with direct assertions
- [ ] Document snapshot review process in CONTRIBUTING.md
- [ ] Set snapshot size limits (recommendation: 20 lines max)

---

## 4. Test Coverage Gaps

### Problem
Many tests only cover the happy path, missing edge cases and error handling.

### Examples Found

#### P0: `packages/core/src/tools/search.test.ts`
```typescript
// MISSING: Error cases, provider validation, edge cases
describe('search', () => {
  it('should use provider.search if available', async () => {
    // Only happy path tested
  })
  // Missing:
  // - What if provider.search throws?
  // - What if provider doesn't have search method?
  // - What if query is empty/invalid?
  // - What if results exceed limits?
})
```

#### P0: `packages/cli/src/commands/memory.test.ts`
```typescript
// MISSING: Transaction rollback, concurrent access
describe('memoryRename', () => {
  it('should rename an entry', async () => {
    // Happy path only
  })
  // Missing:
  // - What if entry doesn't exist?
  // - What if new name already exists?
  // - What if transaction fails?
  // - Concurrent rename operations?
})
```

#### P1: `packages/cli-shared/src/sqlite-memory-store.test.ts`
Good coverage overall, but missing:
- Concurrent access patterns
- Database corruption handling
- Large dataset performance
- Transaction isolation levels

### Fix Strategy

1. **For each function, test three paths**
   ```typescript
   describe('functionName', () => {
     // Happy path
     it('should succeed with valid input', () => { /* ... */ })

     // Error path
     it('should throw with invalid input', () => { /* ... */ })

     // Edge cases
     it('should handle empty/missing input', () => { /* ... */ })
     it('should handle boundary conditions', () => { /* ... */ })
   })
   ```

2. **Error case testing checklist**
   - [ ] Invalid inputs (null, undefined, wrong type)
   - [ ] Network/service failures
   - [ ] Resource exhaustion (memory, disk)
   - [ ] Concurrent access
   - [ ] Permission/access denied

3. **Property-based testing for complex logic**
   ```typescript
   // Use fast-check or similar for property-based tests
   it('should preserve roundtrip for all valid inputs', () => {
     fc.assert(fc.property(fc.string(), (input) => {
       const encoded = encode(input)
       const decoded = decode(encoded)
       return decoded === input
     }))
   })
   ```

### Action Items

- [ ] Audit all test files for missing error paths
- [ ] Add error case tests for all public APIs
- [ ] Add edge case tests (empty, null, boundary values)
- [ ] Consider property-based testing for complex pure functions
- [ ] Set minimum coverage requirements (recommendation: 80% path coverage)

---

## 5. Test Isolation and Cleanup

### Problem
Tests that depend on global state, don't clean up properly, or interfere with each other.

### Examples Found

#### P0: `packages/cli/src/commands/__tests__/script-generator.integration.test.ts:8-30`
```typescript
// BAD: Creates directories in process.cwd()
const testProjectDir = join(process.cwd(), 'test-script-generator')
const configPath = join(testProjectDir, '.polkacodes.yml')
const scriptsDir = join(testProjectDir, '.polka-scripts')

// Weak cleanup
afterEach(() => {
  try {
    rmSync(testProjectDir, { recursive: true, force: true })
  } catch {
    // Silent failure - no indication if cleanup fails
  }
})
```

**Issues**:
- Creates files in working directory
- Silent cleanup failures
- No isolation between test runs
- Could interfere with other tests running in parallel

#### P1: `packages/cli-shared/src/sqlite-memory-store.test.ts`
```typescript
// Potential issue: Uses shared :memory: database
const store = new SQLiteMemoryStore(':memory:')
// Tests might interfere if run in parallel
```

### Fix Strategy

1. **Use proper temp directories**
   ```typescript
   // GOOD: Isolated temp directory per test
   import { mkdtempSync, rmdirSync } from 'fs'
   import { tmpdir } from 'os'
   import { join } from 'path'

   let testDir: string
   beforeEach(() => {
     testDir = mkdtempSync(join(tmpdir(), 'test-XXXXXX'))
   })

   afterEach(() => {
     try {
       rmdirSync(testDir, { recursive: true })
     } catch (error) {
       console.error('Failed to cleanup test dir:', testDir, error)
     }
   })
   ```

2. **Use test fixtures for setup/teardown**
   ```typescript
   // GOOD: Reusable test fixture
   export class TempDirectoryFixture {
     private dir: string | null = null

     async setup(): Promise<string> {
       this.dir = await fs.mkdtemp(join(tmpdir(), 'test-'))
       return this.dir
     }

     async teardown(): Promise<void> {
       if (this.dir) {
         await fs.rm(this.dir, { recursive: true, force: true })
         this.dir = null
       }
     }
   }
   ```

3. **Ensure test independence**
   - Each test should be able to run in isolation
   - Tests should not depend on execution order
   - Use unique identifiers for resources (UUIDs, timestamps)

4. **Database test patterns**
   ```typescript
   // GOOD: In-memory database with unique name per test
   const store = new SQLiteMemoryStore(`:memory:${randomUUID()}`)
   ```

### Action Items

- [ ] Audit all tests for process.cwd() usage
- [ ] Replace with proper temp directory fixtures
- [ ] Add cleanup logging to catch failures
- [ ] Ensure all integration tests use unique identifiers
- [ ] Add test for test isolation (run tests in random order)

---

## 6. Test Organization and Structure

### Problem
Inconsistent test organization makes tests hard to navigate and maintain.

### Examples Found

#### P2: Inconsistent naming patterns
```typescript
// Some files use:
describe('functionName', () => { /* ... */ })

// Others use:
describe('ClassName', () => { /* ... */ })

// Mixed use of it/test within same file
```

#### P2: Poor logical grouping
`packages/cli/src/agent/logger.test.ts` has 8 separate describe blocks, one per method, but no higher-level organization.

### Fix Strategy

1. **Standardize test structure**
   ```typescript
   // RECOMMENDED: Test file structure
   describe('ClassName', () => {
     describe('constructor', () => {
       it('should initialize with valid args', () => { /* ... */ })
       it('should throw with invalid args', () => { /* ... */ })
     })

     describe('methodName', () => {
       it('should succeed in happy path', () => { /* ... */ })
       it('should handle errors', () => { /* ... */ })
       it('should handle edge cases', () => { /* ... */ })
     })

     describe('integration', () => {
       // Integration tests
     })
   })
   ```

2. **Use consistent naming**
   - Test files: `ClassName.test.ts` or `feature-name.test.ts`
   - Describe blocks: Match the class/function being tested
   - Test names: Should read as sentences ("should return result when input is valid")

3. **Group related tests**
   - By feature/module
   - By complexity (unit vs integration)
   - By concern (happy path, error cases, edge cases)

### Action Items

- [ ] Document standard test structure patterns
- [ ] Create test templates for common patterns
- [ ] Audit existing tests for consistency
- [ ] Refactor inconsistent test files

---

## 7. Specific File Action Plans

### High Priority Files

#### `packages/cli/src/workflows/*.workflow.test.ts`
**Issues**: Mock overuse, large snapshots, missing error cases
**Actions**:
- [ ] Replace `any` type mocks with proper test doubles
- [ ] Create shared test fixtures for workflow context
- [ ] Add error cases (tool failures, validation errors)
- [ ] Break large snapshots into focused assertions

#### `packages/cli/src/commands/memory.test.ts`
**Issues**: Missing transaction tests, no concurrent access tests
**Actions**:
- [ ] Add transaction rollback tests
- [ ] Add concurrent operation tests
- [ ] Test error handling (file not found, permission denied)
- [ ] Test timestamp preservation

#### `packages/core/src/tools/*.test.ts`
**Issues**: Only happy path tested, missing error handling
**Actions**:
- [ ] Add error case for each tool
- [ ] Test provider integration (not just mocks)
- [ ] Add validation tests for tool inputs
- [ ] Test tool timeout handling

#### `packages/cli/src/commands/__tests__/*.integration.test.ts`
**Issues**: Poor test isolation, weak cleanup
**Actions**:
- [ ] Move from process.cwd() to temp directories
- [ ] Add proper cleanup logging
- [ ] Ensure tests can run in parallel
- [ ] Add unique identifiers to all resources

---

## 8. Testing Guidelines Document

Create `docs/testing-guidelines.md` with:

1. **When to write tests**
   - Public APIs: Always test
   - Private methods: Test only if complex
   - Simple getters/setters: Don't test

2. **Test structure template**
   ```typescript
   describe('FeatureName', () => {
     let fixture: TestFixture

     beforeEach(() => {
       fixture = createFixture()
     })

     afterEach(async () => {
       await fixture.cleanup()
     })

     describe('methodName', () => {
       it('should do X when Y', async () => {
         // Arrange
         const input = fixture.createInput()

         // Act
         const result = await fixture.methodName(input)

         // Assert
         expect(result).toEqual(expected)
       })
     })
   })
   ```

3. **Mock usage guidelines**
   - Maximum 3-5 mocks per test
   - Prefer real implementations
   - Use typed mocks, not `any`
   - Mock at boundaries (network, filesystem, database)

4. **Snapshot guidelines**
   - Max 20 lines per snapshot
   - Redact unstable fields
   - Review snapshots in PRs
   - Don't snapshot simple values

5. **Coverage requirements**
   - 80% line coverage minimum
   - 100% for critical paths (security, data integrity)
   - All error paths must be tested

---

## 9. Implementation Roadmap

### Phase 1: Critical Fixes (Week 1)
- [ ] Fix test isolation issues (P0)
- [ ] Add missing error cases to critical paths (P0)
- [ ] Reduce mock overuse in workflow tests (P0)

### Phase 2: High-Value Improvements (Week 2)
- [ ] Clean up snapshot testing (P1)
- [ ] Remove redundant tests (P1)
- [ ] Improve test organization (P1)

### Phase 3: Coverage Enhancement (Week 3)
- [ ] Add edge case tests (P1)
- [ ] Add integration tests where missing (P2)
- [ ] Improve test documentation (P2)

### Phase 4: Tooling and Process (Week 4)
- [ ] Set up coverage reporting
- [ ] Add test linting rules
- [ ] Create test templates and fixtures
- [ ] Document testing guidelines

---

## 10. Success Metrics

Track these metrics before and after:

1. **Test count**: Target reduction by removing redundant tests
2. **Coverage**: Maintain or increase (aim for 85%+)
3. **Test runtime**: Should decrease (better isolation, less setup)
4. **Mock count**: Reduce by 50%+
5. **Snapshot count**: Reduce by 30%+
6. **Flaky test rate**: Should be 0%

---

## Appendix: Quick Reference

### Test Smells to Watch For

| Smell | Example | Fix |
|-------|---------|-----|
| Testing types | `expectTypeOf(x).toEqual(y)` | Remove (TypeScript does this) |
| Mock overuse | 10+ mocks in one test | Use real implementations or fixtures |
| Large snapshots | 50+ line snapshot | Break into focused assertions |
| No error tests | Only happy path | Add error/edge case tests |
| Global state | `process.cwd()` | Use temp directories |
| Silent cleanup | `try { clean() } catch {}` | Log cleanup failures |
| Brittle assertions | Exact object match | Use `toMatchObject` or partial match |
| Test interdependence | Tests must run in order | Make tests independent |

### Good Test Pattern

```typescript
describe('Feature', () => {
  let subject: Feature
  let mockDependency: Mock<Dependency>

  beforeEach(() => {
    mockDependency = createMockDependency()
    subject = new Feature(mockDependency)
  })

  afterEach(() => {
    // Verify mock calls
    expect(mockDependency.method).toHaveBeenCalledTimes(1)
  })

  it('should succeed with valid input', async () => {
    // Arrange
    const input = createValidInput()

    // Act
    const result = await subject.doSomething(input)

    // Assert
    expect(result.status).toBe('success')
    expect(result.data).toMatchSnapshot({
      id: expect.any(String),
      timestamp: expect.any(Number),
    })
  })

  it('should handle errors gracefully', async () => {
    // Arrange
    mockDependency.method.mockRejectedValue(new Error('test'))

    // Act & Assert
    await expect(subject.doSomething()).rejects.toThrow('test')
  })
})
```

---

**Next Steps**:
1. Review this plan with the team
2. Prioritize based on team capacity
3. Create tracking issues for each phase
4. Start with P0 issues
5. Track metrics to measure improvement
