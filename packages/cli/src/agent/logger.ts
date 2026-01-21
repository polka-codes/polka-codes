import * as fs from 'node:fs/promises'
import type { Logger } from '@polka-codes/core'
import type { AgentMetrics, Task } from './types'

/**
 * Structured logger for autonomous agent operations
 */
export class AgentLogger {
  private logger: Logger
  private logFile: string
  private sessionId: string
  private logLevel: string = 'info'

  constructor(logger: Logger, logFile: string, sessionId: string, logLevel: string = 'info') {
    this.logger = logger
    this.logFile = logFile
    this.sessionId = sessionId
    this.logLevel = logLevel
  }

  /**
   * Log task-related message
   */
  task(task: Task, message: string, meta?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'task',
      taskId: task.id,
      taskType: task.type,
      taskTitle: task.title,
      message,
      ...meta,
    }

    this.logger.info(`[${task.id}] ${message}`)
    // Fire and forget - don't await to avoid blocking
    void this.writeToFile(logEntry)
  }

  /**
   * Log workflow-related message
   */
  workflow(workflow: string, message: string, meta?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'workflow',
      workflow,
      message,
      ...meta,
    }

    this.logger.info(`[${workflow}] ${message}`)
    void this.writeToFile(logEntry)
  }

  /**
   * Log milestone/phase change
   */
  milestone(message: string, meta?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'milestone',
      message,
      ...meta,
    }

    this.logger.info(`[MILESTONE] ${message}`)
    void this.writeToFile(logEntry)
  }

  /**
   * Log discovery result
   */
  discovery(strategy: string, tasksFound: number, meta?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'discovery',
      strategy,
      tasksFound,
      ...meta,
    }

    this.logger.info(`[Discovery] ${strategy}: found ${tasksFound} tasks`)
    void this.writeToFile(logEntry)
  }

  /**
   * Log state transition
   */
  stateTransition(from: string, to: string, reason?: string, _meta?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'state-transition',
      from,
      to,
      reason,
    }

    this.logger.info(`[State] ${from} → ${to}${reason ? ` (${reason})` : ''}`)
    void this.writeToFile(logEntry)
  }

  /**
   * Log metrics update
   */
  metrics(metrics: AgentMetrics): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'debug',
      type: 'metrics',
      ...metrics,
    }

    this.logger.debug(`[Metrics] Tasks: ${metrics.tasksCompleted}/${metrics.totalTasks}`)
    void this.writeToFile(logEntry)
  }

  /**
   * Log approval request
   */
  approval(task: Task, approved: boolean, reason?: string): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'info',
      type: 'approval',
      taskId: task.id,
      taskTitle: task.title,
      approved,
      reason,
      action: approved ? 'approved' : 'rejected',
    }

    this.logger.info(`[Approval] ${approved ? '✓' : '✗'} ${task.title}`)
    void this.writeToFile(logEntry)
  }

  /**
   * Log error with context
   */
  error(context: string, error: Error, meta?: Record<string, unknown>): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      level: 'error',
      type: 'error',
      context,
      message: error.message,
      stack: error.stack,
      ...meta,
    }

    this.logger.error(`[${context}] ${error.message}`)
    void this.writeToFile(logEntry)
  }

  /**
   * Standard info log
   */
  info(message: string, ...args: any[]): void {
    this.logger.info(message, ...args)
  }

  /**
   * Standard warn log
   */
  warn(message: string, ...args: any[]): void {
    this.logger.warn(message, ...args)
  }

  /**
   * Standard debug log
   */
  debug(message: string, ...args: any[]): void {
    this.logger.debug(message, ...args)
  }

  /**
   * Write log entry to file
   */
  private async writeToFile(entry: Record<string, unknown>): Promise<void> {
    try {
      await fs.appendFile(this.logFile, `${JSON.stringify(entry)}\n`)
    } catch (error) {
      // Silently fail to avoid infinite loops
      // Use stderr as last resort for critical logger failures
      if (this.logLevel === 'debug') {
        process.stderr.write(`[Logger] Failed to write to log file: ${error}\n`)
      }
    }
  }
}
