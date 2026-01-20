import type { DatabaseStats, IMemoryStore, MemoryEntry, MemoryOperation, MemoryQuery, QueryOptions } from '@polka-codes/core'

/**
 * Memory Manager
 *
 * This class provides core memory management logic that is independent
 * of the storage backend. It implements the IMemoryStore interface and
 * delegates storage operations to the provided store implementation.
 *
 * This allows the same business logic to be used with different storage
 * backends (SQLite, PostgreSQL, Redis, etc.)
 */
export class MemoryManager implements IMemoryStore {
  private store: IMemoryStore

  constructor(store: IMemoryStore) {
    this.store = store
  }

  /**
   * Read memory by topic name
   */
  async readMemory(topic: string): Promise<string | undefined> {
    return this.store.readMemory(topic)
  }

  /**
   * Update memory with operation
   */
  async updateMemory(
    operation: 'append' | 'replace' | 'remove',
    topic: string,
    content: string | undefined,
    metadata?: {
      entry_type?: string
      status?: string
      priority?: string
      tags?: string
      created_at?: number
      updated_at?: number
      last_accessed?: number
    },
  ): Promise<void> {
    return this.store.updateMemory(operation, topic, content, metadata)
  }

  /**
   * Query memory with filters
   */
  async queryMemory(query: MemoryQuery = {}, options?: QueryOptions): Promise<MemoryEntry[] | number> {
    // Apply default safety limit if not specified
    const finalQuery: MemoryQuery = {
      ...query,
    }
    // Only apply default limit for select operations, and if no explicit limit is set
    // Skip for count, delete operations or when limit is explicitly set
    const operation = options?.operation
    if ((operation === 'select' || !operation) && !finalQuery.limit) {
      finalQuery.limit = 1000
    }

    return this.store.queryMemory(finalQuery, options)
  }

  /**
   * Batch update memory
   */
  async batchUpdateMemory(operations: MemoryOperation[]): Promise<void> {
    return this.store.batchUpdateMemory(operations)
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    return this.store.getStats()
  }

  /**
   * Close the memory store
   */
  async close(): Promise<void> {
    await this.store.close()
  }

  /**
   * Execute a transaction
   * Exposes the underlying store's transaction method if available
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Check if the underlying store supports transactions
    const storeWithTransaction = this.store as { transaction?: (callback: () => Promise<T>) => Promise<T> }
    if (typeof storeWithTransaction.transaction === 'function') {
      return storeWithTransaction.transaction(callback)
    }
    // If no transaction support, run the callback directly
    return callback()
  }
}
