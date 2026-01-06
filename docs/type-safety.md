# Type Safety Guidelines

This document outlines the type safety practices for the polka-codes project, including when and where `any` types are acceptable.

## General Philosophy

The polka-codes project prioritizes type safety while maintaining pragmatism. We use TypeScript to catch errors at compile time, but recognize that there are scenarios where `any` is necessary or acceptable.

## Acceptable `any` Usage

The following scenarios are acceptable places to use `any` types:

### 1. Logger Rest Parameters ✅

Logger interfaces need to accept arbitrary types for formatting:

```typescript
interface Logger {
  debug: (...args: any[]) => void
  info: (message: string, ...args: any[]) => void
  warn: (message: string, ...args: any[]) => void
  error: (message: string, ...args: any[]) => void
}
```

**Rationale**: Logging functions need to accept any type of data for debugging purposes. The values are converted to strings and not used in type-safe ways.

### 2. Debug/Trace Logging ✅

Debug logging interfaces that accept arbitrary data for inspection:

```typescript
interface DebugLogger {
  basic(category: DebugCategory, message: string, data?: any): void
  verbose(category: DebugCategory, message: string, data?: any): void
  trace(category: DebugCategory, message: string, data?: any): void
  enter(category: DebugCategory, fnName: string, args?: any): void
  exit(category: DebugCategory, fnName: string, result?: any): void
}
```

**Rationale**: Debug logging needs to capture arbitrary state for troubleshooting. Type safety is less critical here than the ability to inspect runtime values.

### 3. Test Code and Fixtures ✅

Test mocks, fixtures, and test utilities:

```typescript
// test-fixtures.ts
// Mock objects with `as any` for flexibility in testing
const mockTool = { handler: (...args: any[]) => {} } as any
```

**Rationale**: Test code often needs flexibility that production code doesn't. Changing tests to be overly strict can make them brittle.

### 4. External Provider Metadata ✅

External API provider metadata types:

```typescript
interface UsageEvent {
  providerMetadata?: any  // From AI SDK, shape varies by provider
}
```

**Rationale**: Provider metadata comes from external APIs (OpenAI, Anthropic, etc.) and varies by provider. We don't control these types.

### 5. Auto-generated Types ✅

Types generated from external schemas (GraphQL, JSON Schema, etc.):

```typescript
// Auto-generated from GraphQL schema - do not modify
interface GitHubGraphQLTypes { /* ... */ }
```

**Rationale**: These types are generated from external schemas and would be overwritten on regeneration.

### 6. Circular Type Dependencies ✅

When necessary to break circular type references:

```typescript
// Using `as unknown as` to break circular dependency in Zod schemas
export const WhileLoopStepSchema = z.object({
  /* ... */
}) as unknown as z.ZodType<WhileLoopStep>
```

**Rationale**: TypeScript's type system has limitations with circular references. The `as unknown as` pattern is a documented workaround.

### 7. Dynamic Workflow Execution ✅

Dynamic input/output objects in workflow execution:

```typescript
function evaluateValue(expr: string, input: Record<string, unknown>, state: Record<string, unknown>): unknown
```

**Rationale**: Workflows are dynamically defined and executed. We use `unknown` (not `any`) for type safety while maintaining flexibility.

### 8. CLI Boundaries ✅

CLI input/output boundaries where data comes from external sources:

```typescript
// User input or file parsing - validate before use
const parsedConfig: Partial<Config> = YAML.parse(userInput)
```

**Rationale**: Data from external sources (CLI args, files, APIs) needs runtime validation regardless of compile-time types.

## Unacceptable `any` Usage

The following scenarios should **NOT** use `any`:

### ❌ Function Parameters (unless logging/debug)

Instead of:

```typescript
function process(data: any) {
  return data.value
}
```

Use:

```typescript
function process(data: { value: string }) {
  return data.value
}

// Or with generics
function process<T extends { value: string }>(data: T): string {
  return data.value
}
```

### ❌ Return Types

Instead of:

```typescript
function getData(): any {
  return { value: 'test' }
}
```

Use:

```typescript
function getData(): { value: string } {
  return { value: 'test' }
}
```

### ❌ Type Assertions (unless necessary)

Instead of:

```typescript
const value = data as any
```

Use:

```typescript
const value = data as ExpectedType

// Or better, use a type guard
function isExpectedType(value: unknown): value is ExpectedType {
  return typeof value === 'object' && value !== null && 'expectedProp' in value
}

if (isExpectedType(data)) {
  // TypeScript knows data is ExpectedType here
}
```

### ❌ Object Properties (unless logging/debug)

Instead of:

```typescript
interface Config {
  metadata: any
}
```

Use:

```typescript
interface Config {
  metadata: Record<string, unknown>
}

// Or better, define the structure
interface Config {
  metadata: Metadata
}
```

## Migration Guide

When eliminating `any` types, follow these steps:

### 1. Replace with `unknown`

If the type is truly unknown, use `unknown` instead of `any`:

```typescript
// Before
function process(data: any) {
  if (typeof data === 'string') {
    console.log(data)
  }
}

// After
function process(data: unknown) {
  if (typeof data === 'string') {
    console.log(data)
  }
}
```

### 2. Add Type Guards

Use type guards to narrow unknown types:

```typescript
function isString(value: unknown): value is string {
  return typeof value === 'string'
}

function process(data: unknown) {
  if (isString(data)) {
    console.log(data.toUpperCase())  // TypeScript knows it's a string
  }
}
```

### 3. Use Generics

For reusable functions, use generics with constraints:

```typescript
// Before
function first(array: any[]): any {
  return array[0]
}

// After
function first<T>(array: T[]): T | undefined {
  return array[0]
}
```

### 4. Define Proper Types

For known structures, define interfaces or types:

```typescript
// Before
interface User {
  data: any
}

// After
interface UserData {
  id: string
  name: string
  email: string
}

interface User {
  data: UserData
}
```

## Linting Rules

The project uses Biome for linting. Current configuration in `biome.jsonc`:

```json
{
  "linter": {
    "rules": {
      "suspicious": {
        "noExplicitAny": "off"  // Currently off, but consider enabling as "warn"
      }
    }
  }
}
```

**Note**: We currently keep `noExplicitAny` off because:
1. Logger interfaces require `any[]` for rest parameters
2. Test code benefits from flexibility
3. Some external types (provider metadata) are out of our control

**Recommendation**: When reviewing code, consider whether `any` is truly necessary or if a more specific type could be used.

## Summary

- ✅ **Use `any` for**: Logger params, debug logging, test mocks, external types, circular refs
- ❌ **Don't use `any` for**: Function parameters, return types, object properties (with exceptions)
- 🔄 **Prefer**: `unknown`, type guards, generics, proper types

For questions or clarification, refer to this document or the [elimination plan](../plans/eliminate-any-types.md).
