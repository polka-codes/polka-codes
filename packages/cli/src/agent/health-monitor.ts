import type { Logger } from '@polka-codes/core'

/**
 * Health status
 */
export interface HealthStatus {
  healthy: boolean
  reason?: string
  details?: Record<string, any>
}

/**
 * Health check function
 */
export type HealthCheck = () => Promise<HealthStatus> | HealthStatus

/**
 * Monitors agent health
 */
export class HealthMonitor {
  private checkInterval: NodeJS.Timeout | null = null
  private lastHealthCheck: number = 0
  private lastHealthStatus: HealthStatus | null = null
  private isRunning: boolean = false

  constructor(
    private logger: Logger,
    private healthCheck: HealthCheck,
    private onUnhealthy?: (status: HealthStatus) => void | Promise<void>,
  ) {}

  /**
   * Start health monitoring
   */
  start(intervalMs: number = 60000): void {
    if (this.isRunning) {
      return
    }

    this.isRunning = true

    this.checkInterval = setInterval(async () => {
      try {
        const status = await this.check()
        this.lastHealthCheck = Date.now()
        this.lastHealthStatus = status

        if (!status.healthy) {
          this.logger.warn(`[HealthMonitor] Unhealthy: ${status.reason}`)

          if (this.onUnhealthy) {
            await this.onUnhealthy(status)
          }
        } else {
          this.logger.debug('[HealthMonitor] Healthy')
        }
      } catch (error) {
        this.logger.error('Health check error', error as Error)

        // Treat errors as unhealthy
        const errorStatus: HealthStatus = {
          healthy: false,
          reason: 'Health check failed',
          details: { error: error instanceof Error ? error.message : String(error) },
        }

        this.lastHealthStatus = errorStatus

        if (this.onUnhealthy) {
          await this.onUnhealthy(errorStatus)
        }
      }
    }, intervalMs)

    this.logger.info('[HealthMonitor] Started health monitoring')
  }

  /**
   * Stop health monitoring
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

    this.logger.info('[HealthMonitor] Stopped health monitoring')
  }

  /**
   * Perform health check
   */
  async check(): Promise<HealthStatus> {
    return await this.healthCheck()
  }

  /**
   * Get last health check status
   */
  getLastStatus(): HealthStatus | null {
    return this.lastHealthStatus
  }

  /**
   * Get time since last health check
   */
  getTimeSinceLastCheck(): number {
    return Date.now() - this.lastHealthCheck
  }
}
