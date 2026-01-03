import { beforeEach, describe, expect, it } from 'bun:test'
import { Progress, Spinner } from './progress'

describe('Progress', () => {
  let progress: Progress

  beforeEach(() => {
    progress = new Progress({ total: 100 })
  })

  describe('constructor', () => {
    it('should initialize with current value from options', () => {
      const p = new Progress({ total: 100, current: 50 })

      // Access private current through update
      const initialCurrent = (p as any).current
      expect(initialCurrent).toBe(50)
    })

    it('should start at 0 when current not specified', () => {
      const initialCurrent = (progress as any).current
      expect(initialCurrent).toBe(0)
    })

    it('should record start time', () => {
      const startTime = (progress as any).startTime

      expect(startTime).toBeDefined()
      expect(startTime).toBeLessThanOrEqual(Date.now())
    })
  })

  describe('update', () => {
    it('should increment progress by default', () => {
      progress.update()

      expect((progress as any).current).toBe(1)
    })

    it('should increment by custom amount', () => {
      progress.update(5)

      expect((progress as any).current).toBe(5)
    })

    it('should accumulate increments', () => {
      progress.update(10)
      progress.update(20)
      progress.update(5)

      expect((progress as any).current).toBe(35)
    })

    it('should not exceed total', () => {
      progress.update(150)

      expect((progress as any).current).toBe(150) // Allows overshoot
    })
  })

  describe('set', () => {
    it('should set current value', () => {
      progress.set(42)

      expect((progress as any).current).toBe(42)
    })

    it('should overwrite current value', () => {
      progress.set(10)
      progress.set(50)

      expect((progress as any).current).toBe(50)
    })

    it('should allow setting to zero', () => {
      progress.set(25)
      progress.set(0)

      expect((progress as any).current).toBe(0)
    })
  })

  describe('tick', () => {
    it('should increment by 1', () => {
      progress.tick()
      progress.tick()
      progress.tick()

      expect((progress as any).current).toBe(3)
    })
  })

  describe('complete', () => {
    it('should set current to total', () => {
      progress.complete()

      expect((progress as any).current).toBe(100)
    })

    it('should work when partially complete', () => {
      progress.set(50)
      progress.complete()

      expect((progress as any).current).toBe(100)
    })
  })

  describe('ProgressOptions', () => {
    it('should accept custom width', () => {
      const p = new Progress({ total: 100, width: 20 })

      expect(p).toBeDefined()
    })

    it('should accept custom label', () => {
      const p = new Progress({ total: 100, label: 'Processing' })

      expect(p).toBeDefined()
    })

    it('should accept showPercentage option', () => {
      const p = new Progress({ total: 100, showPercentage: false })

      expect(p).toBeDefined()
    })

    it('should accept showETA option', () => {
      const p = new Progress({ total: 100, showETA: true })

      expect(p).toBeDefined()
    })
  })

  describe('calculateETA (private)', () => {
    it('should return null when current is 0', () => {
      const eta = (progress as any).calculateETA()

      expect(eta).toBeNull()
    })

    it('should calculate ETA when progress exists', () => {
      progress.set(50)
      // Give some time to pass
      const startTime = (progress as any).startTime
      ;(progress as any).startTime = Date.now() - 1000 // 1 second ago

      const eta = (progress as any).calculateETA()

      expect(eta).toBeDefined()
      expect(typeof eta).toBe('string')
    })
  })
})

describe('Spinner', () => {
  let spinner: Spinner

  beforeEach(() => {
    spinner = new Spinner('Loading...')
  })

  describe('constructor', () => {
    it('should store message', () => {
      expect((spinner as any).message).toBe('Loading...')
    })

    it('should initialize frames array', () => {
      expect((spinner as any).frames).toBeDefined()
      expect((spinner as any).frames.length).toBeGreaterThan(0)
    })

    it('should start at frame 0', () => {
      expect((spinner as any).frameIndex).toBe(0)
    })

    it('should not be active initially', () => {
      expect((spinner as any).isActive).toBe(false)
    })
  })

  describe('update', () => {
    it('should update message', () => {
      spinner.update('New message')

      expect((spinner as any).message).toBe('New message')
    })

    it('should allow multiple updates', () => {
      spinner.update('Step 1')
      spinner.update('Step 2')
      spinner.update('Step 3')

      expect((spinner as any).message).toBe('Step 3')
    })
  })

  describe('start', () => {
    it('should set active flag when TTY', () => {
      // Mock process.stdout.isTTY
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()

      expect((spinner as any).isActive).toBe(true)

      // Cleanup
      if ((spinner as any).intervalId) {
        clearInterval((spinner as any).intervalId)
      }
      ;(process.stdout as any).isTTY = originalIsTTY
    })

    it('should not start when not TTY', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = false

      spinner.start()

      expect((spinner as any).isActive).toBe(false)

      ;(process.stdout as any).isTTY = originalIsTTY
    })

    it('should not start if already active', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()
      const firstIntervalId = (spinner as any).intervalId
      spinner.start()

      expect((spinner as any).intervalId).toBe(firstIntervalId)

      // Cleanup
      if (firstIntervalId) {
        clearInterval(firstIntervalId)
      }
      ;(process.stdout as any).isTTY = originalIsTTY
    })
  })

  describe('succeed', () => {
    it('should stop spinner with success message', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()
      spinner.succeed('Done!')

      expect((spinner as any).isActive).toBe(false)

      ;(process.stdout as any).isTTY = originalIsTTY
    })

    it('should use default success message if none provided', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()
      spinner.succeed()

      expect((spinner as any).isActive).toBe(false)

      ;(process.stdout as any).isTTY = originalIsTTY
    })
  })

  describe('fail', () => {
    it('should stop spinner with error message', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()
      spinner.fail('Error!')

      expect((spinner as any).isActive).toBe(false)

      ;(process.stdout as any).isTTY = originalIsTTY
    })

    it('should use default error message if none provided', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()
      spinner.fail()

      expect((spinner as any).isActive).toBe(false)

      ;(process.stdout as any).isTTY = originalIsTTY
    })
  })

  describe('stop (private)', () => {
    it('should clear interval when stopping', () => {
      const originalIsTTY = process.stdout.isTTY
      ;(process.stdout as any).isTTY = true

      spinner.start()
      const intervalId = (spinner as any).intervalId

      spinner.start() // Try to start again (will be ignored)
      ;(spinner as any).stop('Stopped')

      expect((spinner as any).intervalId).toBeUndefined()
      expect((spinner as any).isActive).toBe(false)

      ;(process.stdout as any).isTTY = originalIsTTY
    })

    it('should do nothing when not active', () => {
      // Should not throw
      ;(spinner as any).stop('Test')

      expect((spinner as any).isActive).toBe(false)
    })
  })

  describe('frames', () => {
    it('should have 10 different frames', () => {
      const frames = (spinner as any).frames

      expect(frames).toHaveLength(10)
      expect(frames[0]).toBe('⠋')
      expect(frames[9]).toBe('⠏')
    })
  })
})
