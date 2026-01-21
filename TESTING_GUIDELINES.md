# Testing Guidelines

**Last Updated**: 2025-01-20
**Status**: Phase 2 - Test Quality Improvements

## Table of Contents

1. [Core Principles](#core-principles)
2. [Test Organization](#test-organization)
3. [Writing Good Tests](#writing-good-tests)
4. [Anti-Patterns to Avoid](#anti-patterns-to-avoid)
5. [Tool-Specific Guidelines](#tool-specific-guidelines)
6. [Examples](#examples)

---

## Core Principles

### 1. Test Behavior, Not Implementation

✅ **DO**: Test observable behavior and interfaces
```typescript
test('should remove file successfully', async () => {
  const result = await removeFile.handler(provider, { path: 'test.txt' })

  expect(result.success).toBe(true)
  expect(result.message.type).toBe('text')
})
```

❌ **DON'T**: Test implementation details
```typescript
test('should call fs.unlink with correct path', () => {
  // Tests internal implementation that may change
  expect(fs.unlink).toHaveBeenCalledWith('test.txt')
})
```

### 2. Use Focused Assertions Over Snapshots

✅ **DO**: Write specific, meaningful assertions
```typescript
test('should parse config correctly', () => {
  const config = loadConfig(configPath)

  expect(config.defaultProvider).toBe('anthropic')
  expect(config.defaultModel).toBe('claude-3-opus')
  expect(config.rules).toContain('rule1')
})
```

❌ **DON'T**: Use generic snapshots for simple objects
```typescript
test('should parse config correctly', () => {
  const config = loadConfig(configPath)
  expect(config).toMatchSnapshot() // Brittle and unclear
})
```

**When Snapshots ARE Acceptable**:
- Integration tests with complex external API responses
- Very large configuration objects where explicit assertions would be verbose
- Output format verification for structured data (markdown, XML, etc.)

### 3. Make Tests Readable and Self-Documenting

✅ **DO**: Use descriptive names and comments
```typescript
test('should merge local config over global config', () => {
  const global = { apiKey: 'global-key' }
  const local = { apiKey: 'local-key' }

  const merged = mergeConfigs(global, local)

  // Local config should override global
  expect(merged.apiKey).toBe('local-key')
})
```

❌ **DON'T**: Use vague names
```typescript
test('merge works', () => {
  // What does this test actually verify?
})
```

---

## Test Organization

### File Structure

```
packages/
  package-name/
    src/
      module.ts
      module.test.ts        # Unit tests for module
      __tests__/           # Integration tests
        feature.test.ts
      fixtures/            # Test data and mocks
        test-data.ts
```

### Test File Structure

```typescript
// 1. Imports
import { describe, expect, test } from 'bun:test'
import { functionToTest } from './module'

// 2. Describe block (logical grouping)
describe('functionToTest', () => {
  // 3. Setup/teardown (if needed)
  let testContext

  beforeEach(() => {
    testContext = setupTestData()
  })

  afterEach(() => {
    cleanup()
  })

  // 4. Tests grouped by scenario
  describe('happy path', () => {
    test('should succeed with valid input', () => {
      // Test implementation
    })
  })

  describe('error cases', () => {
    test('should throw on invalid input', () => {
      // Test implementation
    })
  })

  describe('edge cases', () => {
    test('should handle empty input', () => {
      // Test implementation
    })
  })
})
```

### Naming Conventions

**Test names**: Should follow "should X when Y" pattern
```typescript
✅ test('should return user when ID exists')
✅ test('should throw ValidationError when email is invalid')
✅ test('should handle missing config gracefully')

❌ test('user test')
❌ test('test1')
❌ test('it works')
```

**Describe blocks**: Logical groupings
```typescript
describe('mergeConfig', () => {
  describe('when configs have overlapping keys', () => {
    test('should use value from second config', () => { })
  })

  describe('when configs have different keys', () => {
    test('should merge all keys', () => { })
  })
})
```

---

## Writing Good Tests

### 1. Arrange-Act-Assert Pattern

```typescript
test('should filter completed todos', () => {
  // Arrange: Set up test data
  const todos = [
    { id: '1', status: 'completed' },
    { id: '2', status: 'open' }
  ]
  const provider = createMockProvider(todos)

  // Act: Execute the function
  const result = await listTodoItems.handler(provider, {
    status: 'completed'
  })

  // Assert: Verify expected outcome
  expect(result.message.value).toHaveLength(1)
  expect(result.message.value[0].id).toBe('1')
})
```

### 2. Test One Thing Per Test

✅ **DO**: Focused, single-purpose tests
```typescript
test('should return 404 when user not found', () => { })
test('should return 403 when user lacks permission', () => { })
test('should return user when authenticated', () => { })
```

❌ **DON'T**: Tests that verify multiple unrelated things
```typescript
test('should handle all user scenarios', () => {
  // Tests 404, 403, and success all in one test
})
```

### 3. Use Test Helpers and Fixtures

```typescript
// In test/fixtures.ts
export const createMockConfig = (overrides = {}) => ({
  defaultProvider: 'anthropic',
  defaultModel: 'claude-3-opus',
  ...overrides
})

// In tests
test('should use custom model', () => {
  const config = createMockConfig({
    defaultModel: 'claude-3-haiku'
  })
  // Test with config
})
```

### 4. Avoid Test Interdependence

Each test should be able to run independently:
```typescript
❌ test('should create user', () => {
  createUser('user1')
})

test('should update user', () => {
  // Depends on previous test!
  updateUser('user1', { name: 'Updated' })
})

✅ test('should update existing user', () => {
  const user = createUser('user1')
  const updated = updateUser(user.id, { name: 'Updated' })
  expect(updated.name).toBe('Updated')
})
```

---

## Anti-Patterns to Avoid

### 1. Redundant Type Checking

❌ **DON'T**: Test what TypeScript already validates
```typescript
import { expectTypeOf } from 'vitest'

test('should have correct types', () => {
  expectTypeOf(config).toMatchTypeOf<Config>()
  // TypeScript already validates this at compile time!
})
```

### 2. Testing Private Implementation Details

❌ **DON'T**: Test internal functions or private methods
```typescript
test('should call internal validator', () => {
  // Don't test private methods
  expect(instance.#validateEmail).toHaveBeenCalled()
})
```

✅ **DO**: Test the public interface
```typescript
test('should reject invalid email', () => {
  const result = instance.setEmail('invalid-email')
  expect(result.error).toContain('Invalid email')
})
```

### 3. Brittle Mock Spying

❌ **DON'T**: Over-specify mock call details
```typescript
test('should call API three times', () => {
  // Brittle - implementation might change to 2 calls with batching
  expect(api.call).toHaveBeenCalledTimes(3)
  expect(api.call).toHaveBeenNthCalledWith(1, 'endpoint1', { /*exact match*/ })
  expect(api.call).toHaveBeenNthCalledWith(2, 'endpoint2', { /*exact match*/ })
})
```

✅ **DO**: Verify observable outcomes
```typescript
test('should fetch and process all data', () => {
  const result = await fetchData()
  expect(result.items).toHaveLength(3)
  expect(result.items).toEqual([
    expect.objectContaining({ id: '1' }),
    expect.objectContaining({ id: '2' }),
    expect.objectContaining({ id: '3' })
  ])
})
```

### 4. Hardcoded Test Data

❌ **DON'T**: Repeat hardcoded values
```typescript
test('should parse date', () => {
  expect(parseDate('2025-01-20')).toBe('Jan 20, 2025')
  expect(parseDate('2025-01-21')).toBe('Jan 21, 2025')
  expect(parseDate('2025-01-22')).toBe('Jan 22, 2025')
})
```

✅ **DO**: Use test data builders or parameterized tests
```typescript
const dateCases = [
  ['2025-01-20', 'Jan 20, 2025'],
  ['2025-01-21', 'Jan 21, 2025'],
  ['2025-01-22', 'Jan 22, 2025']
]

test.each(dateCases)('should parse %s', (input, expected) => {
  expect(parseDate(input)).toBe(expected)
})
```

---

## Tool-Specific Guidelines

### Workflow Tests

```typescript
describe('commitWorkflow', () => {
  test('should generate commit message with staged files', async () => {
    const { context, tools } = createWorkflowTestContext()

    // Mock tools
    tools.createCommit = mock().mockResolvedValue({})
    tools.generateText = mock().mockResolvedValue([
      { role: 'assistant', content: JSON.stringify({ commitMessage: 'feat: add feature' }) }
    ])

    // Execute workflow
    await commitWorkflow({ interactive: false, additionalTools: {} }, context)

    // Verify workflow called tools correctly
    expect(tools.createCommit).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'feat: add feature' })
    )
  })
})
```

### Tool Handler Tests

```typescript
describe('removeFile tool', () => {
  test('should return success message on removal', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'removeFile').mockResolvedValue()

    const result = await removeFile.handler(mockProvider, {
      path: 'test.txt'
    })

    expect(result).toEqual({
      success: true,
      message: {
        type: 'text',
        value: expect.stringContaining('test.txt')
      }
    })
  })
})
```

### Configuration Tests

```typescript
describe('ApiProviderConfig', () => {
  test('should merge command config over global config', () => {
    const config = new ApiProviderConfig({
      defaultProvider: 'anthropic',
      commands: {
        task: {
          model: 'claude-3-haiku' // Override default
        }
      }
    })

    const taskConfig = config.getConfigForCommand('task')

    expect(taskConfig?.model).toBe('claude-3-haiku')
  })
})
```

---

## Examples

### Before and After: Snapshot to Focused Assertions

**Before** (brittle, unclear):
```typescript
test('should apply cache control', () => {
  const messages = applyCacheControl(baseMessages, 'anthropic', 'claude-3-sonnet')
  expect(messages).toMatchSnapshot()
})
```

**After** (clear, maintainable):
```typescript
test('should apply cache control for anthropic provider', () => {
  const messages = applyCacheControl(baseMessages, 'anthropic', 'claude-3-sonnet')

  // System message should have cache control
  expect(messages[0].providerOptions?.anthropic).toEqual({
    cacheControl: { type: 'ephemeral' }
  })

  // Last two user messages should have cache control
  expect(messages[3].providerOptions?.anthropic).toEqual({
    cacheControl: { type: 'ephemeral' }
  })
  expect(messages[5].providerOptions?.anthropic).toEqual({
    cacheControl: { type: 'ephemeral' }
  })

  // Other messages should not have cache control
  expect(messages[1].providerOptions).toBeUndefined()
})
```

---

## Running Tests

### Run all tests
```bash
bun test
```

### Run specific package
```bash
bun test packages/cli/src
```

### Run specific file
```bash
bun test packages/cli/src/workflows/commit.workflow.test.ts
```

### Run with coverage
```bash
bun test --coverage
```

---

## Related Documentation

- **Test Review Plan**: `plans/test-review-plan.md`
- **Phase 2 Progress**: `plans/phase2-test-improvements.md`
- **Phase 1 Summary**: `plans/test-improvements-summary.md`

---

## Checklist for New Tests

Before submitting a PR with new tests, verify:

- [ ] Tests follow "should X when Y" naming pattern
- [ ] Each test verifies one behavior
- [ ] Tests use focused assertions instead of snapshots (when appropriate)
- [ ] Tests are independent and can run in any order
- [ ] Tests have clear arrange-act-assert structure
- [ ] Mock assertions verify behavior, not implementation details
- [ ] Test data is organized in fixtures/helpers
- [ ] Error cases are tested alongside happy paths
- [ ] Tests are documented for complex scenarios

---

**Contributors**:
- Test improvements by Claude Code via Happy
- Based on Phase 2 test quality improvements (2025-01-20)
