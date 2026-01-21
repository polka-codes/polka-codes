# Testing Guidelines

**Version**: 1.0
**Last Updated**: 2025-01-21
**Scope**: All packages in the polka-codes monorepo

## Table of Contents

1. [Core Principles](#core-principles)
2. [When to Write Tests](#when-to-write-tests)
3. [Test Structure](#test-structure)
4. [Best Practices](#best-practices)
5. [Common Patterns](#common-patterns)
6. [Anti-Patterns](#anti-patterns)
7. [Coverage Requirements](#coverage-requirements)
8. [Running Tests](#running-tests)

---

## Core Principles

### 1. Test Behavior, Not Implementation

Tests should verify what the code does, not how it's implemented.

```typescript
// ✅ GOOD: Tests behavior
it('should filter completed todos', () => {
  const result = filterTodos(todos, 'completed')
  expect(result.every((t) => t.status === 'completed')).toBe(true)
})

// ❌ BAD: Tests implementation details
it('should call filter method', () => {
  const spy = spyOn(todos, 'filter')
  filterTodos(todos, 'completed')
  expect(spy).toHaveBeenCalled()
})
```

### 2. Tests Should Be Independent

Each test should be able to run in isolation and in any order.

```typescript
// ✅ GOOD: Each test creates its own data
describe('feature', () => {
  it('test 1', () => {
    const data = createTestData()
    // Test with data
  })

  it('test 2', () => {
    const data = createTestData() // Fresh data
    // Test with data
  })
})

// ❌ BAD: Tests depend on shared state
let sharedData: any
beforeEach(() => {
  sharedData = createTestData()
})
// Tests modify sharedData and depend on execution order
```

### 3. Use Descriptive Names

Test names should read as complete sentences that describe what is being tested.

```typescript
// ✅ GOOD: Descriptive name
it('should return error when file does not exist', () => {})

// ❌ BAD: Vague name
it('should work', () => {})
it('test error', () => {})
```

### 4. One Assertion Per Test (When Possible)

Tests should verify one thing. If a test has multiple assertions, they should all be related to verifying the same behavior.

```typescript
// ✅ GOOD: Focused test
it('should return user object with correct structure', () => {
  const user = getUser('123')
  expect(user).toHaveProperty('id', '123')
  expect(user).toHaveProperty('name')
  expect(user).toHaveProperty('email')
})

// ❌ BAD: Testing multiple unrelated behaviors
it('should get user and update database and send email', () => {
  // Too many things being tested
})
```

---

## When to Write Tests

### Always Test

1. **Public APIs**: Any function, class, or module that is exported
2. **Complex Logic**: Algorithms, calculations, data transformations
3. **Error Handling**: All error paths and edge cases
4. **External Integrations**: API calls, file system operations, database queries
5. **User-Facing Features**: Commands, workflows, tools

### Generally Don't Test

1. **Type Guarantees**: TypeScript already validates types at compile time
   ```typescript
   // ❌ DON'T: Test what TypeScript validates
   it('should return string', () => {
     expect(typeof getName()).toBe('string')
   })
   ```

2. **Simple Getters/Setters**: Trivial property accessors
   ```typescript
   // ❌ DON'T: Test simple getters
   it('should return name', () => {
     expect(user.name).toBe('John')
   })
   ```

3. **Third-Party Libraries**: Trust that well-tested libraries work
   ```typescript
   // ❌ DON'T: Test library functionality
   it('should parse JSON', () => {
     expect(JSON.parse('{"a":1}')).toEqual({ a: 1 })
   })
   ```

4. **Constants**: Static values that TypeScript validates
   ```typescript
   // ❌ DON'T: Test constants
   it('should have correct constant value', () => {
     expect(MAX_RETRIES).toBe(3)
   })
   ```

### Sometimes Test

1. **Private Methods**: Only if they contain complex logic
   - Use test doubles if testing through public API is too difficult
   - Consider if complex private logic should be extracted to a separate module

2. **Configuration Objects**: If they have validation or computed values
   ```typescript
   // ✅ OK: Test configuration with validation
   it('should validate required config fields', () => {
     expect(() => loadConfig({})).toThrow('Missing required field')
   })
   ```

---

## Test Structure

### The Arrange-Act-Assert Pattern

Organize tests into three clear sections:

```typescript
it('should update todo status', async () => {
  // Arrange: Set up the test
  const todo = { id: '1', status: 'pending' }
  const provider = createMockProvider()
  const updateSpy = spyOn(provider, 'updateTodo')

  // Act: Execute the code being tested
  await updateTodoStatus(provider, '1', 'completed')

  // Assert: Verify the result
  expect(updateSpy).toHaveBeenCalledWith('1', { status: 'completed' })
})
```

### Test File Organization

```typescript
// 1. Imports
import { describe, expect, it } from 'bun:test'
import { functionToTest } from './file'

// 2. Top-level describe for the feature
describe('FeatureName', () => {
  // 3. Nested describe for specific methods/behaviors
  describe('methodName', () => {
    // 4. Setup and cleanup
    let subject: FeatureName

    beforeEach(() => {
      subject = new FeatureName()
    })

    afterEach(() => {
      // Cleanup
    })

    // 5. Tests grouped by scenario
    describe('happy path', () => {
      it('should succeed with valid input', () => {})
      it('should handle edge case X', () => {})
    })

    describe('error handling', () => {
      it('should throw on invalid input', () => {})
      it('should handle network errors', () => {})
    })
  })
})
```

---

## Best Practices

### 1. Use Real Implementations Over Mocks

```typescript
// ✅ GOOD: Use real implementation
it('should parse configuration file', () => {
  const config = loadConfig('test/fixtures/config.json')
  expect(config.apiKey).toBe('test-key')
})

// ❌ BAD: Mock the file system
it('should parse configuration file', () => {
  spyOn(fs, 'readFileSync').mockReturnValue('{"apiKey":"test"}')
  const config = loadConfig('config.json')
  expect(config.apiKey).toBe('test')
})
```

### 2. Avoid `any` Types in Tests

```typescript
// ✅ GOOD: Properly typed mocks
const mockProvider: MockProvider = {
  generateText: mock(() => Promise.resolve({ text: 'response' })),
}

// ❌ BAD: Using any
const mockProvider: any = {
  generateText: mock(),
}
```

### 3. Use Proper Temp Directories

```typescript
// ✅ GOOD: Use temp directory
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'

let tempDir: string

beforeEach(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'test-'))
})

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true })
})

it('should create file in temp directory', () => {
  writeFile(join(tempDir, 'test.txt'), 'content')
  expect(existsSync(join(tempDir, 'test.txt'))).toBe(true)
})

// ❌ BAD: Use current working directory
it('should create file', () => {
  writeFile('test.txt', 'content')
  // Pollutes working directory
})
```

### 4. Clean Up Resources

```typescript
// ✅ GOOD: Proper cleanup
let server: TestServer
let db: TestDatabase

beforeEach(async () => {
  db = await createTestDatabase()
  server = await createTestServer({ db })
})

afterEach(async () => {
  await server.close()
  await db.close()
})

// ❌ BAD: No cleanup
let server: TestServer
beforeEach(() => {
  server = createTestServer()
})
// Resources leak between tests
```

### 5. Use Specific Matchers

```typescript
// ✅ GOOD: Specific matchers
expect(result).toEqual({ id: expect.any(String), status: 'active' })
expect(url).toMatch(/https?:\/\/example.com/)
expect(array).toHaveLength(5)

// ❌ BAD: Generic snapshots
expect(result).toMatchSnapshot()
```

---

## Common Patterns

### Tool Testing Pattern

```typescript
import { MockProvider } from '@polka-codes/core'
import toolName from './toolName'

describe('toolName', () => {
  describe('parameters', () => {
    it('should validate required fields', () => {
      const result = toolName.parameters.safeParse({})
      expect(result.success).toBe(false)
    })
  })

  describe('handler', () => {
    it('should execute successfully', async () => {
      const provider = new MockProvider()
      const result = await toolName.handler(provider, { param: 'value' })

      expect(result.success).toBe(true)
    })
  })
})
```

### Error Testing Pattern

```typescript
describe('error handling', () => {
  it('should throw specific error type', () => {
    expect(() => functionThatThrows()).toThrow(FileSystemAccessError)
  })

  it('should throw error with message', () => {
    expect(() => functionThatThrows()).toThrow('File not found')
  })

  it('should include error cause', () => {
    try {
      functionThatThrows()
    } catch (error) {
      expect(error).toBeInstanceOf(CustomError)
      expect(error.cause).toBeDefined()
    }
  })
})
```

### Async Testing Pattern

```typescript
describe('async operations', () => {
  it('should resolve successfully', async () => {
    const result = await asyncFunction()
    expect(result).toBe('expected')
  })

  it('should reject on error', async () => {
    await expect(asyncFunctionWithError()).rejects.toThrow('Error message')
  })

  it('should timeout after delay', async () => {
    const result = await Promise.race([
      asyncFunction(),
      sleep(5000).then(() => ({ timedOut: true })),
    ])
    expect(result).not.toHaveProperty('timedOut')
  })
})
```

---

## Anti-Patterns

### 1. Testing Implementation Details

```typescript
// ❌ BAD: Tests internal implementation
it('should call method twice', () => {
  const spy = spyOn(obj, 'method')
  doSomething(obj)
  expect(spy).toHaveBeenCalledTimes(2)
})

// ✅ GOOD: Tests observable behavior
it('should return result with both values processed', () => {
  const result = doSomething(obj)
  expect(result.processedItems).toHaveLength(2)
})
```

### 2. Brittle Snapshot Tests

```typescript
// ❌ BAD: Large snapshot
it('should return config object', () => {
  expect(loadConfig()).toMatchSnapshot()
  // 50 lines of snapshot data
})

// ✅ GOOD: Focused assertions
it('should return config with required fields', () => {
  const config = loadConfig()
  expect(config).toHaveProperty('apiKey')
  expect(config).toHaveProperty('endpoint')
  expect(config.apiKey).toMatch(/^sk_/)
})
```

### 3. Test Interdependence

```typescript
// ❌ BAD: Tests depend on order
let sharedCounter = 0

it('first test', () => {
  sharedCounter++
  expect(sharedCounter).toBe(1)
})

it('second test', () => {
  sharedCounter++
  expect(sharedCounter).toBe(2) // Fails if run alone
})

// ✅ GOOD: Independent tests
it('should increment counter', () => {
  const counter = new Counter()
  counter.increment()
  expect(counter.value).toBe(1)
})
```

### 4. Silent Cleanup Failures

```typescript
// ❌ BAD: Silent cleanup
afterEach(() => {
  try {
    cleanup()
  } catch {
    // Swallows errors
  }
})

// ✅ GOOD: Log cleanup failures
afterEach(() => {
  try {
    cleanup()
  } catch (error) {
    console.error('Cleanup failed:', error)
    throw error // Re-throw to fail the test
  }
})
```

### 5. Excessive Mocking

```typescript
// ❌ BAD: Mocking everything
const mockContext = {
  tools: {
    tool1: mock(),
    tool2: mock(),
    tool3: mock(),
    // ... 20 more mocks
  },
  logger: {
    debug: mock(),
    info: mock(),
    warn: mock(),
    error: mock(),
  },
  // ... 30 more properties
}

// ✅ GOOD: Use test fixtures
const context = createTestContext() // Reusable fixture
```

---

## Coverage Requirements

### Minimum Coverage Targets

| File Type | Line Coverage | Function Coverage |
|-----------|--------------|-------------------|
| **Core Business Logic** | 90%+ | 90%+ |
| **Tools** | 85%+ | 85%+ |
| **Workflows** | 80%+ | 80%+ |
| **Utilities** | 80%+ | 80%+ |
| **Configuration** | 70%+ | 70%+ |

### Critical Paths

All critical paths must have 100% coverage:
- Authentication/authorization
- Error handling
- Data validation
- External API integrations
- File system operations
- Database operations

### Viewing Coverage

```bash
# Generate coverage report
bun test:coverage

# Generate HTML report for detailed analysis
bun test:coverage:html
open coverage/index.html
```

---

## Running Tests

### Basic Commands

```bash
# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Run tests with coverage
bun test:coverage

# Run specific test file
bun test path/to/test.test.ts

# Run tests matching pattern
bun test --test-name-pattern="should update"
```

### Debugging Tests

```bash
# Run with verbose output
bun test --verbose

# Run only tests matching pattern
bun test -t "specific test name"

# Run tests in specific file (useful for debugging)
bun test packages/cli/src/tools/tool.test.ts
```

### CI/CD Integration

Tests run automatically in CI. Ensure:
- All tests pass before pushing
- Coverage doesn't decrease
- No tests are skipped

---

## References

- **Test Fixtures**: `packages/cli/src/agent/test-fixtures.ts`
- **Phase 4 Plan**: `plans/phase4-coverage-and-tooling.md`
- **Test Review Plan**: `plans/test-review-plan.md`
- **Testing Best Practices**: See `docs/TESTING_GUIDELINES.md`

---

**Questions?** Refer to the test files in `packages/cli/src/agent/*.test.ts` for examples of good test patterns.
