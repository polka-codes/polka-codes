import { execSync } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Logger } from '@polka-codes/core'
import { AdvancedDiscoveryStrategies } from './advanced-discovery'
import { Priority } from './constants'
import { logAndSuppress } from './error-handling'
import type { Task, WorkflowContext } from './types'

/**
 * Type for execSync error with stdout/stderr
 */
interface ExecSyncError extends Error {
  stdout?: string
  stderr?: string
  status?: number
}

/**
 * Task discovery cache entry
 */
interface DiscoveryCache {
  gitHead: string
  timestamp: number
  discoveredTasks: Task[]
}

/**
 * Generate unique task ID
 */
function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

/**
 * Parse test output for failure descriptions
 */
function parseTestFailures(output: string): string[] {
  const failures: string[] = []

  // Match typical bun test failure patterns
  const lines = output.split('\n')
  for (const line of lines) {
    if (line.includes('✗') || line.includes('fail') || line.includes('Error:')) {
      failures.push(line.trim())
    }
  }

  return failures
}

/**
 * Parse lint output for file paths
 */
function parseLintFiles(output: string): string[] {
  const files = new Set<string>()

  // Match file paths (starts with / or contains .ts/.js)
  const matches = output.matchAll(/([^\s]+\.(ts|js|tsx|jsx))/g)
  for (const match of matches) {
    files.add(match[1])
  }

  return Array.from(files)
}

/**
 * Get current git HEAD commit
 */
async function getGitHead(logger?: Logger): Promise<string> {
  try {
    return execSync('git rev-parse HEAD', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim()
  } catch (error) {
    if (logger) {
      logAndSuppress(logger, error, 'getGitHead')
    }
    return 'unknown'
  }
}

/**
 * Discover build errors
 *
 * Strategy: Run typecheck first, then build if types pass
 */
async function discoverBuildErrors(context: WorkflowContext): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Checking for build errors...')

    // Run typecheck first
    try {
      execSync('bun typecheck', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
      })
    } catch (error) {
      // Type errors found - create high-priority task
      const execError = error as ExecSyncError
      const output = execError.stdout || execError.stderr || String(error)

      tasks.push({
        id: generateId('build-typecheck'),
        title: 'Fix TypeScript errors',
        description: `TypeScript compilation failed:\n${output.slice(0, 500)}`,
        type: 'bugfix',
        priority: Priority.HIGH,
        complexity: 'medium',
        estimatedTime: 30,
        status: 'pending',
        workflow: 'code',
        workflowInput: {
          prompt: 'Fix all TypeScript errors reported by bun typecheck',
          files: [],
          context: output.slice(0, 1000),
        },
        dependencies: [],
        files: [],
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          source: 'discovery',
          errorType: 'typescript',
        },
      })

      context.logger.warn('[Discovery] Type errors found')
      return tasks // Don't run build if types fail
    }

    // Types pass, try build
    try {
      execSync('bun run build', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        stdio: 'pipe',
        timeout: 120000, // 2 minute timeout
      })
    } catch (error) {
      const output = (error as ExecSyncError).stdout || (error as ExecSyncError).stderr || String(error)

      tasks.push({
        id: generateId('build'),
        title: 'Fix build errors',
        description: `Build failed:\n${output.slice(0, 500)}`,
        type: 'bugfix',
        priority: Priority.CRITICAL,
        complexity: 'high',
        estimatedTime: 45,
        status: 'pending',
        workflow: 'code',
        workflowInput: {
          prompt: 'Fix build errors. Start by examining the build output carefully.',
          files: [],
          context: output.slice(0, 1000),
        },
        dependencies: [],
        files: [],
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          source: 'discovery',
          errorType: 'build',
        },
      })

      context.logger.warn('[Discovery] Build errors found')
    }
  } catch (error) {
    context.logger.error('[Discovery] Error checking build', error as Error)
  }

  return tasks
}

/**
 * Discover failing tests
 */
async function discoverTestFailures(context: WorkflowContext): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Checking for failing tests...')

    const _output = execSync('bun test', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    // If we get here, tests passed
    context.logger.info('[Discovery] All tests passing')
  } catch (error) {
    const output = (error as ExecSyncError).stdout || (error as ExecSyncError).stderr || String(error)

    // Parse test output for failures
    const failedTests = parseTestFailures(output)

    if (failedTests.length > 0) {
      tasks.push({
        id: generateId('tests'),
        title: `Fix ${failedTests.length} failing test(s)`,
        description: `Tests failing:\n${failedTests.slice(0, 10).join('\n')}`,
        type: 'bugfix',
        priority: Priority.HIGH,
        complexity: 'medium',
        estimatedTime: Math.min(failedTests.length * 10, 60),
        status: 'pending',
        workflow: 'code',
        workflowInput: {
          prompt: `Fix failing tests:\n${failedTests.slice(0, 20).join('\n')}`,
          files: [],
          context: output.slice(0, 1500),
        },
        dependencies: [],
        files: [],
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          source: 'discovery',
          errorType: 'test',
          failureCount: failedTests.length,
        },
      })

      context.logger.warn(`[Discovery] ${failedTests.length} test(s) failing`)
    }
  }

  return tasks
}

/**
 * Discover type errors (if not already found in build)
 */
async function discoverTypeErrors(context: WorkflowContext): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Running typecheck...')

    execSync('bun typecheck', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    })
  } catch (error) {
    const output = (error as ExecSyncError).stdout || (error as ExecSyncError).stderr || String(error)

    // Count errors
    const errorCount = (output.match(/error TS/gi) || []).length

    tasks.push({
      id: generateId('typecheck'),
      title: `Fix ${errorCount} TypeScript error(s)`,
      description: `Type errors found`,
      type: 'bugfix',
      priority: Priority.HIGH,
      complexity: 'medium',
      estimatedTime: Math.min(errorCount * 5, 45),
      status: 'pending',
      workflow: 'code',
      workflowInput: {
        prompt: 'Fix TypeScript type errors',
        files: [],
        context: output.slice(0, 1000),
      },
      dependencies: [],
      files: [],
      createdAt: Date.now(),
      retryCount: 0,
      metadata: {
        source: 'discovery',
        errorType: 'typescript',
        errorCount,
      },
    })

    context.logger.warn(`[Discovery] ${errorCount} type error(s) found`)
  }

  return tasks
}

/**
 * Discover lint issues
 */
async function discoverLintIssues(context: WorkflowContext): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Running linter...')

    const _output = execSync('bun lint', {
      cwd: process.cwd(),
      encoding: 'utf-8',
      stdio: 'pipe',
    })

    context.logger.info('[Discovery] No lint issues')
  } catch (error) {
    const output = (error as ExecSyncError).stdout || (error as ExecSyncError).stderr || String(error)

    // Parse lint output for file paths
    const files = parseLintFiles(output)

    if (files.length > 0) {
      tasks.push({
        id: generateId('lint'),
        title: `Fix lint issues in ${files.length} file(s)`,
        description: `Lint issues found`,
        type: 'bugfix',
        priority: Priority.LOW,
        complexity: 'low',
        estimatedTime: Math.min(files.length * 2, 30),
        status: 'pending',
        workflow: 'code',
        workflowInput: {
          prompt: 'Fix lint issues',
          files,
          context: output.slice(0, 1000),
        },
        dependencies: [],
        files,
        createdAt: Date.now(),
        retryCount: 0,
        metadata: {
          source: 'discovery',
          errorType: 'lint',
          fileCount: files.length,
        },
      })

      context.logger.warn(`[Discovery] Lint issues in ${files.length} file(s)`)
    }
  }

  return tasks
}

/**
 * Load cached discovery results
 *
 * CRITICAL: Only use cache if git HEAD unchanged
 */
async function loadFromCache(context: WorkflowContext, cacheDir: string): Promise<Task[] | null> {
  try {
    const cacheFile = path.join(cacheDir, 'discovery-cache.json')
    const exists = await fs
      .access(cacheFile)
      .then(() => true)
      .catch(() => false)

    if (!exists) {
      return null
    }

    const cached: DiscoveryCache = JSON.parse(await fs.readFile(cacheFile, 'utf-8'))

    // Check if git state changed
    const currentHead = await getGitHead(context.logger)
    if (cached.gitHead !== currentHead) {
      context.logger.info('[Discovery] Cache invalid (git state changed)')
      return null
    }

    // Check cache age (max 1 hour)
    const age = Date.now() - cached.timestamp
    if (age > 3600000) {
      context.logger.info('[Discovery] Cache expired (too old)')
      return null
    }

    return cached.discoveredTasks
  } catch (error) {
    context.logger.warn('[Discovery] Failed to load cache', error as Error)
    return null
  }
}

/**
 * Save discovery results to cache
 */
async function saveToCache(context: WorkflowContext, cacheDir: string, tasks: Task[]): Promise<void> {
  try {
    await fs.mkdir(cacheDir, { recursive: true })

    const cacheFile = path.join(cacheDir, 'discovery-cache.json')
    const gitHead = await getGitHead(context.logger)

    const cache: DiscoveryCache = {
      gitHead,
      timestamp: Date.now(),
      discoveredTasks: tasks,
    }

    await fs.writeFile(cacheFile, JSON.stringify(cache, null, 2))
    context.logger.info('[Discovery] Cached discovery results')
  } catch (error) {
    context.logger.warn('[Discovery] Failed to save cache', error as Error)
  }
}

/**
 * Task discovery engine state
 */
interface TaskDiscoveryEngineState {
  cacheDir: string
  backoffSeconds: number
  maxBackoffSeconds: number
}

/**
 * Discovers tasks automatically for continuous improvement mode
 *
 * Critical behavior:
 * - Uses build output, then tests (not both in same workflow)
 * - Tracks git HEAD to invalidate cache on changes
 * - Exponential backoff in continuous mode
 */
export interface TaskDiscoveryEngine {
  discover(options?: { useCache?: boolean; includeAdvanced?: boolean }): Promise<Task[]>
  getBackoffSeconds(): number
  increaseBackoff(): void
  resetBackoff(): void
}

export function createTaskDiscoveryEngine(context: WorkflowContext): TaskDiscoveryEngine {
  const state: TaskDiscoveryEngineState = {
    cacheDir: path.join(process.cwd(), '.polka', 'cache'),
    backoffSeconds: 60,
    maxBackoffSeconds: 900, // 15 minutes
  }

  return {
    /**
     * Discover tasks in the codebase
     */
    async discover(options: { useCache?: boolean; includeAdvanced?: boolean } = {}): Promise<Task[]> {
      const { useCache = true, includeAdvanced = false } = options

      context.logger.info('[Discovery] Scanning codebase for issues...')

      // Check cache first (only if git state unchanged)
      if (useCache) {
        const cached = await loadFromCache(context, state.cacheDir)
        if (cached) {
          context.logger.info(`[Discovery] Using cached results (${cached.length} tasks)`)
          return cached
        }
      }

      const tasks: Task[] = []

      // 1. Check for build errors
      const buildErrors = await discoverBuildErrors(context)
      tasks.push(...buildErrors)

      // Only run tests if no build errors
      if (buildErrors.length === 0) {
        // 2. Check for failing tests
        const testFailures = await discoverTestFailures(context)
        tasks.push(...testFailures)
      }

      // 3. Check for type errors
      const typeErrors = await discoverTypeErrors(context)
      tasks.push(...typeErrors)

      // 4. Check for lint issues
      const lintIssues = await discoverLintIssues(context)
      tasks.push(...lintIssues)

      // 5. Advanced discovery strategies (optional, enabled via flag or config)
      if (includeAdvanced) {
        context.logger.info('[Discovery] Running advanced discovery strategies...')

        try {
          // Security analysis (always enabled in advanced mode)
          const securityIssues = await AdvancedDiscoveryStrategies.securityStrategy.execute(context)
          tasks.push(...securityIssues)

          // Test coverage analysis
          const testCoverageGaps = await AdvancedDiscoveryStrategies.testCoverageStrategy.execute(context)
          tasks.push(...testCoverageGaps)

          // Optional strategies (disabled by default as they can be noisy)
          const refactoringTasks = await AdvancedDiscoveryStrategies.refactoringStrategy.execute(context)
          tasks.push(...refactoringTasks)

          const documentationTasks = await AdvancedDiscoveryStrategies.documentationStrategy.execute(context)
          tasks.push(...documentationTasks)

          const performanceTasks = await AdvancedDiscoveryStrategies.performanceStrategy.execute(context)
          tasks.push(...performanceTasks)
        } catch (error) {
          context.logger.warn('[Discovery] Advanced strategies failed', error as Error)
        }
      }

      // 6. Cache results if git state is stable
      await saveToCache(context, state.cacheDir, tasks)

      context.logger.info(`[Discovery] Found ${tasks.length} tasks`)

      return tasks
    },

    /**
     * Get current backoff wait time
     */
    getBackoffSeconds(): number {
      return state.backoffSeconds
    },

    /**
     * Increase backoff (exponential)
     */
    increaseBackoff(): void {
      state.backoffSeconds = Math.min(state.backoffSeconds * 2, state.maxBackoffSeconds)
      context.logger.info(`[Discovery] Increased backoff to ${state.backoffSeconds}s`)
    },

    /**
     * Reset backoff (called when tasks found)
     */
    resetBackoff(): void {
      state.backoffSeconds = 60
      context.logger.info('[Discovery] Reset backoff to 60s')
    },
  }
}
