import { exec as execCallback } from 'node:child_process'
import { promisify } from 'node:util'
import { ulid } from 'ulid'
import type { CliToolRegistry } from '../workflow-tools'
import type { CodeWorkflowInput } from '../workflows/code.workflow'
import { AdvancedDiscoveryStrategies } from './advanced-discovery'
import { Priority } from './constants'
import type { CliWorkflowContext, Task, ToolRegistry } from './types'

// Promisified exec for non-blocking command execution
const exec = promisify(execCallback)

function getCommandOutput(error: unknown): string {
  if (!(error instanceof Error)) return String(error)
  const stdout = 'stdout' in error && typeof error.stdout === 'string' ? error.stdout : ''
  const stderr = 'stderr' in error && typeof error.stderr === 'string' ? error.stderr : ''
  return [stdout, stderr].filter(Boolean).join('\n') || String(error)
}

/**
 * Generate unique task ID using ULID
 */
function generateId(prefix: string): string {
  return `${prefix}-${ulid()}`
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
 * Discover build errors
 *
 * Strategy: Run typecheck first, then build if types pass
 */
async function discoverBuildErrors<TTools extends ToolRegistry>(context: CliWorkflowContext<TTools>): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Checking for build errors...')

    // Run typecheck first
    try {
      await exec('bun typecheck', {
        cwd: process.cwd(),
      })
    } catch (error) {
      // Type errors found - create high-priority task
      const output = getCommandOutput(error)

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
          task: `Fix all TypeScript errors reported by bun typecheck\n\n${output.slice(0, 1000)}`,
        } satisfies CodeWorkflowInput,
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
      await exec('bun run build', {
        cwd: process.cwd(),
        timeout: 120000, // 2 minute timeout
      })
    } catch (error) {
      const output = getCommandOutput(error)

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
          task: `Fix build errors. Start by examining the build output carefully.\n\n${output.slice(0, 1000)}`,
        } satisfies CodeWorkflowInput,
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
async function discoverTestFailures<TTools extends ToolRegistry>(context: CliWorkflowContext<TTools>): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Checking for failing tests...')

    const _output = await exec('bun test', {
      cwd: process.cwd(),
    })

    // If we get here, tests passed
    context.logger.info('[Discovery] All tests passing')
  } catch (error) {
    const output = getCommandOutput(error)

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
          task: `Fix failing tests:\n${failedTests.slice(0, 20).join('\n')}\n\n${output.slice(0, 1500)}`,
        } satisfies CodeWorkflowInput,
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
 * Discover lint issues
 */
async function discoverLintIssues<TTools extends ToolRegistry>(context: CliWorkflowContext<TTools>): Promise<Task[]> {
  const tasks: Task[] = []

  try {
    context.logger.info('[Discovery] Running linter...')

    const _output = await exec('bun lint', {
      cwd: process.cwd(),
    })

    context.logger.info('[Discovery] No lint issues')
  } catch (error) {
    const output = getCommandOutput(error)

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
          task: `Fix lint issues\n\n${output.slice(0, 1000)}`,
        } satisfies CodeWorkflowInput,
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
 * Task discovery engine state
 */
interface TaskDiscoveryEngineState {
  backoffSeconds: number
  maxBackoffSeconds: number
}

/**
 * Discovers tasks automatically for continuous improvement mode
 *
 * Critical behavior:
 * - Uses build output, then tests (not both in same workflow)
 * - Scans the current working tree on every iteration
 * - Exponential backoff in continuous mode
 */
export interface TaskDiscoveryEngine {
  discover(options?: { includeAdvanced?: boolean }): Promise<Task[]>
  getBackoffSeconds(): number
  increaseBackoff(): void
  resetBackoff(): void
}

export function createTaskDiscoveryEngine<TTools extends ToolRegistry = CliToolRegistry>(
  context: CliWorkflowContext<TTools>,
): TaskDiscoveryEngine {
  const state: TaskDiscoveryEngineState = {
    backoffSeconds: 60,
    maxBackoffSeconds: 900, // 15 minutes
  }

  return {
    /**
     * Discover tasks in the codebase
     */
    async discover(options: { includeAdvanced?: boolean } = {}): Promise<Task[]> {
      const { includeAdvanced = false } = options

      context.logger.info('[Discovery] Scanning codebase for issues...')

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

      // 3. Check for lint issues
      const lintIssues = await discoverLintIssues(context)
      tasks.push(...lintIssues)

      // 4. Advanced discovery strategies (optional, enabled via flag or config)
      if (includeAdvanced) {
        context.logger.info('[Discovery] Running advanced discovery strategies...')

        try {
          // Advanced discovery strategies only use context.logger and context.workingDir
          // Create a minimal context to avoid generic type propagation issues
          const ctx = { logger: context.logger, workingDir: context.workingDir }

          // Run all strategies in parallel for efficiency
          const [securityIssues, testCoverageGaps, refactoringTasks, documentationTasks, performanceTasks] = await Promise.all([
            AdvancedDiscoveryStrategies.securityStrategy.execute(ctx as any),
            AdvancedDiscoveryStrategies.testCoverageStrategy.execute(ctx as any),
            AdvancedDiscoveryStrategies.refactoringStrategy.execute(ctx as any),
            AdvancedDiscoveryStrategies.documentationStrategy.execute(ctx as any),
            AdvancedDiscoveryStrategies.performanceStrategy.execute(ctx as any),
          ])

          tasks.push(...securityIssues, ...testCoverageGaps, ...refactoringTasks, ...documentationTasks, ...performanceTasks)
        } catch (error) {
          context.logger.warn('[Discovery] Advanced strategies failed', error as Error)
        }
      }

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
