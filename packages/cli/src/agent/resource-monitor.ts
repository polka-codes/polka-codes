import type { Logger } from '@polka-codes/core'

/**
 * Resource limits configuration
 */
export interface ResourceLimits {
  maxExecutionTime?: number // milliseconds
  maxMemory?: number // MB
  maxSessionTime?: number // minutes
  maxFilesModified?: number
}

/**
 * Resource limit exceeded event
 */
export interface ResourceLimitExceeded {
  limit: 'memory' | 'sessionTime' | 'execution-time' | 'files-modified'
  current: number
  max: number
  message?: string
}

/**
 * Current resource usage
 */
export interface ResourceUsage {
  memoryMB: number
  peakMemoryMB: number
  sessionTimeMinutes: number
  withinLimits: boolean
}

/**
 * Monitors and enforces resource limits
 */
export class ResourceMonitor {
  private startTime: number
  private checkInterval: NodeJS.Timeout | null = null
  private peakMemory: number = 0
  private isRunning: boolean = false

  constructor(
    private limits: ResourceLimits,
    private logger: Logger,
    private onLimitExceeded: (limit: ResourceLimitExceeded) => void | Promise<void>,
  ) {
    this.startTime = Date.now()
  }

  /**
   * Start monitoring
   */
  start(checkIntervalMs: number = 30000): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true
    this.checkInterval = setInterval(async () => {
      try {
        await this.check()
      } catch (error) {
        this.logger.error('Resource monitor check', error as Error)
      }
    }, checkIntervalMs)

    this.logger.info('[ResourceMonitor] Started monitoring')
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return
    }

    this.isRunning = false

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
      this.checkInterval = null
    }

    this.logger.info('[ResourceMonitor] Stopped monitoring')
  }

  /**
   * Check resource usage
   */
  private async check(): Promise<void> {
    // Check memory
    const memUsage = process.memoryUsage()
    const memUsedMB = memUsage.heapUsed / 1024 / 1024
    this.peakMemory = Math.max(this.peakMemory, memUsedMB)

    if (this.limits.maxMemory && memUsedMB > this.limits.maxMemory) {
      this.logger.warn(`[ResourceMonitor] Memory limit exceeded: ${memUsedMB.toFixed(2)}MB / ${this.limits.maxMemory}MB`)

      await this.onLimitExceeded({
        limit: 'memory',
        current: memUsedMB,
        max: this.limits.maxMemory,
        message: `Memory usage (${memUsedMB.toFixed(2)}MB) exceeds limit (${this.limits.maxMemory}MB)`,
      })
    }

    // Check session time
    const elapsedMinutes = (Date.now() - this.startTime) / 60000

    if (this.limits.maxSessionTime && elapsedMinutes > this.limits.maxSessionTime) {
      this.logger.warn(`[ResourceMonitor] Session time limit exceeded: ${elapsedMinutes.toFixed(2)}min / ${this.limits.maxSessionTime}min`)

      await this.onLimitExceeded({
        limit: 'sessionTime',
        current: elapsedMinutes,
        max: this.limits.maxSessionTime,
        message: `Session time (${elapsedMinutes.toFixed(2)}min) exceeds limit (${this.limits.maxSessionTime}min)`,
      })
    }
  }

  /**
   * Get current resource usage
   */
  getCurrentUsage(): ResourceUsage {
    const memUsage = process.memoryUsage()
    const elapsedMinutes = (Date.now() - this.startTime) / 60000

    return {
      memoryMB: memUsage.heapUsed / 1024 / 1024,
      peakMemoryMB: this.peakMemory,
      sessionTimeMinutes: elapsedMinutes,
      withinLimits:
        (this.limits.maxMemory === undefined || memUsage.heapUsed / 1024 / 1024 <= this.limits.maxMemory) &&
        (this.limits.maxSessionTime === undefined || elapsedMinutes <= this.limits.maxSessionTime),
    }
  }

  /**
   * Get memory usage percentage
   * @returns percentage (0-100) or undefined if no memory limit is set
   */
  getMemoryUsagePercentage(): number | undefined {
    if (!this.limits.maxMemory) return undefined
    const current = this.getCurrentUsage().memoryMB
    return (current / this.limits.maxMemory) * 100
  }

  /**
   * Get session time percentage
   * @returns percentage (0-100) or undefined if no session time limit is set
   */
  getSessionTimePercentage(): number | undefined {
    if (!this.limits.maxSessionTime) return undefined
    const current = this.getCurrentUsage().sessionTimeMinutes
    return (current / this.limits.maxSessionTime) * 100
  }
}
