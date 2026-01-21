/**
 * Error handling utilities for the agent system
 *
 * Provides standardized error logging and suppression patterns
 * to improve debugging and production troubleshooting.
 */

import type { Logger } from '@polka-codes/core'
import { createErrorClass } from '@polka-codes/core'

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

/**
 * Log strategy type
 */
type LogStrategy = (logger: Logger, message: string, error?: Error, contextMessage?: string) => void

/**
 * Helper function to log message with optional stack trace
 */
function logWithStack(logger: Logger, level: 'error' | 'debug', message: string, error?: Error, contextMessage?: string): void {
  logger[level](message)
  if (error?.stack) {
    logger.debug(`[${contextMessage}] Stack:`, error.stack)
  }
}

/**
 * Log strategies for different log levels
 * Each strategy handles logging at its specific level with appropriate stack trace handling
 */
const logStrategies: Record<string, LogStrategy> = {
  error: (logger, message, error, contextMessage) => {
    logWithStack(logger, 'error', message, error, contextMessage)
  },
  warn: (logger, message) => logger.warn(message),
  debug: (logger, message, error, contextMessage) => {
    logWithStack(logger, 'debug', message, error, contextMessage)
  },
}

export function logAndSuppress(logger: Logger, error: unknown, contextMessage: string, options: LogAndSuppressOptions = {}): void {
  const { silent = false, level = 'debug', context = {} } = options

  if (silent) {
    return
  }

  // Extract error message
  const message = error instanceof Error ? error.message : String(error)

  // Build log message
  const fullContext = `[${contextMessage}] ${message}`
  let contextString = ''
  if (Object.keys(context).length > 0) {
    try {
      contextString = ` ${JSON.stringify(context)}`
    } catch {
      // If context contains circular references or can't be stringified,
      // fall back to a simple object representation
      contextString = ` [context data omitted - circular or non-serializable]`
    }
  }
  const logMessage = `${fullContext}${contextString}`

  // Use strategy pattern - select appropriate logging strategy
  const strategy = logStrategies[level] ?? logStrategies.debug
  strategy(logger, logMessage, error instanceof Error ? error : undefined, contextMessage)
}

/**
 * Standard error types for better error categorization
 *
 * Using createErrorClass factory for consistent error handling
 * and proper stack trace preservation.
 */

/**
 * Error thrown when a file system operation fails
 *
 * @param path - File or directory path
 * @param operation - Operation being performed (read, write, delete, etc.)
 * @param cause - Optional underlying error
 */
export const FileSystemAccessError = createErrorClass('FileSystemAccessError', (args: [string, string] | [string, string, Error?]) => {
  const [path, operation] = args
  return `Failed to ${operation} ${path}`
})

/**
 * Error thrown when a command execution fails
 *
 * @param command - Command that was executed
 * @param exitCode - Exit code from the command
 * @param _stderr - Standard error output (not shown in message)
 * @param cause - Optional underlying error
 */
export const CommandExecutionError = createErrorClass(
  'CommandExecutionError',
  (args: [string, number] | [string, number, string?, Error?]) => {
    const [command, exitCode] = args
    return `Command failed with code ${exitCode}: ${command}`
  },
)

/**
 * Error thrown when JSON parsing fails
 *
 * @param filePath - Path to file being parsed
 * @param _rawContent - Raw content that failed to parse (not shown in message)
 * @param cause - Optional underlying error
 */
export const JSONParseError = createErrorClass('JSONParseError', (args: [string] | [string, string?, Error?]) => {
  const [filePath] = args
  return `Failed to parse JSON from ${filePath}`
})

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
    // createErrorClass automatically extracts Error from last argument
    throw new JSONParseError(filePath, content, error as Error)
  }
}
