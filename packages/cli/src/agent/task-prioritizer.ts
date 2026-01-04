import type { Task } from './types'
import { Priority } from './types'

/**
 * Priority adjustment factors
 */
interface PriorityFactors {
  /** Task failed before (higher priority to fix) */
  failedBefore: boolean

  /** Task is blocked by other tasks (lower priority) */
  blocked: boolean

  /** Task blocks others (higher priority) */
  blocksOthers: boolean

  /** File has high change frequency (higher priority) */
  hotFile: boolean

  /** Similar tasks failed recently (higher priority) */
  problematicArea: boolean

  /** Task age in milliseconds */
  age: number

  /** Number of retry attempts */
  retryCount: number
}

/**
 * Task prioritization result
 */
interface PrioritizationResult {
  /** Original priority */
  originalPriority: Priority

  /** Adjusted priority */
  adjustedPriority: Priority

  /** Reasoning for adjustment */
  reasoning: string

  /** Confidence score (0-1) */
  confidence: number
}

/**
 * Dynamic task prioritizer
 *
 * Adjusts task priorities based on:
 * - Historical execution success/failure
 * - Dependency relationships
 * - File change frequency
 * - Task age
 * - Cluster of similar failures
 */
export class TaskPrioritizer {
  private executionHistory: Map<string, Array<{ success: boolean; timestamp: number }>> = new Map()
  private fileChangeFrequency: Map<string, number> = new Map()
  private readonly MAX_HISTORY_SIZE = 100
  private readonly HIGH_PRIORITY_THRESHOLD = 850
  private readonly LOW_PRIORITY_THRESHOLD = 350

  /**
   * Prioritize a list of tasks
   */
  prioritizeTasks(tasks: Task[], allTasks: Task[]): Task[] {
    if (tasks.length === 0) {
      return tasks
    }

    // Calculate priority for each task
    const prioritized = tasks.map((task) => {
      const result = this.calculatePriority(task, allTasks)
      return {
        task,
        result,
        adjustedPriority: result.adjustedPriority,
      }
    })

    // Sort by adjusted priority (highest first)
    prioritized.sort((a, b) => b.adjustedPriority - a.adjustedPriority)

    // Return tasks in priority order
    return prioritized.map((p) => {
      // Update task priority
      const updatedTask = { ...p.task, priority: p.adjustedPriority }
      return updatedTask
    })
  }

  /**
   * Calculate dynamic priority for a task
   */
  calculatePriority(task: Task, allTasks: Task[]): PrioritizationResult {
    const originalPriority = task.priority
    const factors = this.gatherFactors(task, allTasks)
    const adjustment = this.calculateAdjustment(task, factors)
    const adjustedPriority = this.applyAdjustment(originalPriority, adjustment)

    const reasoning = this.generateReasoning(task, factors, adjustment)
    const confidence = this.calculateConfidence(factors)

    return {
      originalPriority,
      adjustedPriority,
      reasoning,
      confidence,
    }
  }

  /**
   * Gather priority adjustment factors
   */
  private gatherFactors(task: Task, allTasks: Task[]): PriorityFactors {
    // Check if task failed before
    const history = this.executionHistory.get(task.id) || []
    const failedBefore = history.some((h) => !h.success)

    // Check if task is blocked
    const blocked =
      task.dependencies.length > 0 &&
      task.dependencies.some((depId) => {
        const dep = allTasks.find((t) => t.id === depId)
        return dep && dep.status !== 'completed'
      })

    // Check if task blocks others
    const blocksOthers = allTasks.some((t) => t.dependencies.includes(task.id) && t.status !== 'completed')

    // Check file change frequency
    let hotFile = false
    for (const file of task.files) {
      const freq = this.fileChangeFrequency.get(file) || 0
      if (freq > 5) {
        // Changed more than 5 times recently
        hotFile = true
        break
      }
    }

    // Check for problematic area (similar tasks failed)
    const problematicArea = this.isProblematicArea(task)

    // Task age
    const age = Date.now() - task.createdAt

    return {
      failedBefore,
      blocked,
      blocksOthers,
      hotFile,
      problematicArea,
      age,
      retryCount: task.retryCount || 0,
    }
  }

  /**
   * Calculate priority adjustment score
   */
  private calculateAdjustment(_task: Task, factors: PriorityFactors): number {
    let adjustment = 0

    // Failed before (+200)
    if (factors.failedBefore) {
      adjustment += 200
    }

    // Blocked (-150)
    if (factors.blocked) {
      adjustment -= 150
    }

    // Blocks others (+100)
    if (factors.blocksOthers) {
      adjustment += 100
    }

    // Hot file (+150)
    if (factors.hotFile) {
      adjustment += 150
    }

    // Problematic area (+100)
    if (factors.problematicArea) {
      adjustment += 100
    }

    // Old task (+50 per day, max 150)
    const ageInDays = factors.age / (1000 * 60 * 60 * 24)
    if (ageInDays > 1) {
      adjustment += Math.min(Math.floor(ageInDays) * 50, 150)
    }

    // High retry count (+100 per retry, max 300)
    if (factors.retryCount > 0) {
      adjustment += Math.min(factors.retryCount * 100, 300)
    }

    return adjustment
  }

  /**
   * Apply adjustment to original priority
   */
  private applyAdjustment(original: Priority, adjustment: number): Priority {
    let adjusted = original + adjustment

    // Clamp to valid priority range
    adjusted = Math.max(Priority.TRIVIAL, Math.min(Priority.CRITICAL, adjusted))

    return adjusted as Priority
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(task: Task, factors: PriorityFactors, adjustment: number): string {
    const reasons: string[] = []

    if (factors.failedBefore) {
      reasons.push('failed previously')
    }
    if (factors.blocked) {
      reasons.push('blocked by dependencies')
    }
    if (factors.blocksOthers) {
      reasons.push('blocks other tasks')
    }
    if (factors.hotFile) {
      reasons.push('frequently changed file')
    }
    if (factors.problematicArea) {
      reasons.push('problematic code area')
    }
    if (factors.age > 86400000) {
      // More than 1 day
      reasons.push('old task')
    }
    if (factors.retryCount > 0) {
      reasons.push(`retry attempt ${factors.retryCount + 1}`)
    }

    if (reasons.length === 0) {
      return `Priority ${task.priority} (no adjustment)`
    }

    const direction = adjustment > 0 ? 'increased' : 'decreased'
    return `Priority ${direction} from ${task.priority} to ${task.priority + adjustment} (${reasons.join(', ')})`
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(factors: PriorityFactors): number {
    let confidence = 0.5 // Base confidence

    // More factors = higher confidence
    if (factors.failedBefore) confidence += 0.15
    if (factors.blocked) confidence += 0.1
    if (factors.blocksOthers) confidence += 0.1
    if (factors.hotFile) confidence += 0.1
    if (factors.problematicArea) confidence += 0.15
    if (factors.retryCount > 0) confidence += 0.1

    return Math.min(confidence, 1.0)
  }

  /**
   * Check if task is in a problematic area
   */
  private isProblematicArea(task: Task): boolean {
    // Check if similar tasks (same files) failed recently
    for (const file of task.files) {
      const history = this.executionHistory.get(file) || []
      const recentFailures = history.filter(
        (h) => !h.success && Date.now() - h.timestamp < 3600000, // Last hour
      )

      if (recentFailures.length >= 2) {
        return true
      }
    }

    return false
  }

  /**
   * Record task execution result
   */
  recordExecution(taskId: string, success: boolean): void {
    const history = this.executionHistory.get(taskId) || []

    history.push({
      success,
      timestamp: Date.now(),
    })

    // Trim history if too large
    if (history.length > this.MAX_HISTORY_SIZE) {
      history.shift()
    }

    this.executionHistory.set(taskId, history)
  }

  /**
   * Record file change
   */
  recordFileChange(file: string): void {
    const current = this.fileChangeFrequency.get(file) || 0
    this.fileChangeFrequency.set(file, current + 1)

    // Decay old frequencies periodically (not implemented here)
  }

  /**
   * Reset all history
   */
  resetHistory(): void {
    this.executionHistory.clear()
    this.fileChangeFrequency.clear()
  }

  /**
   * Get high priority tasks
   */
  getHighPriorityTasks(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.priority >= this.HIGH_PRIORITY_THRESHOLD)
  }

  /**
   * Get low priority tasks
   */
  getLowPriorityTasks(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.priority <= this.LOW_PRIORITY_THRESHOLD)
  }

  /**
   * Get critical tasks
   */
  getCriticalTasks(tasks: Task[]): Task[] {
    return tasks.filter((t) => t.priority === Priority.CRITICAL)
  }

  /**
   * Get prioritization statistics
   */
  getStatistics(): {
    totalTasksTracked: number
    averageSuccessRate: number
    mostProblematicFiles: Array<{ file: string; failures: number }>
  } {
    let totalExecutions = 0
    let totalSuccesses = 0
    const fileFailures: Map<string, number> = new Map()

    for (const [taskId, history] of this.executionHistory.entries()) {
      totalExecutions += history.length
      totalSuccesses += history.filter((h) => h.success).length

      // Track failures per file (assuming taskId maps to file)
      const failures = history.filter((h) => !h.success).length
      if (failures > 0) {
        fileFailures.set(taskId, failures)
      }
    }

    const mostProblematicFiles = Array.from(fileFailures.entries())
      .map(([file, failures]) => ({ file, failures }))
      .sort((a, b) => b.failures - a.failures)
      .slice(0, 10)

    return {
      totalTasksTracked: this.executionHistory.size,
      averageSuccessRate: totalExecutions > 0 ? totalSuccesses / totalExecutions : 1,
      mostProblematicFiles,
    }
  }
}
