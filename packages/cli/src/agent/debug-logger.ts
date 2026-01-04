/**
 * Debug logging utilities for troubleshooting
 *
 * Provides structured debug logging with different verbosity levels
 * and optional output to file for detailed investigation.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { Logger } from '@polka-codes/core'

/**
 * Debug verbosity levels
 */
export enum DebugLevel {
  /** No debug output */
  NONE = 0,
  /** Basic debug information */
  BASIC = 1,
  /** Verbose debug information */
  VERBOSE = 2,
  /** Extremely detailed (includes all logs) */
  TRACE = 3,
}

/**
 * Debug categories for selective logging
 */
export enum DebugCategory {
  WORKFLOW = 'workflow',
  STATE = 'state',
  EXECUTOR = 'executor',
  PLANNER = 'planner',
  DISCOVERY = 'discovery',
  APPROVAL = 'approval',
  SAFETY = 'safety',
  SESSION = 'session',
  ALL = '*',
}

/**
 * Debug logger configuration
 */
export interface DebugLoggerConfig {
  /** Debug verbosity level */
  level: DebugLevel
  /** Specific categories to debug (empty = all) */
  categories: DebugCategory[]
  /** Optional file to write debug logs to */
  outputFile?: string
  /** Include timestamps */
  timestamps: boolean
  /** Include stack traces */
  stackTraces: boolean
}

/**
 * Default debug configuration
 */
export const DEFAULT_DEBUG_CONFIG: DebugLoggerConfig = {
  level: DebugLevel.NONE,
  categories: [],
  timestamps: true,
  stackTraces: false,
}

/**
 * Debug logger for structured debugging
 */
export class DebugLogger {
  private config: DebugLoggerConfig
  private enabledCategories: Set<DebugCategory>
  private debugBuffer: string[] = []

  constructor(
    private baseLogger: Logger,
    config: Partial<DebugLoggerConfig> = {},
  ) {
    this.config = { ...DEFAULT_DEBUG_CONFIG, ...config }
    this.enabledCategories = new Set(this.config.categories)
  }

  /**
   * Update debug configuration
   */
  updateConfig(config: Partial<DebugLoggerConfig>): void {
    this.config = { ...this.config, ...config }
    this.enabledCategories = new Set(this.config.categories)
  }

  /**
   * Check if a category is enabled for debugging
   */
  isCategoryEnabled(category: DebugCategory): boolean {
    return this.config.level > DebugLevel.NONE && (this.enabledCategories.has(DebugCategory.ALL) || this.enabledCategories.has(category))
  }

  /**
   * Log at basic level
   */
  basic(category: DebugCategory, message: string, data?: any): void {
    if (this.config.level < DebugLevel.BASIC) return
    if (!this.isCategoryEnabled(category)) return

    this.log('DEBUG', category, message, data)
  }

  /**
   * Log at verbose level
   */
  verbose(category: DebugCategory, message: string, data?: any): void {
    if (this.config.level < DebugLevel.VERBOSE) return
    if (!this.isCategoryEnabled(category)) return

    this.log('VERBOSE', category, message, data)
  }

  /**
   * Log at trace level (most detailed)
   */
  trace(category: DebugCategory, message: string, data?: any): void {
    if (this.config.level < DebugLevel.TRACE) return
    if (!this.isCategoryEnabled(category)) return

    this.log('TRACE', category, message, data)
  }

  /**
   * Log error with context
   */
  error(category: DebugCategory, message: string, error: unknown): void {
    if (!this.isCategoryEnabled(category)) return

    const errorData = {
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error),
    }

    this.log('ERROR', category, message, errorData)
  }

  /**
   * Log function entry
   */
  enter(category: DebugCategory, fnName: string, args?: any): void {
    this.verbose(category, `→ ${fnName}`, args)
  }

  /**
   * Log function exit
   */
  exit(category: DebugCategory, fnName: string, result?: any): void {
    this.verbose(category, `← ${fnName}`, result)
  }

  /**
   * Log state transition
   */
  stateTransition(from: string, to: string, context?: any): void {
    this.basic(DebugCategory.STATE, `State transition: ${from} → ${to}`, context)
  }

  /**
   * Log workflow execution
   */
  workflow(workflow: string, input: any, result?: any): void {
    this.basic(DebugCategory.WORKFLOW, `Workflow: ${workflow}`, { input, result })
  }

  /**
   * Log task execution
   */
  task(taskId: string, action: string, details?: any): void {
    this.basic(DebugCategory.EXECUTOR, `Task ${taskId}: ${action}`, details)
  }

  /**
   * Internal log method
   */
  private log(level: string, category: DebugCategory, message: string, data?: any): void {
    const timestamp = this.config.timestamps ? new Date().toISOString() : ''
    const categoryPrefix = `[${category}]`
    const levelPrefix = `[${level}]`

    let logMessage = `${timestamp} ${categoryPrefix} ${levelPrefix} ${message}`

    if (data !== undefined) {
      const dataStr = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      logMessage += `\n${dataStr}`
    }

    // Log to console
    this.baseLogger.debug(logMessage)

    // Buffer for file output
    this.debugBuffer.push(logMessage)

    // Flush if buffer gets too large
    if (this.debugBuffer.length > 100) {
      this.flush()
    }
  }

  /**
   * Flush debug buffer to file
   */
  async flush(): Promise<void> {
    if (!this.config.outputFile || this.debugBuffer.length === 0) {
      return
    }

    try {
      const content = `${this.debugBuffer.join('\n\n')}\n`

      // Ensure directory exists
      const dir = this.config.outputFile.split('/').slice(0, -1).join('/')
      if (dir) {
        await mkdir(dir, { recursive: true })
      }

      // Append to file
      await writeFile(this.config.outputFile, content, { flag: 'a' })

      this.debugBuffer = []
    } catch (error) {
      this.baseLogger.error(`[DebugLogger] Failed to write debug log: ${error}`)
    }
  }

  /**
   * Create a child debug logger with a default category
   */
  child(category: DebugCategory): DebugLoggerChild {
    return new DebugLoggerChild(this, category)
  }
}

/**
 * Child debug logger for a specific category
 */
export class DebugLoggerChild {
  constructor(
    private debugLogger: DebugLogger,
    private category: DebugCategory,
  ) {}

  basic(message: string, data?: any): void {
    this.debugLogger.basic(this.category, message, data)
  }

  verbose(message: string, data?: any): void {
    this.debugLogger.verbose(this.category, message, data)
  }

  trace(message: string, data?: any): void {
    this.debugLogger.trace(this.category, message, data)
  }

  error(message: string, error: unknown): void {
    this.debugLogger.error(this.category, message, error)
  }

  enter(fnName: string, args?: any): void {
    this.debugLogger.enter(this.category, fnName, args)
  }

  exit(fnName: string, result?: any): void {
    this.debugLogger.exit(this.category, fnName, result)
  }
}

/**
 * Create a debug logger from environment variable
 *
 * Usage: DEBUG=1,2,3,4 or DEBUG_LEVEL=1 DEBUG_CATEGORIES=workflow,executor
 *
 * Environment variables:
 * - DEBUG: Enable debug logging (1, true, yes, verbose, or *) -> level 1
 * - DEBUG_LEVEL: Set specific level (0-4)
 * - DEBUG_CATEGORIES: Comma-separated categories (e.g., workflow,executor)
 */
export function createDebugLoggerFromEnv(baseLogger: Logger, stateDir: string): DebugLogger {
  // Check DEBUG environment variable
  const debugEnv = process.env.DEBUG_LEVEL || process.env.DEBUG || '0'

  // Parse debug level with support for common boolean strings
  let debugLevel: number
  const parsed = parseInt(debugEnv, 10)

  if (Number.isNaN(parsed)) {
    // Handle non-numeric values
    const normalized = debugEnv.toLowerCase().trim()
    if (normalized === '*') {
      // Wildcard typically means "all" -> maximum verbosity with all categories
      debugLevel = 3 // TRACE
    } else if (normalized === 'verbose') {
      debugLevel = 2 // VERBOSE (not BASIC)
    } else if (normalized === '1' || normalized === 'true' || normalized === 'yes') {
      debugLevel = 1 // BASIC
    } else {
      debugLevel = 0 // NONE
    }
  } else {
    debugLevel = Math.max(0, Math.min(3, parsed)) // Clamp to valid range (0-3)
  }

  // Parse categories
  const categoriesStr = process.env.DEBUG_CATEGORIES || ''
  let categories = categoriesStr
    .split(',')
    .filter(Boolean)
    .map((c) => c.trim() as DebugCategory)

  // If debug mode is enabled but no categories specified, enable all categories
  // This ensures DEBUG=1, DEBUG=verbose, etc. actually produce output
  if (debugLevel > 0 && categories.length === 0) {
    categories = [DebugCategory.ALL]
  }

  // Create output file path
  const outputFile = debugLevel > 0 ? join(stateDir, 'debug.log') : undefined

  return new DebugLogger(baseLogger, {
    level: debugLevel as DebugLevel,
    categories,
    outputFile,
    timestamps: true,
    stackTraces: debugLevel >= DebugLevel.VERBOSE,
  })
}
