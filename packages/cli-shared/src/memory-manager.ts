import { existsSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
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
  private currentScope: string

  constructor(store: IMemoryStore, cwd: string) {
    this.store = store
    this.currentScope = this.detectProjectScope(cwd)
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
    },
  ): Promise<void> {
    return this.store.updateMemory(operation, topic, content, metadata)
  }

  /**
   * Query memory with filters
   */
  async queryMemory(query: MemoryQuery = {}, options?: QueryOptions): Promise<MemoryEntry[] | number> {
    // Auto-detect scope if not specified
    const finalQuery: MemoryQuery = {
      ...query,
      scope: query.scope === 'auto' ? (this.currentScope as any) : query.scope,
    }

    // Apply default safety limit if not specified
    if (!options?.operation && !finalQuery.limit) {
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
  close(): void {
    this.store.close()
  }

  /**
   * Detect project scope from current working directory
   */
  private detectProjectScope(cwd: string): string {
    const projectPath = this.findProjectRoot(cwd)

    if (!projectPath) {
      return 'global'
    }

    const normalizedPath = this.normalizePath(projectPath)
    return `project:${normalizedPath}`
  }

  /**
   * Find project root (directory with .polkacodes.yml)
   */
  private findProjectRoot(cwd: string): string | null {
    let currentDir = resolve(cwd)

    while (currentDir !== '/') {
      const configPath = join(currentDir, '.polkacodes.yml')

      if (existsSync(configPath)) {
        return currentDir
      }

      const parentDir = dirname(currentDir)
      if (parentDir === currentDir) break
      currentDir = parentDir

      // Safety: don't search too high (count path components)
      if (currentDir.split(sep).length < 3) break
    }

    return null
  }

  /**
   * Normalize path for consistent scope
   */
  private normalizePath(path: string): string {
    const { resolve } = require('node:path')
    const normalized = resolve(path).replace(/\/$/, '')

    // Ensure path is within reasonable bounds
    if (normalized.includes('..')) {
      throw new Error(`Path contains parent directory references: ${path}`)
    }

    return normalized
  }
}
