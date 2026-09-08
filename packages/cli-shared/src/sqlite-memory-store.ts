import { AsyncLocalStorage } from 'node:async_hooks'
import { randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { DatabaseStats, IMemoryStore, MemoryConfig, MemoryEntry, MemoryOperation, MemoryQuery, QueryOptions } from '@polka-codes/core'
import { DEFAULT_MEMORY_CONFIG, resolveHomePath } from '@polka-codes/core'
import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js'
import { z } from 'zod'

const lockDataSchema = z.object({ pid: z.number().int().positive(), acquiredAt: z.number().positive() })

/**
 * Simple file lock for cross-process synchronization
 * Uses a lockfile with PID and timestamp to prevent concurrent writes
 */
class FileLock {
  private lockfilePath: string
  private static readonly LOCK_TIMEOUT = 30000 // 30 seconds max lock time
  private static readonly CLEANUP_AGE = 600000 // 10 minutes - cleanup old lock files
  private static lastCleanupTime = 0
  private static readonly CLEANUP_THROTTLE = 60000 // Throttle cleanup to once per minute

  constructor(dbPath: string) {
    this.lockfilePath = `${dbPath}.lock`
  }

  /**
   * Reset the cleanup throttle. For testing purposes only.
   */
  static resetCleanupThrottle(): void {
    FileLock.lastCleanupTime = 0
  }

  /**
   * Clean up old lock files (.released.*, .stale.*, .invalid.*, .corrupt.*)
   * Only removes files older than CLEANUP_AGE (10 minutes by default)
   * This method is safe to call multiple times concurrently
   * Cleanup is throttled to run at most once per minute to avoid performance impact
   * @param force - Skip throttling and force cleanup (for testing)
   */
  static async cleanupOldLockFiles(dbPath: string, maxAge = FileLock.CLEANUP_AGE, force = false): Promise<void> {
    // Throttle cleanup to avoid performance impact on high-throughput scenarios
    const now = Date.now()
    if (!force && now - FileLock.lastCleanupTime < FileLock.CLEANUP_THROTTLE) {
      return
    }
    FileLock.lastCleanupTime = now

    try {
      const lockDir = dirname(dbPath)
      const dbBaseName = basename(dbPath)
      const files = await readdir(lockDir)

      const now = Date.now()

      for (const file of files) {
        // Match lock file patterns: {dbBaseName}.lock.released.*, etc.
        // Use strict prefix check to avoid matching db.sqlite-wal when looking for db.sqlite.lock.*
        if (!file.startsWith(`${dbBaseName}.lock.`)) {
          continue
        }

        const match = file.match(/\.lock\.(released|stale|invalid|corrupt)\.(\d+)$/)
        if (!match) {
          continue
        }

        const filePath = resolve(lockDir, file)
        const timestamp = Number.parseInt(match[2], 10)
        const age = now - timestamp

        // Only remove files older than maxAge
        if (age > maxAge) {
          try {
            await unlink(filePath)
          } catch (error) {
            // Ignore errors - file might have been deleted by another process
            const errorCode = (error as NodeJS.ErrnoException)?.code
            if (errorCode !== 'ENOENT') {
              console.warn(`[FileLock] Failed to delete old lock file ${file}: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        }
      }
    } catch (error) {
      // Silently ignore cleanup errors - this is a maintenance task, not critical
      console.debug(`[FileLock] Cleanup encountered an error: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  /**
   * Try to acquire lock with retries
   * @throws Error if lock cannot be acquired after retries
   */
  async acquire(retries = 10, delay = 100): Promise<void> {
    for (let i = 0; i < retries; i++) {
      try {
        // Try to create lockfile exclusively (fails if exists)
        const lockData = JSON.stringify({
          pid: process.pid,
          acquiredAt: Date.now(),
        })
        await writeFile(this.lockfilePath, lockData, {
          flag: 'wx', // Exclusive create - fails if file exists
          mode: 0o600,
        })
        return // Lock acquired successfully
      } catch (error: unknown) {
        const errorCode = (error as NodeJS.ErrnoException)?.code
        if (errorCode === 'EEXIST') {
          // Lock file exists, check if it's stale
          try {
            const lockContent = await readFile(this.lockfilePath, 'utf-8')
            const lockData = lockDataSchema.safeParse(JSON.parse(lockContent))

            // A live writer may hold a long transaction. Age alone cannot revoke ownership.
            if (lockData.success && Date.now() - lockData.data.acquiredAt > FileLock.LOCK_TIMEOUT) {
              try {
                process.kill(lockData.data.pid, 0)
              } catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ESRCH') {
                  await rename(this.lockfilePath, `${this.lockfilePath}.stale.${Date.now()}`)
                  continue
                }
                throw error
              }
            }
          } catch (readError) {
            // An empty/partial lock file may still be being written. Never steal it.
            if (
              !(readError instanceof SyntaxError) &&
              !(readError instanceof Error && 'code' in readError && readError.code === 'ENOENT')
            ) {
              throw readError
            }
          }

          // Lock is held by another process, wait and retry
          if (i < retries - 1) {
            await new Promise((resolve) => setTimeout(resolve, delay))
          } else {
            throw new Error(`Cannot acquire lock after ${retries} retries (file: ${this.lockfilePath})`)
          }
        } else {
          // Other error (permissions, etc.)
          throw error
        }
      }
    }
    throw new Error(`Cannot acquire lock after ${retries} retries (file: ${this.lockfilePath})`)
  }

  /**
   * Release the lock by removing the lockfile
   */
  async release(): Promise<void> {
    try {
      await rename(this.lockfilePath, `${this.lockfilePath}.released.${Date.now()}`)

      // Trigger cleanup in the background after releasing lock
      // This is fire-and-forget - we don't await the result
      // Remove .lock suffix (5 chars) safely using slice
      const dbPath = this.lockfilePath.slice(0, -5)
      FileLock.cleanupOldLockFiles(dbPath).catch(() => {
        // Ignore errors
      })
    } catch (error: unknown) {
      const errorCode = (error as NodeJS.ErrnoException).code
      if (errorCode !== 'ENOENT') {
        // Log but don't throw - lock might have been cleaned up by another process
        console.warn(`[FileLock] Error releasing lock: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }
}

/**
 * Reentrant Mutex for serializing async operations
 * Allows the same owner to acquire the lock multiple times (reentrant)
 */
class ReentrantMutex {
  private queue: Array<() => void> = []
  private locked = false
  private lockCount = 0
  private owner: symbol | null = null

  async acquire(owner: symbol): Promise<() => void> {
    // If already locked by this owner, increment count and return immediately
    if (this.locked && this.owner === owner) {
      this.lockCount++
      return () => this.release(owner)
    }

    // Wait for lock to be released
    while (this.locked) {
      await new Promise<void>((resolve) => this.queue.push(resolve))
    }

    // Acquire the lock
    this.locked = true
    this.owner = owner
    this.lockCount = 1
    return () => this.release(owner)
  }

  private release(owner: symbol): void {
    // Only the owner can release
    if (this.owner !== owner) {
      return
    }

    this.lockCount--
    if (this.lockCount === 0) {
      // Release the lock
      this.locked = false
      this.owner = null
      // Notify next waiter
      const next = this.queue.shift()
      if (next) {
        next()
      }
    }
  }
}

// Re-export types from core for convenience
export type { MemoryEntry, MemoryOperation, MemoryQuery, QueryOptions }

let SqlJs: SqlJsStatic | null = null
let SqlJsInitPromise: Promise<SqlJsStatic> | null = null

// Check for a WASM file beside the CommonJS entrypoint before using the module
// directory. Bun replaces import.meta.url with a source URL in CommonJS bundles.
const moduleWasmPath = resolve(dirname(fileURLToPath(import.meta.url)), 'sql-wasm.wasm')
const mainModulePath = createRequire(import.meta.url).main?.filename
const mainModuleWasmPath = mainModulePath ? resolve(dirname(mainModulePath), 'sql-wasm.wasm') : null
const bundledWasmPath = mainModuleWasmPath && existsSync(mainModuleWasmPath) ? mainModuleWasmPath : moduleWasmPath
const hasBundledWasm = existsSync(bundledWasmPath)

/**
 * Initialize sql.js WASM module (singleton)
 *
 * The WASM file location is resolved using sql.js's built-in Node.js resolution.
 * When bundled with this package, we use our bundled copy; otherwise we let sql.js
 * find its own WASM file in node_modules.
 */
async function getSqlJs(): Promise<SqlJsStatic> {
  if (SqlJs) {
    return SqlJs
  }
  if (SqlJsInitPromise) {
    return SqlJsInitPromise
  }

  try {
    SqlJsInitPromise = initSqlJs({
      locateFile: (filename: string, prefix: string) => {
        if (hasBundledWasm) {
          return bundledWasmPath
        }
        return prefix + filename
      },
    })
    SqlJs = await SqlJsInitPromise
    return SqlJs
  } catch (error) {
    throw new Error(
      `Failed to initialize sql.js: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Attempted to locate WASM at:\n` +
        `  - ${bundledWasmPath}\n\n` +
        `If you're developing, run: bun run build in packages/cli-shared`,
      { cause: error },
    )
  }
}

/**
 * SQLite Memory Store Implementation
 *
 * This is a concrete implementation of IMemoryStore using SQLite as the backend.
 * It can be used in CLI environments where local file-based storage is appropriate.
 *
 * Uses sql.js (WebAssembly port of SQLite) for consistent behavior across all runtimes.
 */
// AsyncLocalStorage for tracking transaction owner across reentrant calls
const transactionOwnerStorage = new AsyncLocalStorage<symbol>()

export class SQLiteMemoryStore implements IMemoryStore {
  private db: Database | null = null
  private dbPromise: Promise<Database> | null = null
  private config: MemoryConfig
  private currentScope: string
  private inTransaction = false // Track if we're in a transaction
  private transactionMutex = new ReentrantMutex() // Serialize transactions
  private fileLock!: FileLock // Cross-process file lock (initialized in getFileLock())

  /**
   * Reset the lock file cleanup throttle. For testing purposes only.
   */
  static resetCleanupThrottle(): void {
    FileLock.resetCleanupThrottle()
  }

  /**
   * Get the configured database path, or default if not set
   */
  private getDbPath(): string {
    return this.config.path || DEFAULT_MEMORY_CONFIG.path
  }

  /**
   * Get lockfile instance for database path
   */
  private getFileLock(): FileLock {
    if (!this.fileLock) {
      const dbPath = this.#resolvePath(this.getDbPath())
      this.fileLock = new FileLock(dbPath)
    }
    return this.fileLock
  }

  // Whitelists for validation
  private static readonly SORT_COLUMNS = {
    created: 'created_at',
    updated: 'updated_at',
    accessed: 'last_accessed',
    name: 'name',
  } as const

  private static readonly ALLOWED_SORT_ORDERS = ['asc', 'desc'] as const
  private static readonly ALLOWED_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

  constructor(config: MemoryConfig, scope: string) {
    this.config = config
    this.currentScope = scope
  }

  /**
   * Initialize database connection and schema
   */
  private async initializeDatabase(recoverCorruption = false): Promise<Database> {
    // Use promise singleton pattern to prevent race conditions
    if (this.dbPromise) {
      return this.dbPromise
    }

    this.dbPromise = (async () => {
      if (this.db) {
        return this.db
      }

      const dbPath = this.#resolvePath(this.getDbPath())

      const SqlJs = await getSqlJs()
      let dbData: Uint8Array | undefined
      try {
        dbData = await readFile(dbPath)
      } catch (error) {
        if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error
      }

      const openDatabase = (data?: Uint8Array): Database => {
        if (data && (data.length < 16 || new TextDecoder().decode(data.subarray(0, 16)) !== 'SQLite format 3\0')) {
          throw new Error('Invalid SQLite database header')
        }
        const db = new SqlJs.Database(data)
        try {
          this.configurePragmas(db)
          this.checkIntegrity(db)
          this.initializeSchema(db)
          return db
        } catch (error) {
          db.close()
          throw error
        }
      }

      try {
        this.db = openDatabase(dbData)
      } catch (error) {
        const corruption =
          error instanceof Error &&
          [
            'Invalid SQLite database header',
            'file is not a database',
            'database disk image is malformed',
            'Database integrity check failed',
          ].includes(error.message)
        if (!recoverCorruption || !dbData || !corruption) throw error
        // Only the outer write transaction requests recovery; it owns the file lock.
        const backupPath = `${dbPath}.corrupted.${randomUUID()}`
        await rename(dbPath, backupPath)
        console.warn(`[SQLiteMemoryStore] Backed up corrupted database to: ${backupPath}`)
        this.db = openDatabase()
      }
      return this.db
    })()

    try {
      return await this.dbPromise
    } catch (error) {
      this.dbPromise = null
      throw error
    }
  }

  /**
   * Persist database to disk using atomic write with file locking
   */
  private async saveDatabase(): Promise<void> {
    if (!this.db) {
      return
    }

    const dbPath = this.#resolvePath(this.getDbPath())
    const tempPath = `${dbPath}.tmp`
    const data = this.db.export()
    // The outer transaction holds the file lock until this atomic save completes.
    await writeFile(tempPath, data, { mode: 0o600 })
    await rename(tempPath, dbPath)
  }

  /**
   * Configure database pragmas
   */
  private configurePragmas(db: Database): void {
    db.run('PRAGMA synchronous = NORMAL')
    db.run('PRAGMA busy_timeout = 5000')
    db.run('PRAGMA foreign_keys = ON')
    db.run('PRAGMA temp_store = MEMORY')
  }

  /**
   * Check database integrity
   */
  private checkIntegrity(db: Database): void {
    const results = db.exec('PRAGMA quick_check')
    if (results[0]?.values.length !== 1 || results[0]?.values[0]?.[0] !== 'ok') {
      throw new Error('Database integrity check failed')
    }
  }

  /**
   * Initialize database schema
   */
  private initializeSchema(db: Database): void {
    // Create memory entries table
    db.run(`
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
    db.run('CREATE INDEX IF NOT EXISTS idx_memory_entries_scope_type ON memory_entries(scope, entry_type)')
    db.run('CREATE INDEX IF NOT EXISTS idx_memory_entries_updated ON memory_entries(updated_at)')
  }

  /**
   * Get database instance
   */
  private async getDatabase(recoverCorruption = false): Promise<Database> {
    if (!this.db) {
      this.db = await this.initializeDatabase(recoverCorruption)
    }
    return this.db
  }

  /**
   * Normalize database paths and keep home-relative paths inside home.
   */
  #resolvePath(path: string): string {
    const resolved = resolve(resolveHomePath(path))
    if (path.startsWith('~')) {
      const fromHome = relative(resolveHomePath('~'), resolved)
      if (fromHome === '..' || fromHome.startsWith(`..${sep}`) || isAbsolute(fromHome)) {
        throw new Error('Memory path must not escape the home directory')
      }
    }
    return resolved
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
   * Execute transaction
   * Uses Mutex to serialize concurrent transaction calls for safety
   * Supports reentrancy (nested transactions from the same call chain)
   */
  async transaction<T>(callback: () => Promise<T>): Promise<T> {
    // Get or create owner symbol for this transaction context
    let owner = transactionOwnerStorage.getStore()
    if (!owner) {
      owner = Symbol('transaction')
    }

    // Always acquire the mutex to serialize concurrent calls
    const release = await this.transactionMutex.acquire(owner)

    // Run callback in AsyncLocalStorage context to enable reentrancy
    return transactionOwnerStorage.run(owner, async () => {
      const shouldBegin = !this.inTransaction
      let lock: FileLock | undefined
      try {
        if (shouldBegin) {
          await mkdir(dirname(this.#resolvePath(this.getDbPath())), { recursive: true, mode: 0o700 })
          const fileLock = this.getFileLock()
          await fileLock.acquire()
          lock = fileLock
          // Discard cached snapshots only after excluding other writers.
          await this.close()
        }
        const db = await this.getDatabase(shouldBegin)

        // Nested transactions share the outer transaction and its file lock.
        try {
          if (shouldBegin) {
            db.run('BEGIN TRANSACTION')
            this.inTransaction = true
          }
          const result = await callback()
          if (shouldBegin) {
            db.run('COMMIT')
            this.inTransaction = false
            // Save after successful transaction
            try {
              await this.saveDatabase()
            } catch (saveError) {
              // If save fails after commit, close the database to prevent state divergence
              // The in-memory db has committed data but disk is stale
              // Close forces re-initialization which will load from disk on next operation
              console.error('[SQLiteMemoryStore] Failed to save database after commit, closing:', saveError)
              await this.close()
              throw saveError
            }
          }
          return result
        } catch (error) {
          // Only rollback if we're still in a transaction (saveDatabase could have failed after COMMIT)
          if (this.inTransaction) {
            try {
              db.run('ROLLBACK')
            } catch (rollbackError) {
              // Log but don't mask the original error
              console.error('[SQLiteMemoryStore] ROLLBACK failed:', rollbackError)
            }
            this.inTransaction = false
          }
          throw error
        }
      } finally {
        try {
          await lock?.release()
        } finally {
          release()
        }
      }
    })
  }

  /**
   * Read memory by topic
   * Note: Does NOT update last_accessed timestamp to avoid expensive disk writes on every read.
   * The timestamp is updated when memory is modified through updateMemory operations.
   */
  async readMemory(topic: string): Promise<string | undefined> {
    const db = await this.getDatabase()
    const scope = this.currentScope

    const stmt = db.prepare('SELECT content FROM memory_entries WHERE name = ? AND scope = ?')
    stmt.bind([topic, scope])

    // Need to call step() to execute the query
    if (stmt.step()) {
      const row = stmt.getAsObject()
      const content = row.content as string | undefined
      stmt.free()
      return content
    }

    stmt.free()
    return undefined
  }

  /**
   * Internal update memory without transaction (used by batchUpdateMemory)
   */
  private async updateMemoryInternal(
    db: Database,
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
    const scope = this.currentScope
    const now = this.now()

    // Use provided timestamps or default to now
    const createdAt = metadata?.created_at ?? now
    const updatedAt = metadata?.updated_at ?? now
    const lastAccessed = metadata?.last_accessed ?? now

    if (operation === 'remove') {
      const stmt = db.prepare('DELETE FROM memory_entries WHERE name = ? AND scope = ?')
      stmt.run([topic, scope])
      stmt.free()
      return
    }

    const stmt = db.prepare('SELECT content, entry_type, status, priority, tags FROM memory_entries WHERE name = ? AND scope = ?')
    stmt.bind([topic, scope])

    let existing: { content: string; entry_type: string; status: string | null; priority: string | null; tags: string | null } | undefined
    if (stmt.step()) {
      const row = stmt.getAsObject()
      existing = {
        content: row.content as string,
        entry_type: row.entry_type as string,
        status: row.status as string | null,
        priority: row.priority as string | null,
        tags: row.tags as string | null,
      }
      stmt.free()
    } else {
      existing = undefined
      stmt.free()
    }

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
      status = (metadata?.status || existing.status) ?? undefined
      priority = (metadata?.priority || existing.priority) ?? undefined
      tags = (metadata?.tags || existing.tags) ?? undefined
    } else {
      if (!content) {
        throw new Error('Content is required for new memory entries.')
      }
      finalContent = content
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

    upsertStmt.run([
      this.generateUUID(),
      topic,
      scope,
      finalContent,
      entry_type,
      status ?? null,
      priority ?? null,
      tags ?? null,
      createdAt,
      updatedAt,
      lastAccessed,
    ])
    upsertStmt.free()
  }

  /**
   * Update memory
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
    return this.transaction(async () => {
      const db = await this.getDatabase()
      await this.updateMemoryInternal(db, operation, topic, content, metadata)
    })
  }

  /**
   * Query memory with filters
   */
  async queryMemory(query: MemoryQuery = {}, options: QueryOptions = {}): Promise<MemoryEntry[] | number> {
    // For delete operations, wrap in transaction to ensure persistence
    if (options.operation === 'delete') {
      return this.transaction(async () => {
        const db = await this.getDatabase()
        const { sql, params } = this.buildQuery(query)
        const deleteSql = `DELETE FROM memory_entries WHERE id IN (SELECT id FROM (${sql}))`
        const stmt = db.prepare(deleteSql)
        stmt.bind(params)
        stmt.step()
        stmt.free()
        return db.getRowsModified()
      })
    }

    const db = await this.getDatabase()
    const { sql, params } = this.buildQuery(query)

    if (options.operation === 'count') {
      const countSql = `SELECT COUNT(*) as count FROM (${sql})`
      const stmt = db.prepare(countSql)
      stmt.bind(params)
      let count = 0
      if (stmt.step()) {
        const row = stmt.getAsObject()
        count = row.count as number
      }
      stmt.free()
      return count
    }

    const stmt = db.prepare(sql)
    stmt.bind(params)

    const entries: MemoryEntry[] = []
    while (stmt.step()) {
      entries.push(stmt.getAsObject() as MemoryEntry)
    }
    stmt.free()

    return entries
  }

  /**
   * Build SQL query safely with parameterized statements
   */
  private buildQuery(query: MemoryQuery): {
    sql: string
    params: Array<string | number>
  } {
    const conditions: string[] = []
    const params: Array<string | number> = []
    let sql = 'SELECT * FROM memory_entries WHERE 1=1'

    // Scope handling
    if (query.scope !== undefined || this.currentScope !== 'global') {
      conditions.push(`scope = ?`)
      params.push(query.scope === 'global' ? 'global' : this.currentScope)
    }

    // Name filter (exact match)
    if (query.name) {
      if (!query.name.trim()) {
        throw new Error('Name cannot be empty')
      }
      conditions.push(`name = ?`)
      params.push(query.name.trim())
    }

    // Type filter
    if (query.type) {
      if (!query.type.trim()) {
        throw new Error('Type cannot be empty')
      }
      conditions.push(`entry_type = ?`)
      params.push(query.type.trim())
    }

    // Status filter
    if (query.status) {
      conditions.push(`status = ?`)
      params.push(query.status)
    }

    // Priority filter
    if (query.priority) {
      if (!SQLiteMemoryStore.ALLOWED_PRIORITIES.includes(query.priority as 'low' | 'medium' | 'high' | 'critical')) {
        throw new Error(`Invalid priority: ${query.priority}`)
      }
      conditions.push(`priority = ?`)
      params.push(query.priority)
    }

    // Tags filter
    if (query.tags) {
      const tags = Array.isArray(query.tags) ? query.tags : [query.tags]
      for (const tag of tags) {
        const trimmed = tag.trim()
        if (!trimmed) {
          throw new Error('Tags cannot be empty')
        }
        // Escape special LIKE characters (\, _, %) for exact matching
        const escaped = trimmed.replace(/[\\_%]/g, '\\$&')
        // Use comma-wrapped matching for precise tag filtering with ESCAPE clause
        // Matches: "tag", "tag,other", "other,tag", "other,tag,other"
        conditions.push(`(tags = ? OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')`)
        params.push(trimmed, `${escaped},%`, `%,${escaped}`, `%,${escaped},%`)
      }
    }

    // Search filter
    if (query.search) {
      const searchTerm = query.search.trim()
      // For LIKE queries, we need to include the wildcards in the parameter value
      // Also escape special LIKE characters for literal matching
      conditions.push(`(content LIKE ? ESCAPE '\\' OR name LIKE ? ESCAPE '\\')`)
      const searchPattern = `%${searchTerm.replace(/[\\_%]/g, '\\$&')}%`
      params.push(searchPattern, searchPattern)
    }

    // Date range filters
    if (query.createdAfter) {
      conditions.push(`created_at >= ?`)
      params.push(query.createdAfter)
    }
    if (query.createdBefore) {
      conditions.push(`created_at <= ?`)
      params.push(query.createdBefore)
    }
    if (query.updatedAfter) {
      conditions.push(`updated_at >= ?`)
      params.push(query.updatedAfter)
    }
    if (query.updatedBefore) {
      conditions.push(`updated_at <= ?`)
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
      sql += ` LIMIT ?`
      params.push(limit)
    }

    if (query.offset) {
      const offset = Number(query.offset)
      if (Number.isNaN(offset) || offset < 0) {
        throw new Error('Offset must be >= 0')
      }
      sql += ` OFFSET ?`
      params.push(offset)
    }

    return { sql, params }
  }

  /**
   * Batch update memory
   */
  async batchUpdateMemory(operations: MemoryOperation[]): Promise<void> {
    return this.transaction(async () => {
      const db = await this.getDatabase()
      for (const op of operations) {
        await this.updateMemoryInternal(db, op.operation, op.name, op.content, op.metadata)
      }
    })
  }

  /**
   * Close the in-memory snapshot. Transactions persist their own changes.
   * @param _skipSave Deprecated; accepted for compatibility and ignored.
   */
  async close(_skipSave?: boolean): Promise<void> {
    this.db?.close()
    this.db = null
    this.dbPromise = null
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<DatabaseStats> {
    const db = await this.getDatabase()

    const results = db.exec('SELECT COUNT(*) as count FROM memory_entries')
    const totalEntries = (results[0]?.values[0]?.[0] as number) || 0

    const typeResults = db.exec('SELECT entry_type, COUNT(*) as count FROM memory_entries GROUP BY entry_type')
    const entriesByType: Record<string, number> = {}
    if (typeResults.length > 0) {
      for (const row of typeResults[0].values) {
        entriesByType[row[0] as string] = row[1] as number
      }
    }

    // Get database file size
    const dbPath = this.#resolvePath(this.getDbPath())
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
