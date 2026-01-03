/**
 * Error handling utilities for the agent system
 *
 * Provides standardized error logging and suppression patterns
 * to improve debugging and production troubleshooting.
 */

import type { Logger } from '@polka-codes/core'

/**
 * Options for logAndSuppress
 */
export interface LogAndSuppressOptions {
  /** If true, completely silent (no logging) */
  silent?: boolean
  /** Log level to use (default: debug) */
  level?: 'warn' | 'debug' | 'error'
  /** Additional context to include in log message */
  context?: Record<string, unknown>
}

/**
 * Log an error and suppress it (prevent re-throwing)
 *
 * This utility provides a consistent pattern for error handling where
 * errors are intentionally suppressed but should be logged for debugging.
 *
 * @param logger - Logger instance to use
 * @param error - The error to log
 * @param contextMessage - Contextual information about where the error occurred
 * @param options - Optional configuration
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation()
 * } catch (error) {
 *   logAndSuppress(logger, error, 'TaskDiscovery.getProjectType')
 *   return 'unknown'
 * }
 * ```
 */
export function logAndSuppress(logger: Logger, error: unknown, contextMessage: string, options: LogAndSuppressOptions = {}): void {
  const { silent = false, level = 'debug', context = {} } = options

  if (silent) {
    return
  }

  // Extract error message
  const message = error instanceof Error ? error.message : String(error)

  // Build log message
  const fullContext = `[${contextMessage}] ${message}`
  const contextString = Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : ''

  // Log at appropriate level
  if (level === 'error') {
    logger.error(`${fullContext}${contextString}`)
    if (error instanceof Error && error.stack) {
      logger.debug(`[${contextMessage}] Stack:`, error.stack)
    }
  } else if (level === 'warn') {
    logger.warn(`${fullContext}${contextString}`)
  } else {
    logger.debug(`${fullContext}${contextString}`)
    if (error instanceof Error && error.stack) {
      logger.debug(`[${contextMessage}] Stack:`, error.stack)
    }
  }
}

/**
 * Standard error types for better error categorization
 */

/**
 * Error thrown when a file system operation fails
 */
export class FileSystemAccessError extends Error {
  name = 'FileSystemAccessError'

  constructor(
    public path: string,
    public operation: string,
    cause?: Error,
  ) {
    super(`Failed to ${operation} ${path}`)
    if (cause) {
      this.cause = cause
    }
  }
}

/**
 * Error thrown when a command execution fails
 */
export class CommandExecutionError extends Error {
  name = 'CommandExecutionError'

  constructor(
    public command: string,
    public exitCode: number,
    public stderr: string,
    cause?: Error,
  ) {
    super(`Command failed with code ${exitCode}: ${command}`)
    if (cause) {
      this.cause = cause
    }
  }
}

/**
 * Error thrown when JSON parsing fails
 */
export class JSONParseError extends Error {
  name = 'JSONParseError'

  constructor(
    public filePath: string,
    public rawContent: string,
    cause?: Error,
  ) {
    super(`Failed to parse JSON from ${filePath}`)
    if (cause) {
      this.cause = cause
    }
  }
}

/**
 * Safely parse JSON with error handling
 *
 * Unlike JSON.parse, this provides a structured error with file context.
 *
 * @param content - JSON string to parse
 * @param filePath - File path for error messages
 * @returns Parsed object
 * @throws {JSONParseError} If JSON parsing fails
 */
export function safeJSONParse<T = unknown>(content: string, filePath: string): T {
  try {
    return JSON.parse(content) as T
  } catch (error) {
    throw new JSONParseError(filePath, content, error as Error)
  }
}
