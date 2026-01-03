/**
 * Progress indicators for long-running operations
 *
 * Provides simple text-based progress bars and spinners
 * for user feedback during long operations.
 */

/**
 * Progress bar configuration
 */
export interface ProgressOptions {
  /** Total steps/units to complete */
  total: number
  /** Current progress */
  current?: number
  /** Progress bar width (in characters) */
  width?: number
  /** Custom label */
  label?: string
  /** Show percentage */
  showPercentage?: boolean
  /** Show ETA */
  showETA?: boolean
}

/**
 * Progress tracker
 */
export class Progress {
  private startTime: number
  private current: number

  constructor(private options: ProgressOptions) {
    this.current = options.current || 0
    this.startTime = Date.now()
  }

  /**
   * Update progress
   */
  update(increment: number = 1): void {
    this.current += increment

    if (process.stdout.isTTY) {
      this.render()
    }
  }

  /**
   * Set current progress
   */
  set(value: number): void {
    this.current = value

    if (process.stdout.isTTY) {
      this.render()
    }
  }

  /**
   * Increment progress by 1
   */
  tick(): void {
    this.update(1)
  }

  /**
   * Render progress bar
   */
  private render(): void {
    const { total, width = 40, label, showPercentage = true, showETA = false } = this.options

    // Calculate percentage
    const percentage = Math.min((this.current / total) * 100, 100)

    // Calculate filled width
    const filledWidth = Math.floor((this.current / total) * width)
    const emptyWidth = width - filledWidth

    // Build bar
    const filled = '█'.repeat(filledWidth)
    const empty = '░'.repeat(emptyWidth)
    const bar = `[${filled}${empty}]`

    // Build output
    let output = ''

    if (label) {
      output += `${label} `
    }

    output += bar

    if (showPercentage) {
      output += ` ${percentage.toFixed(1)}%`
    }

    output += ` (${this.current}/${total})`

    if (showETA && this.current > 0) {
      const eta = this.calculateETA()
      if (eta) {
        output += ` ETA: ${eta}`
      }
    }

    // Clear line and render
    process.stdout.write(`\r${output}`)

    // Clear line if complete
    if (this.current >= total) {
      process.stdout.write('\n')
    }
  }

  /**
   * Calculate estimated time to completion
   */
  private calculateETA(): string | null {
    if (this.current === 0) return null

    const elapsed = Date.now() - this.startTime
    const rate = this.current / elapsed
    const remaining = this.options.total - this.current
    const eta = remaining / rate

    return formatDuration(eta)
  }

  /**
   * Complete the progress bar
   */
  complete(): void {
    this.current = this.options.total
    this.render()
  }
}

/**
 * Simple spinner for operations without known progress
 */
export class Spinner {
  private frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
  private frameIndex = 0
  private intervalId?: NodeJS.Timeout
  private isActive = false

  constructor(private message: string) {}

  /**
   * Start the spinner
   */
  start(): void {
    if (!process.stdout.isTTY || this.isActive) return

    this.isActive = true
    this.intervalId = setInterval(() => {
      const frame = this.frames[this.frameIndex]
      process.stdout.write(`\r${frame} ${this.message}`)
      this.frameIndex = (this.frameIndex + 1) % this.frames.length
    }, 80)
  }

  /**
   * Update the spinner message
   */
  update(message: string): void {
    this.message = message
  }

  /**
   * Stop the spinner with success message
   */
  succeed(message?: string): void {
    this.stop(message || `✓ ${this.message}`)
  }

  /**
   * Stop the spinner with error message
   */
  fail(message?: string): void {
    this.stop(message || `✗ ${this.message}`)
  }

  /**
   * Stop the spinner
   */
  private stop(finalMessage: string): void {
    if (!this.isActive) return

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = undefined
    }

    this.isActive = false
    process.stdout.write(`\r${finalMessage}\n`)
  }
}

/**
 * Multi-progress for tracking multiple operations
 *
 * WARNING: This implementation has a known limitation with concurrent updates.
 * Since each Progress bar writes to stdout using \r (carriage return), multiple
 * bars updating concurrently will overwrite each other's visual output.
 *
 * Current Behavior:
 * - Each bar renders independently with \r to update its line
 * - Concurrent updates result in visual corruption/overwrites
 *
 * Suitable Use Cases:
 * - Sequential progress bars (one completes before next starts)
 * - Non-concurrent updates (manual coordination of update timing)
 * - Debug/development scenarios where visual corruption is acceptable
 *
 * Not Suitable For:
 * - Parallel operations with simultaneous progress updates
 * - Production environments requiring clean multi-line progress
 *
 * For proper multi-progress rendering, consider using a dedicated library
 * like 'cli-progress' or 'multi-progress' which handles line coordination.
 */
export class MultiProgress {
  private progressBars: Map<string, Progress> = new Map()

  /**
   * Create or get a progress bar
   */
  create(id: string, options: ProgressOptions): Progress {
    const progress = new Progress(options)
    this.progressBars.set(id, progress)
    return progress
  }

  /**
   * Update a progress bar
   */
  update(id: string, increment: number = 1): void {
    const progress = this.progressBars.get(id)
    if (progress) {
      progress.update(increment)
    }
  }

  /**
   * Complete a progress bar
   */
  complete(id: string): void {
    const progress = this.progressBars.get(id)
    if (progress) {
      progress.complete()
    }
  }

  /**
   * Remove a progress bar
   */
  remove(id: string): void {
    this.progressBars.delete(id)
  }
}

/**
 * Format duration in milliseconds to human-readable string
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`
  }

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`
  }

  return `${seconds}s`
}

/**
 * Create a progress bar
 */
export function createProgress(options: ProgressOptions): Progress {
  return new Progress(options)
}

/**
 * Create a spinner
 */
export function createSpinner(message: string): Spinner {
  return new Spinner(message)
}

/**
 * Create a multi-progress tracker
 */
export function createMultiProgress(): MultiProgress {
  return new MultiProgress()
}
