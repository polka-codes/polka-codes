/**
 * Memory entry types
 */
export type MemoryEntry = {
  id: string
  name: string
  scope: string // 'global' or 'project:/absolute/path'
  content: string
  entry_type: string
  status?: string
  priority?: 'low' | 'medium' | 'high' | 'critical'
  tags?: string
  metadata?: string // JSON string
  created_at: number
  updated_at: number
  last_accessed: number
}

/**
 * Memory query filters
 */
export type MemoryQuery = {
  scope?: 'global' | 'project' | 'auto'
  type?: string
  status?: string
  priority?: string
  tags?: string | string[]
  search?: string
  limit?: number
  offset?: number
  sortBy?: 'created' | 'updated' | 'accessed' | 'name'
  sortOrder?: 'asc' | 'desc'
  createdAfter?: number
  createdBefore?: number
  updatedAfter?: number
  updatedBefore?: number
}

/**
 * Query options
 */
export type QueryOptions = {
  operation?: 'select' | 'delete' | 'count'
  includeMetadata?: boolean
}

/**
 * Memory operation for batch updates
 */
export type MemoryOperation = {
  operation: 'append' | 'replace' | 'remove'
  name: string
  content?: string
  metadata?: {
    entry_type?: string
    status?: string
    priority?: string
    tags?: string
    metadata?: string
  }
}

/**
 * Database statistics
 */
export type DatabaseStats = {
  totalEntries: number
  entriesByType: Record<string, number>
  databaseSize: number
}

/**
 * Memory Store Interface
 *
 * This interface defines the contract for memory store implementations.
 * Implementations can use different storage backends (SQLite, PostgreSQL, Redis, etc.)
 * while maintaining the same API for the core memory logic.
 */
export interface IMemoryStore {
  /**
   * Read memory by topic name
   *
   * @param topic - The topic name
   * @returns The content, or undefined if not found
   */
  readMemory(topic: string): Promise<string | undefined>

  /**
   * Update memory with operation
   *
   * @param operation - The operation to perform ('append', 'replace', 'remove')
   * @param topic - The topic name
   * @param content - The content (required for append/replace)
   * @param metadata - Optional metadata (entry_type, status, priority, tags)
   */
  updateMemory(
    operation: 'append' | 'replace' | 'remove',
    topic: string,
    content: string | undefined,
    metadata?: {
      entry_type?: string
      status?: string
      priority?: string
      tags?: string
    },
  ): Promise<void>

  /**
   * Query memory with filters
   *
   * @param query - The query filters
   * @param options - Query options (operation, includeMetadata)
   * @returns Array of entries or count
   */
  queryMemory(query: MemoryQuery, options?: QueryOptions): Promise<MemoryEntry[] | number>

  /**
   * Batch update memory
   *
   * @param operations - Array of memory operations
   */
  batchUpdateMemory(operations: MemoryOperation[]): Promise<void>

  /**
   * Get database statistics
   *
   * @returns Database statistics
   */
  getStats(): Promise<DatabaseStats>

  /**
   * Close the memory store and release resources
   */
  close(): void
}

/**
 * Memory Store Configuration
 */
export type MemoryStoreConfig = {
  enabled: boolean
  type: 'sqlite' | 'memory' | string // Allow extensibility for other types
  path?: string
  [key: string]: any // Allow additional config for specific implementations
}
