import { beforeEach, describe, expect, it } from 'bun:test'
import { DEFAULT_DEBUG_CONFIG, DebugCategory, DebugLevel, DebugLogger } from './debug-logger'

describe('DebugLogger', () => {
  let mockLogger: any
  let debugLogs: string[]

  beforeEach(() => {
    debugLogs = []
    mockLogger = {
      debug: (msg: string) => {
        debugLogs.push(msg)
      },
    }
  })

  describe('constructor', () => {
    it('should use default config when none provided', () => {
      const logger = new DebugLogger(mockLogger)

      expect(logger).toBeDefined()
    })

    it('should merge provided config with defaults', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.VERBOSE,
        categories: [DebugCategory.WORKFLOW],
      })

      expect(logger).toBeDefined()
    })

    it('should initialize with empty debug buffer', () => {
      const logger = new DebugLogger(mockLogger)

      expect(logger).toBeDefined()
    })
  })

  describe('updateConfig', () => {
    it('should update configuration', () => {
      const logger = new DebugLogger(mockLogger)
      logger.updateConfig({ level: DebugLevel.TRACE, categories: [DebugCategory.WORKFLOW] })

      logger.basic(DebugCategory.WORKFLOW, 'test')
      logger.verbose(DebugCategory.WORKFLOW, 'test')
      logger.trace(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs.length).toBe(3)
    })

    it('should update categories', () => {
      const logger = new DebugLogger(mockLogger, { level: DebugLevel.BASIC })
      logger.updateConfig({ categories: [DebugCategory.EXECUTOR] })

      logger.basic(DebugCategory.EXECUTOR, 'test')
      logger.basic(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('[executor]')
    })
  })

  describe('isCategoryEnabled', () => {
    it('should return false when debug level is NONE', () => {
      const logger = new DebugLogger(mockLogger, { level: DebugLevel.NONE })

      expect(logger.isCategoryEnabled(DebugCategory.WORKFLOW)).toBe(false)
    })

    it('should return true when ALL category is enabled', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      expect(logger.isCategoryEnabled(DebugCategory.WORKFLOW)).toBe(true)
      expect(logger.isCategoryEnabled(DebugCategory.EXECUTOR)).toBe(true)
    })

    it('should return true for specific enabled category', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.WORKFLOW],
      })

      expect(logger.isCategoryEnabled(DebugCategory.WORKFLOW)).toBe(true)
      expect(logger.isCategoryEnabled(DebugCategory.EXECUTOR)).toBe(false)
    })

    it('should return false for disabled category', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.EXECUTOR],
      })

      expect(logger.isCategoryEnabled(DebugCategory.WORKFLOW)).toBe(false)
    })
  })

  describe('basic', () => {
    it('should not log when level is below BASIC', () => {
      const logger = new DebugLogger(mockLogger, { level: DebugLevel.NONE })

      logger.basic(DebugCategory.WORKFLOW, 'test message')

      expect(debugLogs.length).toBe(0)
    })

    it('should log when level is BASIC', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.basic(DebugCategory.WORKFLOW, 'test message')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('[DEBUG]')
      expect(debugLogs[0]).toContain('[workflow]')
      expect(debugLogs[0]).toContain('test message')
    })

    it('should include data in log', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.basic(DebugCategory.WORKFLOW, 'test', { key: 'value' })

      expect(debugLogs[0]).toContain('key')
      expect(debugLogs[0]).toContain('value')
    })
  })

  describe('verbose', () => {
    it('should not log when level is BASIC', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.verbose(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs.length).toBe(0)
    })

    it('should log when level is VERBOSE', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.VERBOSE,
        categories: [DebugCategory.ALL],
      })

      logger.verbose(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('[VERBOSE]')
    })
  })

  describe('trace', () => {
    it('should not log when level is VERBOSE', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.VERBOSE,
        categories: [DebugCategory.ALL],
      })

      logger.trace(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs.length).toBe(0)
    })

    it('should log when level is TRACE', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.TRACE,
        categories: [DebugCategory.ALL],
      })

      logger.trace(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('[TRACE]')
    })
  })

  describe('error', () => {
    it('should log errors with category', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      const error = new Error('Test error')
      logger.error(DebugCategory.WORKFLOW, 'Something failed', error)

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('[ERROR]')
      expect(debugLogs[0]).toContain('Something failed')
      expect(debugLogs[0]).toContain('Test error')
    })

    it('should handle non-Error objects', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.error(DebugCategory.WORKFLOW, 'Failed', 'string error')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('string error')
    })
  })

  describe('enter', () => {
    it('should log function entry with arrow', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.VERBOSE,
        categories: [DebugCategory.ALL],
      })

      logger.enter(DebugCategory.WORKFLOW, 'testFunction', { arg: 1 })

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('→ testFunction')
      expect(debugLogs[0]).toContain('[VERBOSE]')
    })
  })

  describe('exit', () => {
    it('should log function exit with arrow', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.VERBOSE,
        categories: [DebugCategory.ALL],
      })

      logger.exit(DebugCategory.WORKFLOW, 'testFunction', { result: 'done' })

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('← testFunction')
    })
  })

  describe('stateTransition', () => {
    it('should log state transitions', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.stateTransition('idle', 'executing')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('State transition: idle → executing')
      expect(debugLogs[0]).toContain('[state]')
    })
  })

  describe('workflow', () => {
    it('should log workflow execution', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.workflow('code', { prompt: 'fix bug' }, { success: true })

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('Workflow: code')
      expect(debugLogs[0]).toContain('prompt')
    })
  })

  describe('task', () => {
    it('should log task actions', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
      })

      logger.task('task-1', 'started')

      expect(debugLogs.length).toBe(1)
      expect(debugLogs[0]).toContain('Task task-1: started')
      expect(debugLogs[0]).toContain('[executor]')
    })
  })

  describe('timestamps', () => {
    it('should include timestamps when enabled', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
        timestamps: true,
      })

      logger.basic(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs[0]).toMatch(/\d{4}-\d{2}-\d{2}T/)
    })

    it('should not include timestamps when disabled', () => {
      const logger = new DebugLogger(mockLogger, {
        level: DebugLevel.BASIC,
        categories: [DebugCategory.ALL],
        timestamps: false,
      })

      logger.basic(DebugCategory.WORKFLOW, 'test')

      expect(debugLogs[0]).not.toMatch(/\d{4}-\d{2}-\d{2}T/)
    })
  })

  describe('DEFAULT_DEBUG_CONFIG', () => {
    it('should have level NONE by default', () => {
      expect(DEFAULT_DEBUG_CONFIG.level).toBe(DebugLevel.NONE)
    })

    it('should have empty categories array by default', () => {
      expect(DEFAULT_DEBUG_CONFIG.categories).toEqual([])
    })

    it('should have timestamps enabled by default', () => {
      expect(DEFAULT_DEBUG_CONFIG.timestamps).toBe(true)
    })

    it('should have stack traces disabled by default', () => {
      expect(DEFAULT_DEBUG_CONFIG.stackTraces).toBe(false)
    })
  })

  describe('DebugLevel enum', () => {
    it('should have correct values', () => {
      expect(DebugLevel.NONE).toBe(0)
      expect(DebugLevel.BASIC).toBe(1)
      expect(DebugLevel.VERBOSE).toBe(2)
      expect(DebugLevel.TRACE).toBe(3)
    })
  })

  describe('DebugCategory enum', () => {
    it('should have workflow category', () => {
      expect(DebugCategory.WORKFLOW).toBeDefined()
      expect(DebugCategory.WORKFLOW as string).toBe('workflow')
    })

    it('should have state category', () => {
      expect(DebugCategory.STATE).toBeDefined()
      expect(DebugCategory.STATE as string).toBe('state')
    })

    it('should have executor category', () => {
      expect(DebugCategory.EXECUTOR).toBeDefined()
      expect(DebugCategory.EXECUTOR as string).toBe('executor')
    })

    it('should have planner category', () => {
      expect(DebugCategory.PLANNER).toBeDefined()
      expect(DebugCategory.PLANNER as string).toBe('planner')
    })

    it('should have discovery category', () => {
      expect(DebugCategory.DISCOVERY).toBeDefined()
      expect(DebugCategory.DISCOVERY as string).toBe('discovery')
    })

    it('should have ALL wildcard', () => {
      expect(DebugCategory.ALL).toBeDefined()
      expect(DebugCategory.ALL as string).toBe('*')
    })
  })
})
