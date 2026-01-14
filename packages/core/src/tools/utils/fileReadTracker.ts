/**
 * File Read Tracking Utilities
 *
 * Simple functional approach to tracking which files have been read.
 * Used to enforce "read first" safety for write/edit operations.
 *
 * @example
 * ```typescript
 * import { createFileReadTracker, markAsRead, hasBeenRead } from './utils/fileReadTracker'
 *
 * // Create tracker for this session
 * const readSet = createFileReadTracker()
 *
 * // After reading a file
 * markAsRead(readSet, '/path/to/file.ts')
 *
 * // Before writing
 * if (!hasBeenRead(readSet, '/path/to/file.ts')) {
 *   throw new Error('Must read file first')
 * }
 * ```
 */

/**
 * Creates a new file read tracking Set.
 *
 * @returns A Set to track read files
 */
export function createFileReadTracker(): Set<string> {
  return new Set<string>()
}

/**
 * Mark a file as having been read.
 *
 * @param readSet - The tracking Set
 * @param path - Absolute or relative file path
 */
export function markAsRead(readSet: Set<string>, path: string): void {
  readSet.add(path)
}

/**
 * Check if a file has been read.
 *
 * @param readSet - The tracking Set
 * @param path - Absolute or relative file path
 * @returns true if file has been read, false otherwise
 */
export function hasBeenRead(readSet: Set<string>, path: string): boolean {
  return readSet.has(path)
}

/**
 * Get all read files.
 *
 * @param readSet - The tracking Set
 * @returns Array of file paths that have been read
 */
export function getReadFiles(readSet: Set<string>): string[] {
  return Array.from(readSet)
}

/**
 * Get count of read files.
 *
 * @param readSet - The tracking Set
 * @returns Number of files that have been read
 */
export function getReadCount(readSet: Set<string>): number {
  return readSet.size
}
