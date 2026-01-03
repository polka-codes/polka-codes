import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { ExecutionRecord, TaskType } from './types'

/**
 * Tracks task execution history
 */
export class TaskHistory {
  private history: ExecutionRecord[] = []
  private historyFilePath: string

  constructor(stateDir: string) {
    this.historyFilePath = path.join(stateDir, 'task-history.json')
  }

  /**
   * Add execution record
   */
  async add(record: ExecutionRecord): Promise<void> {
    this.history.push(record)
    await this.save()
  }

  /**
   * Find records by task type
   */
  findByType(type: TaskType): ExecutionRecord[] {
    return this.history.filter((r) => r.taskType === type)
  }

  /**
   * Find recent failures
   */
  findFailed(limit: number = 10): ExecutionRecord[] {
    return this.history
      .filter((r) => !r.success)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit)
  }

  /**
   * Find slow tasks
   */
  findSlow(limit: number = 10): ExecutionRecord[] {
    return this.history.sort((a, b) => b.actualTime - a.actualTime).slice(0, limit)
  }

  /**
   * Get estimation accuracy
   */
  getEstimationAccuracy(): {
    averageError: number
    averageErrorPercentage: number
    totalTasks: number
  } {
    if (this.history.length === 0) {
      return {
        averageError: 0,
        averageErrorPercentage: 0,
        totalTasks: 0,
      }
    }

    const errors = this.history.map((r) => Math.abs(r.estimatedTime - r.actualTime))
    const avgError = errors.reduce((sum, e) => sum + e, 0) / errors.length

    const errorPercentages = this.history.map((r) => Math.abs((r.estimatedTime - r.actualTime) / r.estimatedTime) * 100)
    const _avgErrorPercentage = errorPercentages.reduce((sum, e) => sum + e, 0) / errorPercentages.length

    return {
      averageError: avgError,
      averageErrorPercentage: _avgErrorPercentage,
      totalTasks: this.history.length,
    }
  }

  /**
   * Generate report
   */
  generateReport(): string {
    const total = this.history.length
    const successful = this.history.filter((r) => r.success).length
    const failed = total - successful

    const avgTime = total > 0 ? this.history.reduce((sum, r) => sum + r.actualTime, 0) / total : 0

    const accuracy = this.getEstimationAccuracy()

    return `
Task History Report:
  Total Tasks: ${total}
  Successful: ${successful} (${total > 0 ? ((successful / total) * 100).toFixed(1) : 0}%)
  Failed: ${failed} (${total > 0 ? ((failed / total) * 100).toFixed(1) : 0}%)
  Average Time: ${avgTime.toFixed(1)} minutes
  Time Estimation Error: ${accuracy.averageErrorPercentage.toFixed(1)}%
    `.trim()
  }

  /**
   * Save history to disk
   */
  private async save(): Promise<void> {
    try {
      const dir = path.dirname(this.historyFilePath)
      await fs.mkdir(dir, { recursive: true })
      await fs.writeFile(this.historyFilePath, JSON.stringify(this.history, null, 2))
    } catch (_error) {
      // Fail silently - history is not critical
    }
  }

  /**
   * Load history from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.historyFilePath, 'utf-8')
      this.history = JSON.parse(content)
    } catch {
      // No existing history
      this.history = []
    }
  }

  /**
   * Clear history
   */
  async clear(): Promise<void> {
    this.history = []
    try {
      await fs.unlink(this.historyFilePath)
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
