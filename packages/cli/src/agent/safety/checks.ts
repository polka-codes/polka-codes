import type { Logger } from '@polka-codes/core'
import type { SafetyCheckResult, Task } from '../types'

/**
 * Performs safety checks before task execution
 */
export class SafetyChecker {
  #tools: any

  constructor(_logger: Logger, tools: any) {
    this.#tools = tools
  }

  /**
   * Perform pre-execution safety checks
   */
  async preExecutionCheck(task: Task): Promise<SafetyCheckResult> {
    const checks: any[] = []

    // Check 1: Repository has uncommitted changes
    checks.push(await this.checkUncommittedChanges(task))

    // Check 2: Task affects critical files
    checks.push(await this.checkCriticalFiles(task))

    // Check 3: Working branch is clean
    checks.push(await this.checkWorkingBranch(task))

    const failed = checks.filter((c) => !c.passed && c.action === 'block')
    const warnings = checks.filter((c) => !c.passed && c.action === 'warn')
    const _passed = checks.filter((c) => c.passed)

    return {
      safe: failed.length === 0,
      checks,
      failed,
      warnings,
    }
  }

  /**
   * Check multiple tasks
   */
  async checkTasks(tasks: Task[]): Promise<SafetyCheckResult> {
    const allChecks: any[] = []
    const allFailed: any[] = []
    const allWarnings: any[] = []

    for (const task of tasks) {
      const result = await this.preExecutionCheck(task)
      allChecks.push(...result.checks)
      allFailed.push(...result.failed)
      allWarnings.push(...result.warnings)
    }

    return {
      safe: allFailed.length === 0,
      checks: allChecks,
      failed: allFailed,
      warnings: allWarnings,
    }
  }

  /**
   * Check for uncommitted changes
   */
  private async checkUncommittedChanges(task: Task): Promise<any> {
    try {
      const result = await this.#tools.executeCommand({
        command: 'git status --porcelain',
        shell: true,
      })

      const hasChanges = result.stdout.trim().length > 0

      if (hasChanges && task.type === 'commit') {
        return {
          name: 'uncommitted-changes',
          passed: false,
          message: 'Repository has uncommitted changes before commit task',
          action: 'warn',
        }
      }

      return {
        name: 'uncommitted-changes',
        passed: true,
        message: hasChanges ? 'Repository has uncommitted changes' : 'Repository is clean',
        action: 'ignore',
      }
    } catch {
      return {
        name: 'uncommitted-changes',
        passed: true,
        message: 'Could not check git status',
        action: 'ignore',
      }
    }
  }

  /**
   * Check for critical files
   */
  private async checkCriticalFiles(task: Task): Promise<any> {
    const criticalPatterns = [
      'package.json',
      'tsconfig.json',
      '.env',
      '.gitignore',
      'yarn.lock',
      'package-lock.json',
      'bun.lock',
      'bun.lockb',
    ]

    const affectedCritical = task.files.filter((file) => criticalPatterns.some((pattern) => file.includes(pattern)))

    if (affectedCritical.length > 0) {
      return {
        name: 'critical-files',
        passed: false,
        message: `Task affects critical files: ${affectedCritical.join(', ')}`,
        action: 'warn',
        error: `Critical files: ${affectedCritical.join(', ')}`,
      }
    }

    return {
      name: 'critical-files',
      passed: true,
      message: 'No critical files affected',
      action: 'ignore',
    }
  }

  /**
   * Check working branch
   */
  private async checkWorkingBranch(task: Task): Promise<any> {
    try {
      const result = await this.#tools.executeCommand({
        command: 'git branch --show-current',
        shell: true,
      })

      const currentBranch = result.stdout.trim()

      // Check if we're on main/master
      if ((currentBranch === 'main' || currentBranch === 'master') && task.type === 'commit') {
        return {
          name: 'working-branch',
          passed: false,
          message: `Committing directly to ${currentBranch} branch`,
          action: 'warn',
          error: `Consider creating a feature branch instead of committing to ${currentBranch}`,
        }
      }

      return {
        name: 'working-branch',
        passed: true,
        message: `Working on branch: ${currentBranch}`,
        action: 'ignore',
      }
    } catch {
      return {
        name: 'working-branch',
        passed: true,
        message: 'Could not determine current branch',
        action: 'ignore',
      }
    }
  }
}
