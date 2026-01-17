import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, rename } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import type { MemoryConfig } from '@polka-codes/core'
import Database from 'better-sqlite3'

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
 * SQLite Memory Store Implementation
 */
export class SQLiteMemoryStore {
  private db: Database.Database | null = null
  private config: MemoryConfig
  private currentScope: string
  private maxRetries = 3
  private retryDelay = 100 // ms

  // Whitelists for validation
  private static readonly SORT_COLUMNS = {
    created: 'created_at',
    updated: 'updated_at',
    accessed: 'last_accessed',
    name: 'name',
  } as const

  private static readonly ALLOWED_SORT_ORDERS = ['asc', 'desc'] as const
  private static readonly ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

  constructor(config: MemoryConfig, cwd: string) {
    this.config = config
    this.currentScope = this.detectProjectScope(cwd)
  }

  /**
   * Initialize database connection and schema
   */
  private async initializeDatabase(): Promise<Database.Database> {
    if (this.db) {
      return this.db
    }

    const dbPath = this.resolvePath(this.config.path || '~/.config/polka-codes/memory.sqlite')

    try {
      // Create directory if needed
      const dir = dirname(dbPath)
      if (!existsSync(dir)) {
        await mkdir(dir, { recursive: true, mode: 0o700 })
      }

      // Create database with secure permissions if it doesn't exist
      if (!existsSync(dbPath)) {
        const { openSync, closeSync } = await import('node:fs')
        const fd = openSync(dbPath, 'w')
        closeSync(fd)
        // Set permissions to owner read/write only
        await import('node:fs/promises').then((fs) => fs.chmod(dbPath, 0o600))
      }

      // Open database
      const db = new Database(dbPath, {
        verbose: process.env.SQLITE_DEBUG ? console.log : undefined,
      })

      // Configure pragmas
      this.configurePragmas(db)

      // Check integrity
      this.checkIntegrity(db)

      // Initialize schema
      this.initializeSchema(db)

      this.db = db
      return db
    } catch (error) {
      console.error('[SQLiteMemoryStore] Initialization failed:', error)

      // Recovery: backup corrupted database
      if (existsSync(dbPath)) {
        const backupPath = `${dbPath}.corrupted.${Date.now()}`
        console.warn(`[SQLiteMemoryStore] Backing up corrupted database to: ${backupPath}`)
        try {
          await rename(dbPath, backupPath)
        } catch (backupError) {
          console.error('[SQLiteMemoryStore] Failed to backup corrupted database:', backupError)
        }

        // Retry initialization
        return this.initializeDatabase()
      }

      throw error
    }
  }

  /**
   * Configure database pragmas
   */
  private configurePragmas(db: Database.Database): void {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = NORMAL')
    db.pragma('busy_timeout = 5000')
    db.pragma('foreign_keys = ON')
    db.pragma('temp_store = MEMORY')
    db.pragma('mmap_size = 30000000000')
    db.pragma('page_size = 4096')
  }

  /**
   * Check database integrity
   */
  private checkIntegrity(db: Database.Database): void {
    try {
      const result = db.pragma('integrity_check', { simple: true }) as string
      if (result !== 'ok') {
        throw new Error(`Database integrity check failed: ${result}`)
      }
    } catch (error) {
      console.error('[SQLiteMemoryStore] Integrity check failed:', error)
      throw new Error('Database is corrupted')
    }
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(db: Database.Database): void {
    // Create memory entries table
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK(length(name) > 0),
        scope TEXT NOT NULL CHECK(scope IN ('global') OR scope LIKE 'project:%'),
        content TEXT NOT NULL CHECK(length(content) > 0),
        entry_type TEXT NOT NULL CHECK(length(entry_type) > 0),
        status TEXT CHECK(status IS NULL OR length(status) > 0),
        priority TEXT CHECK(priority IS NULL OR priority IN ('low', 'medium', 'high', 'critical')),
        tags TEXT CHECK(tags IS NULL OR length(tags) > 0),
        metadata TEXT CHECK(metadata IS NULL OR json_valid(metadata)),
        created_at INTEGER NOT NULL CHECK(created_at > 0),
        updated_at INTEGER NOT NULL CHECK(updated_at > 0),
        last_accessed INTEGER NOT NULL CHECK(last_accessed > 0),
        UNIQUE(name, scope)
      )
    `)

    // Create optimized indexes
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_memory_entries_scope_type ON memory_entries(scope, entry_type);
      CREATE INDEX IF NOT EXISTS idx_memory_entries_updated ON memory_entries(updated_at);
    `)
  }

  /**
   * Get database instance
   */
  private async getDatabase(): Promise<Database.Database> {
    if (!this.db) {
      this.db = await this.initializeDatabase()
    }
    return this.db
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

      // Safety: don't search too high
      if (currentDir.split('/').length < 3) break
    }

    return null
  }

  /**
   * Normalize path for consistent scope
   */
  private normalizePath(path: string): string {
    const normalized = resolve(path).replace(/\/$/, '')
    // Ensure path is within reasonable bounds
    if (normalized.includes('..')) {
      throw new Error(`Path contains parent directory references: ${path}`)
    }
    return normalized
  }

  /**
   * Resolve home directory in path
   */
  private resolvePath(path: string): string {
    if (path.startsWith('~')) {
      const home = process.env.HOME || process.env.USERPROFILE || '.'
      if (home === '.') {
        throw new Error('Cannot resolve home directory')
      }
      const expanded = `${home}${path.slice(1)}`
      // Validate expanded path doesn't escape home directory
      const resolved = resolve(expanded)
      if (!resolved.startsWith(home)) {
        throw new Error(`Path escapes home directory: ${path}`)
      }
      return resolved
    }
    return resolve(path)
  }

  /**
   * Generate UUID v4
   */
  private generateUUID(): string {
    return randomUUID()
  }

  /**
   * Get current timestamp in milliseconds
   */
  private now(): number {
    return Date.now()
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('database is locked') ||
        message.includes('database is busy') ||
        message.includes('sqlite_busy') ||
        message.includes('sqlite_locked')
      )
    }
    return false
  }

  /**
   * Execute transaction with retry logic
   */
  async transaction<T>(callback: () => Promise<T>, options: { timeout?: number; retries?: number } = {}): Promise<T> {
    const db = await this.getDatabase()
    const retries = options.retries ?? this.maxRetries

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        db.exec('BEGIN IMMEDIATE')

        const result = await callback()

        db.exec('COMMIT')
        return result
      } catch (error) {
        try {
          db.exec('ROLLBACK')
        } catch (rollbackError) {
          console.error('[SQLiteMemoryStore] Rollback failed:', rollbackError)
        }

        const isRetryable = this.isRetryableError(error)

        if (isRetryable && attempt < retries - 1) {
          const delay = this.retryDelay * 2 ** attempt
          console.warn(`[SQLiteMemoryStore] Retryable error, retrying in ${delay}ms...`)
          await this.sleep(delay)
          continue
        }

        throw error
      }
    }

    throw new Error('Maximum retries exceeded')
  }

  /**
   * List all memory topics (backward compatible)
   */
  async listMemoryTopics(): Promise<string[]> {
    const db = await this.getDatabase()
    const scope = this.currentScope

    const stmt = db.prepare('SELECT DISTINCT name FROM memory_entries WHERE scope = ?')
    const rows = stmt.all(scope) as { name: string }[]

    return rows.map((row) => row.name)
  }

  /**
   * Read memory by topic (backward compatible)
   */
  async readMemory(topic?: string): Promise<string | undefined> {
    const db = await this.getDatabase()
    const name = topic || ':default:'
    const scope = this.currentScope

    return this.transaction(async () => {
      const stmt = db.prepare('SELECT content FROM memory_entries WHERE name = ? AND scope = ?')
      const row = stmt.get(name, scope) as { content: string } | undefined

      if (row) {
        // Update last_accessed
        const updateStmt = db.prepare('UPDATE memory_entries SET last_accessed = ? WHERE name = ? AND scope = ?')
        updateStmt.run(this.now(), name, scope)
      }

      return row?.content
    })
  }

  /**
   * Update memory (backward compatible)
   */
  async updateMemory(
    operation: 'append' | 'replace' | 'remove',
    topic: string | undefined,
    content: string | undefined,
    metadata?: {
      entry_type?: string
      status?: string
      priority?: string
      tags?: string
    },
  ): Promise<void> {
    return this.transaction(async () => {
      const db = this.getDatabase()
      const name = topic || ':default:'
      const scope = this.currentScope
      const now = this.now()

      if (operation === 'remove') {
        const stmt = db.prepare('DELETE FROM memory_entries WHERE name = ? AND scope = ?')
        stmt.run(name, scope)
        return
      }

      const existingStmt = db.prepare('SELECT content, entry_type, status, priority, tags FROM memory_entries WHERE name = ? AND scope = ?')
      const existing = existingStmt.get(name, scope) as
        | { content: string; entry_type: string; status: string; priority: string; tags: string }
        | undefined

      let finalContent: string
      let entry_type: string
      let status: string | undefined
      let priority: string | undefined
      let tags: string | undefined

      if (existing) {
        if (operation === 'append') {
          if (!content) {
            throw new Error('Content is required for append operation.')
          }
          finalContent = `${existing.content}\n${content}`
        } else {
          if (!content) {
            throw new Error('Content is required for replace operation.')
          }
          finalContent = content
        }
        entry_type = metadata?.entry_type || existing.entry_type
        status = metadata?.status || existing.status
        priority = metadata?.priority || existing.priority
        tags = metadata?.tags || existing.tags
      } else {
        if (!content) {
          throw new Error('Content is required for new memory entries.')
        }
        finalContent = operation === 'replace' ? content : content
        entry_type = metadata?.entry_type || 'note'
        status = metadata?.status
        priority = metadata?.priority
        tags = metadata?.tags
      }

      const upsertStmt = db.prepare(`
        INSERT INTO memory_entries (id, name, scope, content, entry_type, status, priority, tags, created_at, updated_at, last_accessed)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(name, scope) DO UPDATE SET
          content = excluded.content,
          entry_type = excluded.entry_type,
          status = excluded.status,
          priority = excluded.priority,
          tags = excluded.tags,
          updated_at = excluded.updated_at,
          last_accessed = excluded.last_accessed
      `)

      upsertStmt.run(
        this.generateUUID(),
        name,
        scope,
        finalContent,
        entry_type,
        status || null,
        priority || null,
        tags || null,
        existing ? undefined : now,
        now,
        now,
      )
    })
  }

  /**
   * Query memory with filters
   */
  async queryMemory(query: MemoryQuery = {}, options: QueryOptions = {}): Promise<MemoryEntry[] | number> {
    const db = await this.getDatabase()

    // Apply default safety limit if not specified
    if (!options.operation && !query.limit) {
      query = { ...query, limit: 1000 }
    }

    const { sql, params } = this.buildQuery(query, options)

    if (options.operation === 'count') {
      const countStmt = db.prepare(`SELECT COUNT(*) as count FROM (${sql})`)
      const result = countStmt.get(...params) as { count: number }
      return result.count
    }

    if (options.operation === 'delete') {
      const deleteStmt = db.prepare(`DELETE FROM memory_entries WHERE id IN (SELECT id FROM (${sql}))`)
      const info = deleteStmt.run(...params)
      return info.changes
    }

    const stmt = db.prepare(sql)
    return stmt.all(...params) as MemoryEntry[]
  }

  /**
   * Build SQL query safely with parameterized statements
   */
  private buildQuery(
    query: MemoryQuery,
    _options: QueryOptions,
  ): {
    sql: string
    params: (string | number)[]
  } {
    const conditions: string[] = []
    const params: (string | number)[] = []
    let sql = 'SELECT * FROM memory_entries WHERE 1=1'

    // Scope handling
    const scope = query.scope === 'auto' ? this.currentScope : query.scope
    if (scope === 'global') {
      conditions.push('scope = ?')
      params.push('global')
    } else if (scope === 'project' || (!scope && this.currentScope !== 'global')) {
      conditions.push('scope = ?')
      params.push(this.currentScope)
    }

    // Type filter
    if (query.type) {
      if (!query.type.trim()) {
        throw new Error('Type cannot be empty')
      }
      conditions.push('entry_type = ?')
      params.push(query.type.trim())
    }

    // Status filter
    if (query.status) {
      conditions.push('status = ?')
      params.push(query.status)
    }

    // Priority filter
    if (query.priority) {
      if (!SQLiteMemoryStore.ALLOWED_PRIORITIES.includes(query.priority as any)) {
        throw new Error(`Invalid priority: ${query.priority}`)
      }
      conditions.push('priority = ?')
      params.push(query.priority)
    }

    // Tags filter
    if (query.tags) {
      const tags = Array.isArray(query.tags) ? query.tags : [query.tags]
      for (const tag of tags) {
        if (!tag.trim()) {
          throw new Error('Tags cannot be empty')
        }
        const sanitized = tag.trim().replace(/[^\w-]/g, '')
        if (sanitized.length === 0) {
          throw new Error(`Invalid tag: ${tag}`)
        }
        conditions.push('tags LIKE ?')
        params.push(`%${sanitized}%`)
      }
    }

    // Search filter
    if (query.search) {
      const searchTerm = query.search.trim()
      const sanitized = searchTerm.replace(/[\\_%]/g, '\\$&')
      conditions.push('(content LIKE ? OR name LIKE ?)')
      params.push(`%${sanitized}%`, `%${sanitized}%`)
    }

    // Date range filters
    if (query.createdAfter) {
      conditions.push('created_at >= ?')
      params.push(query.createdAfter)
    }
    if (query.createdBefore) {
      conditions.push('created_at <= ?')
      params.push(query.createdBefore)
    }
    if (query.updatedAfter) {
      conditions.push('updated_at >= ?')
      params.push(query.updatedAfter)
    }
    if (query.updatedBefore) {
      conditions.push('updated_at <= ?')
      params.push(query.updatedBefore)
    }

    // Build WHERE clause
    if (conditions.length > 0) {
      sql += ` AND ${conditions.join(' AND ')}`
    }

    // Sorting
    if (query.sortBy) {
      const column = SQLiteMemoryStore.SORT_COLUMNS[query.sortBy]
      if (!column) {
        throw new Error(`Invalid sortBy: ${query.sortBy}`)
      }
      const order = query.sortOrder || 'desc'
      if (!SQLiteMemoryStore.ALLOWED_SORT_ORDERS.includes(order)) {
        throw new Error(`Invalid sortOrder: ${order}`)
      }
      sql += ` ORDER BY ${column} ${order.toUpperCase()}`
    }

    // Pagination
    if (query.limit) {
      const limit = Number(query.limit)
      if (Number.isNaN(limit) || limit < 1 || limit > 10000) {
        throw new Error('Limit must be between 1 and 10000')
      }
      sql += ' LIMIT ?'
      params.push(limit)

      if (query.offset) {
        const offset = Number(query.offset)
        if (Number.isNaN(offset) || offset < 0) {
          throw new Error('Offset must be >= 0')
        }
        sql += ' OFFSET ?'
        params.push(offset)
      }
    }

    return { sql, params }
  }

  /**
   * Batch update memory
   */
  async batchUpdateMemory(operations: MemoryOperation[]): Promise<void> {
    return this.transaction(async () => {
      for (const op of operations) {
        await this.updateMemory(op.operation, op.name, op.content, op.metadata)
      }
    })
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    totalEntries: number
    entriesByType: Record<string, number>
    databaseSize: number
  }> {
    const db = await this.getDatabase()

    const countStmt = db.prepare('SELECT COUNT(*) as count FROM memory_entries')
    const { count: totalEntries } = countStmt.get() as { count: number }

    const typeStmt = db.prepare('SELECT entry_type, COUNT(*) as count FROM memory_entries GROUP BY entry_type')
    const typeRows = typeStmt.all() as { entry_type: string; count: number }[]
    const entriesByType = Object.fromEntries(typeRows.map((r) => [r.entry_type, r.count]))

    // Get database file size
    const dbPath = this.resolvePath(this.config.path || '~/.config/polka-codes/memory.sqlite')
    let databaseSize = 0
    try {
      const stats = await import('node:fs/promises').then((fs) => fs.stat(dbPath))
      databaseSize = stats.size
    } catch {
      // File might not exist yet
    }

    return {
      totalEntries,
      entriesByType,
      databaseSize,
    }
  }
}
