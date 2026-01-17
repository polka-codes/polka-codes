# Memory Store Architecture

## Overview

The memory store has been refactored to separate core business logic from storage implementation, enabling reuse across different environments (CLI, cloud services, etc.) with different database backends.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Layer                        │
│                   (CLI Commands, Tools)                       │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                   MemoryManager                              │
│              (Core Business Logic)                           │
│  • Project scope detection                                   │
│  • Query building & filtering                                │
│  • Default safety limits                                     │
│  • IMemoryStore interface delegation                         │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ implements
                         │
┌────────────────────────▼────────────────────────────────────┐
│                  IMemoryStore Interface                      │
│              (Core Package - @polka-codes/core)             │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│   SQLite     │ │ PostgreSQL   │ │   MongoDB    │
│ MemoryStore  │ │ MemoryStore  │ │ MemoryStore  │
│              │ │              │ │              │
│ (CLI env)    │ │ (Cloud env)  │ │ (Cloud env)  │
└──────────────┘ └──────────────┘ └──────────────┘
```

## Components

### 1. IMemoryStore Interface (Core Package)

**Location:** `packages/core/src/memory/types.ts`

Defines the contract that all memory store implementations must follow:

```typescript
interface IMemoryStore {
  readMemory(topic?: string): Promise<string | undefined>
  updateMemory(operation, topic, content, metadata?): Promise<void>
  queryMemory(query, options?): Promise<MemoryEntry[] | number>
  batchUpdateMemory(operations): Promise<void>
  getStats(): Promise<DatabaseStats>
  listMemoryTopics(): Promise<string[]>
  close(): void
}
```

**Key Types:**
- `MemoryEntry` - Structure of a memory entry
- `MemoryQuery` - Query filters and options
- `QueryOptions` - Operation type (select, delete, count)
- `MemoryOperation` - Batch update operation
- `DatabaseStats` - Database statistics
- `MemoryStoreConfig` - Configuration type

### 2. MemoryManager (CLI Shared Package)

**Location:** `packages/cli-shared/src/memory-manager.ts`

Contains core business logic that is independent of storage:

**Responsibilities:**
- Project scope detection (finds `.polkacodes.yml`)
- Path normalization and validation
- Query building with auto-scope detection
- Default safety limits (1000 entry default)
- Delegates storage operations to IMemoryStore implementation

**Usage:**
```typescript
const sqliteStore = new SQLiteMemoryStore(config, cwd)
const manager = new MemoryManager(sqliteStore, cwd)
await manager.queryMemory({ type: 'todo', status: 'open' })
```

### 3. SQLiteMemoryStore (CLI Shared Package)

**Location:** `packages/cli-shared/src/sqlite-memory-store.ts`

Concrete implementation of IMemoryStore using SQLite:

**Responsibilities:**
- SQLite database connection management
- Schema initialization and migrations
- Transaction management with retry logic
- SQL query building and execution
- Database integrity checking
- Corruption recovery

**Features:**
- WAL mode for concurrent access
- Parameterized queries (SQL injection prevention)
- Optimized indexes (only 2 for performance)
- Secure file permissions (0600)
- Automatic backup on corruption

## Implementation Guide

### Creating a Cloud Database Implementation

To use the memory store in a cloud service with a different database:

#### Step 1: Implement IMemoryStore

```typescript
// packages/cloud/src/postgres-memory-store.ts
import type { IMemoryStore, MemoryEntry, MemoryQuery, QueryOptions } from '@polka-codes/core'
import { Pool } from 'pg'

export class PostgreSQLMemoryStore implements IMemoryStore {
  private pool: Pool

  constructor(config: { connectionString: string }) {
    this.pool = new Pool({ connectionString: config.connectionString })
  }

  async readMemory(topic?: string): Promise<string | undefined> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        'SELECT content FROM memory_entries WHERE name = $1',
        [topic || ':default:']
      )
      return result.rows[0]?.content
    } finally {
      client.release()
    }
  }

  async updateMemory(operation, topic, content, metadata?): Promise<void> {
    // Implement using PostgreSQL UPSERT
  }

  async queryMemory(query: MemoryQuery, options?: QueryOptions): Promise<MemoryEntry[] | number> {
    // Implement query building for PostgreSQL
  }

  // ... implement other methods
}
```

#### Step 2: Use with MemoryManager

```typescript
import { MemoryManager } from '@polka-codes/cli-shared'
import { PostgreSQLMemoryStore } from '@polka-codes/cloud'

// Create store instance
const pgStore = new PostgreSQLMemoryStore({
  connectionString: process.env.DATABASE_URL
})

// Wrap with manager for core logic
const manager = new MemoryManager(pgStore, process.cwd())

// Use same API as CLI
await manager.updateMemory('replace', 'my-todo', 'Implement feature X', {
  entry_type: 'todo',
  status: 'open',
  priority: 'high'
})
```

## Benefits

### 1. Cloud Compatibility
Core business logic can be reused across environments:
- CLI: Uses SQLiteMemoryStore
- Cloud: Uses PostgreSQLMemoryStore, MongoDBMemoryStore, etc.
- Testing: Uses MockMemoryStore

### 2. Testability
IMemoryStore interface can be easily mocked:

```typescript
class MockMemoryStore implements IMemoryStore {
  async readMemory(topic?: string): Promise<string | undefined> {
    return `Mock content for ${topic}`
  }
  // ... other methods
}

const manager = new MemoryManager(new MockMemoryStore(), cwd)
```

### 3. Extensibility
Easy to add new storage backends:

```typescript
class RedisMemoryStore implements IMemoryStore { /* ... */ }
class MongoDBMemoryStore implements IMemoryStore { /* ... */ }
class DynamoDBMemoryStore implements IMemoryStore { /* ... */ }
```

### 4. Separation of Concerns
- **IMemoryStore**: Data access layer
- **MemoryManager**: Business logic layer
- **Commands**: Application layer

Each layer has a single, well-defined responsibility.

### 5. Type Safety
Shared types from `@polka-codes/core` ensure consistency:
- All implementations use same data structures
- Compile-time type checking
- Better IDE support and autocomplete

## Migration Path

### For Existing Code

The refactoring maintains backward compatibility:

**Before:**
```typescript
const store = new SQLiteMemoryStore(config, cwd)
await store.readMemory('topic')
```

**After (CLI):**
```typescript
const store = new SQLiteMemoryStore(config, cwd)
const manager = new MemoryManager(store, cwd)
await manager.readMemory('topic')
```

**After (Cloud):**
```typescript
const pgStore = new PostgreSQLMemoryStore(config)
const manager = new MemoryManager(pgStore, cwd)
await manager.readMemory('topic')
```

### For Cloud Services

1. Copy `MemoryManager` class to your project
2. Implement `IMemoryStore` for your database
3. Use `MemoryManager` wrapper for core logic

## Design Decisions

### Why Interface in Core Package?
- **Single Source of Truth**: Types defined once, used everywhere
- **No Circular Dependencies**: Core doesn't depend on CLI packages
- **Shared Across Packages**: Can be used by CLI, cloud, tests

### Why MemoryManager in CLI Shared?
- **CLI-Specific Logic**: Project detection is CLI-specific
- **Path Operations**: Uses Node.js `path` module
- **Reusability**: Can be used by other CLI tools

### Why Not Abstract Class?
- **Composition over Inheritance**: MemoryManager composes with any IMemoryStore
- **Flexibility**: Can mix-and-match implementations
- **Testing**: Easy to mock interface vs abstract class

## Future Enhancements

### Potential Improvements
1. **Connection Pooling**: Add pooling for cloud databases
2. **Caching Layer**: Add Redis caching layer
3. **Observability**: Add metrics and tracing
4. **Migration System**: Add schema versioning
5. **Multi-tenancy**: Add tenant isolation

### Example: Adding Caching

```typescript
class CachedMemoryStore implements IMemoryStore {
  constructor(
    private primary: IMemoryStore,
    private cache: IMemoryStore
  ) {}

  async readMemory(topic?: string): Promise<string | undefined> {
    // Try cache first
    let content = await this.cache.readMemory(topic)
    if (content) return content

    // Fall back to primary
    content = await this.primary.readMemory(topic)
    await this.cache.updateMemory('replace', topic, content)
    return content
  }
}
```

## Related Documentation

- [Memory Management Guide](./memory.md) - User-facing documentation
- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md) - Technical details
- [Memory Prompts](./MEMORY-PROMPTS.md) - Prompt documentation

---

**Last Updated:** January 2026
**Status:** ✅ Complete and Production-Ready
