/**
 * Testing Utilities and Fixtures
 *
 * Provides reusable test fixtures and utilities to reduce duplication
 * and improve test maintainability across the codebase.
 */

import { type Mock, mock } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * Temporary directory fixture for isolated test environments
 *
 * Creates a unique temp directory for each test and ensures proper cleanup.
 *
 * @example
 * ```ts
 * describe('MyTest', () => {
 *   let fixture: TempDirectoryFixture
 *
 *   beforeEach(async () => {
 *     fixture = new TempDirectoryFixture()
 *     const dir = await fixture.setup()
 *   })
 *
 *   afterEach(async () => {
 *     await fixture.teardown()
 *   })
 * })
 * ```
 */
export class TempDirectoryFixture {
  private dir: string | null = null

  /**
   * Create a unique temporary directory
   * @returns Path to the created directory
   */
  async setup(): Promise<string> {
    this.dir = mkdtempSync(join(tmpdir(), 'test-'))
    return this.dir
  }

  /**
   * Clean up the temporary directory
   * Logs cleanup failures for debugging
   */
  async teardown(): Promise<void> {
    if (this.dir) {
      try {
        rmSync(this.dir, { recursive: true, force: true })
      } catch (error) {
        console.error(`[TempDirectoryFixture] Failed to cleanup: ${this.dir}`, error)
      }
      this.dir = null
    }
  }

  /**
   * Get a path within the temp directory
   * @param segments - Path segments to join
   * @returns Full path to the file/directory
   * @throws Error if setup() hasn't been called
   */
  getPath(...segments: string[]): string {
    if (!this.dir) {
      throw new Error('TempDirectoryFixture not initialized. Call setup() first.')
    }
    return join(this.dir, ...segments)
  }

  /**
   * Check if the fixture has been initialized
   */
  isInitialized(): boolean {
    return this.dir !== null
  }
}

/**
 * Mock helpers for creating typed mocks
 *
 * These helpers reduce the need for 'any' type assertions in tests
 */

/**
 * Create a mock function with proper type safety
 * @returns A mock function that can be configured
 */
export function createMockFunction<T extends (...args: any[]) => any>(implementation?: T): T & { mock: Mock<T> } {
  const mockFn = mock(implementation) as unknown as T & { mock: Mock<T> }
  return mockFn
}

/**
 * Helper to create a partial mock (only mock specific methods)
 * @param obj - Object to create partial mock of
 * @param mockedMethods - Methods to mock
 * @returns Partial mock with specified methods mocked
 */
export function createPartialMock<T extends Record<string, any>>(obj: T, mockedMethods: (keyof T)[]): Partial<T> {
  const result = {} as Partial<T>
  for (const key in obj) {
    if (mockedMethods.includes(key)) {
      result[key] = mock() as any
    } else {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Snapshot testing helpers
 */

/**
 * Fields that should be redacted from snapshots
 * These are typically unstable or environment-specific
 */
export const SNAPSHOT_REDACT_FIELDS = [
  'id',
  'timestamp',
  'date',
  'created_at',
  'updated_at',
  'last_accessed',
  'filePath',
  'absolutePath',
] as const

/**
 * Redact unstable fields from an object for snapshot testing
 * @param obj - Object to redact fields from
 * @param fields - Fields to redact (defaults to SNAPSHOT_REDACT_FIELDS)
 * @returns Object with unstable fields replaced with matchers
 */
export function redactUnstableFields<T extends Record<string, any>>(obj: T, fields: (keyof T)[] = SNAPSHOT_REDACT_FIELDS as any): T {
  const result = { ...obj }
  for (const field of fields) {
    if (field in result) {
      // Use a placeholder for unstable fields - actual replacement done in tests
      result[field] = '[REDACTED]' as any
    }
  }
  return result
}

/**
 * Async test helpers
 */

/**
 * Run an async test with timeout
 * @param fn - Test function to run
 * @param timeoutMs - Timeout in milliseconds (default: 5000)
 * @returns Promise that rejects if timeout
 */
export function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number = 5000): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Test timed out after ${timeoutMs}ms`)), timeoutMs)
  })

  return Promise.race([fn(), timeoutPromise])
}

/**
 * Database test helpers
 */

/**
 * Generate a unique database name for testing
 * @returns Unique database name
 */
export function generateTestDbName(): string {
  return `test-${randomUUID().slice(0, 8)}.sqlite`
}

/**
 * Memory test helpers
 */

/**
 * Create a test memory entry with required fields
 * @param overrides - Fields to override from defaults
 * @returns Test memory entry
 */
export function createTestMemoryEntry(
  overrides: Partial<{
    name: string
    content: string
    entry_type: string
    status: string
    priority: string
    tags: string
    created_at: number
    updated_at: number
    last_accessed: number
  }> = {},
) {
  const now = Date.now()
  return {
    name: `test-entry-${randomUUID().slice(0, 8)}`,
    content: 'Test content',
    entry_type: 'note',
    status: 'active',
    priority: 'medium',
    tags: '',
    created_at: now,
    updated_at: now,
    last_accessed: now,
    ...overrides,
  }
}

/**
 * Assert helpers (deprecated - use expect() directly in tests)
 */

// Note: These helper functions are not used. Use expect() directly in tests.
// export function expectToRejectWithMessage(fn: () => Promise<any>, errorMessage: string): Promise<void> {
//   return expect(fn()).rejects.toThrow(errorMessage)
// }
//
// export function expectToThrowWithType<T extends Error>(fn: () => any, errorType: new (...args: any[]) => T): Promise<void> {
//   return expect(fn()).toThrow(errorType)
// }
