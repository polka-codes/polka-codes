import type { Logger } from '@polka-codes/core'

/**
 * Handles graceful shutdown and interruption
 */
export class InterruptHandler {
  #interrupted: boolean = false
  #interruptReason: string = ''
  #logger: Logger
  #agent: any

  constructor(
    logger: Logger,
    agent: any, // Reference to AutonomousAgent
  ) {
    this.#logger = logger
    this.#agent = agent
    this.setupInterruptHandlers()
  }

  /**
   * Set up interrupt handlers
   */
  private setupInterruptHandlers(): void {
    // Handle SIGINT (Ctrl+C)
    process.on('SIGINT', () => {
      this.handleInterrupt('SIGINT')
    })

    // Handle SIGTERM
    process.on('SIGTERM', () => {
      this.handleInterrupt('SIGTERM')
    })

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.#logger.error('UncaughtException', error)
      this.#interrupted = true
      this.#interruptReason = `Uncaught exception: ${error.message}`
    })

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason) => {
      this.#logger.error('UnhandledRejection', reason as Error)
      this.#interrupted = true
      this.#interruptReason = `Unhandled rejection: ${reason}`
    })
  }

  /**
   * Handle interrupt signal
   */
  private async handleInterrupt(signal: string): Promise<void> {
    if (this.#interrupted) {
      this.#logger.warn(`[Interrupt] Already interrupted, forcing exit`)
      process.exit(1)
    }

    this.#logger.info(`\n[Interrupt] Received ${signal}, shutting down gracefully...`)
    this.#interrupted = true
    this.#interruptReason = `Received ${signal}`

    try {
      if (this.#agent && typeof this.#agent.stop === 'function') {
        await this.#agent.stop()
      }

      if (this.#agent && typeof this.#agent.cleanup === 'function') {
        await this.#agent.cleanup()
      }

      this.#logger.info('[Interrupt] Shutdown complete')
      process.exit(0)
    } catch (error) {
      this.#logger.error('[Interrupt] Error during shutdown', error as Error)
      process.exit(1)
    }
  }

  /**
   * Check if should stop
   */
  shouldStop(): boolean {
    return this.#interrupted
  }

  /**
   * Get interrupt reason
   */
  getReason(): string {
    return this.#interruptReason
  }

  /**
   * Manually trigger interrupt
   */
  interrupt(reason: string = 'Manual interrupt'): void {
    this.#interrupted = true
    this.#interruptReason = reason
  }

  /**
   * Reset interrupt state
   */
  reset(): void {
    this.#interrupted = false
    this.#interruptReason = ''
  }
}
