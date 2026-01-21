import type { Logger } from '@polka-codes/core'
import type { AgentMetrics } from './types'

/**
 * Create a default no-op logger for testing
 */
function createDefaultLogger(): Logger {
  return {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  }
}

/**
 * Collects and tracks agent metrics
 */
export class MetricsCollector {
  #metrics: AgentMetrics
  #startTime: number
  #taskStartTimes: Map<string, number> = new Map()
  #logger: Logger

  constructor(logger: Logger = createDefaultLogger()) {
    this.#startTime = Date.now()
    this.#metrics = this.emptyMetrics()
    this.#logger = logger
  }

  /**
   * Record task start
   */
  recordTaskStart(taskId: string): void {
    this.#taskStartTimes.set(taskId, Date.now())
    this.#metrics.totalTasks++
  }

  /**
   * Record task completion
   */
  recordTaskComplete(taskId: string): void {
    const startTime = this.#taskStartTimes.get(taskId)
    if (!startTime) {
      this.#logger.warn(`[Metrics] No start time for task ${taskId}`)
      return
    }

    const duration = Date.now() - startTime
    this.#metrics.tasksCompleted++
    this.#metrics.totalExecutionTime += duration
    this.#taskStartTimes.delete(taskId)

    this.updateSuccessRate()
    this.updateAverageTaskTime()
  }

  /**
   * Record task failure
   */
  recordTaskFailure(taskId: string): void {
    this.#taskStartTimes.delete(taskId)
    this.#metrics.tasksFailed++
    this.updateSuccessRate()
  }

  /**
   * Record git operation
   */
  recordGitOperation(operation: { filesChanged?: number; insertions?: number; deletions?: number }): void {
    if (operation.filesChanged) {
      this.#metrics.git.totalFilesChanged += operation.filesChanged
    }
    if (operation.insertions) {
      this.#metrics.git.totalInsertions += operation.insertions
    }
    if (operation.deletions) {
      this.#metrics.git.totalDeletions += operation.deletions
    }
  }

  /**
   * Record commit
   */
  recordCommit(): void {
    this.#metrics.git.totalCommits++
  }

  /**
   * Record test results
   */
  recordTestResults(results: { passed: number; failed: number }): void {
    this.#metrics.tests.testsPassed += results.passed
    this.#metrics.tests.testsFailed += results.failed
    this.#metrics.tests.totalTestsRun += results.passed + results.failed
  }

  /**
   * Update coverage percentage
   */
  updateCoverage(percentage: number): void {
    this.#metrics.tests.currentCoverage = percentage
  }

  /**
   * Get current metrics
   */
  getMetrics(): AgentMetrics {
    this.#metrics.totalExecutionTime = Date.now() - this.#startTime
    return { ...this.#metrics }
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.#metrics = this.emptyMetrics()
    this.#taskStartTimes.clear()
    this.#startTime = Date.now()
  }

  /**
   * Update success rate
   */
  private updateSuccessRate(): void {
    const total = this.#metrics.tasksCompleted + this.#metrics.tasksFailed
    this.#metrics.successRate = total > 0 ? (this.#metrics.tasksCompleted / total) * 100 : 0
  }

  /**
   * Update average task time
   */
  private updateAverageTaskTime(): void {
    const total = this.#metrics.tasksCompleted + this.#metrics.tasksFailed
    if (total === 0) {
      this.#metrics.averageTaskTime = 0
      return
    }

    this.#metrics.averageTaskTime = this.#metrics.totalExecutionTime / 60000 / total // Convert ms to minutes
  }

  /**
   * Create empty metrics object
   */
  private emptyMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTasks: 0,
      totalExecutionTime: 0,
      averageTaskTime: 0,
      successRate: 0,
      git: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        branchesCreated: 0,
      },
      tests: {
        totalTestsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        currentCoverage: 0,
        testsAdded: 0,
      },
      improvements: {
        bugsFixed: 0,
        testsAdded: 0,
        refactoringsCompleted: 0,
        documentationAdded: 0,
        qualityImprovements: 0,
      },
    }
  }
}
