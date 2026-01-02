import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { Priority } from './constants'
import { TaskDiscoveryEngine } from './task-discovery'

describe('TaskDiscoveryEngine', () => {
  const mockContext = {
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  }

  let discovery: TaskDiscoveryEngine

  beforeEach(() => {
    discovery = new TaskDiscoveryEngine(mockContext)
  })

  describe('discover', () => {
    it('should discover build errors', async () => {
      mock.module('child_process', () => ({
        execSync: () => {
          throw new Error('Type error: test.ts(5,1): error TS1234')
        },
      }))

      mock.module('fs/promises', () => ({
        default: {
          access: () => Promise.reject(),
          mkdir: () => Promise.resolve(),
          writeFile: () => Promise.resolve(),
        },
      }))

      const tasks = await discovery.discover({ useCache: false })

      expect(tasks.length).toBeGreaterThan(0)
      expect(tasks[0].type).toBe('fix')
      expect(tasks[0].priority).toBe(Priority.HIGH)
      expect(tasks[0].title).toContain('TypeScript')
    })

    it('should skip tests when build errors exist', async () => {
      let callCount = 0
      mock.module('child_process', () => ({
        execSync: (cmd: string) => {
          callCount++
          if (cmd.includes('typecheck')) {
            throw new Error('Build failed')
          }
          return ''
        },
      }))

      const tasks = await discovery.discover({ useCache: false })

      // Should stop after typecheck failure
      expect(tasks.length).toBeGreaterThan(0)
      expect(callCount).toBeLessThan(3)
    })

    it('should discover test failures', async () => {
      mock.module('child_process', () => ({
        execSync: (cmd: string) => {
          if (cmd.includes('typecheck')) {
            return '' // Types pass
          }
          if (cmd.includes('test')) {
            throw new Error('✗ test should pass\n✗ another test failed')
          }
          return ''
        },
      }))

      const tasks = await discovery.discover({ useCache: false })

      const testTask = tasks.find((t) => t.title.includes('test'))
      expect(testTask).toBeDefined()
      expect(testTask?.type).toBe('fix')
      expect(testTask?.priority).toBe(Priority.HIGH)
    })

    it('should discover type errors', async () => {
      mock.module('child_process', () => ({
        execSync: (cmd: string) => {
          if (cmd.includes('lint')) {
            return '' // No lint issues
          }
          if (cmd.includes('test')) {
            return '' // Tests pass
          }
          if (cmd.includes('typecheck')) {
            throw new Error("error TS2322: Type 'string' is not assignable to type 'number'")
          }
          return ''
        },
      }))

      const tasks = await discovery.discover({ useCache: false })

      const typeTask = tasks.find((t) => t.title.includes('TypeScript'))
      expect(typeTask).toBeDefined()
      expect(typeTask?.priority).toBe(Priority.HIGH)
    })

    it('should discover lint issues', async () => {
      mock.module('child_process', () => ({
        execSync: (cmd: string) => {
          if (cmd.includes('lint')) {
            throw new Error('src/test.ts:5:3 - Missing semicolon\nsrc/other.ts:10:1 - Unused var')
          }
          return ''
        },
      }))

      const tasks = await discovery.discover({ useCache: false })

      const lintTask = tasks.find((t) => t.title.includes('lint'))
      expect(lintTask).toBeDefined()
      expect(lintTask?.priority).toBe(Priority.LOW)
      expect(lintTask?.files).toContain('src/test.ts')
      expect(lintTask?.files).toContain('src/other.ts')
    })

    it('should use cache when available', async () => {
      const cachedTasks = [
        {
          id: 'cached-1',
          title: 'Cached task',
          description: '',
          type: 'fix' as const,
          priority: Priority.MEDIUM,
          complexity: 'low' as const,
          estimatedTime: 30,
          status: 'pending' as const,
          workflow: 'code' as const,
          workflowInput: {},
          dependencies: [],
          files: [],
          createdAt: Date.now(),
          metadata: {},
        },
      ]

      mock.module('fs/promises', () => ({
        default: {
          access: () => Promise.resolve(),
          readFile: () =>
            Promise.resolve(
              JSON.stringify({
                gitHead: 'abc123',
                timestamp: Date.now(),
                discoveredTasks: cachedTasks,
              }),
            ),
          mkdir: () => Promise.resolve(),
          writeFile: () => Promise.resolve(),
        },
      }))

      mock.module('child_process', () => ({
        execSync: () => 'abc123', // Git head matches
      }))

      const tasks = await discovery.discover({ useCache: true })

      expect(tasks).toEqual(cachedTasks)
    })

    it('should invalidate cache on git changes', async () => {
      mock.module('fs/promises', () => ({
        default: {
          access: () => Promise.resolve(),
          readFile: () =>
            Promise.resolve(
              JSON.stringify({
                gitHead: 'old-commit',
                timestamp: Date.now(),
                discoveredTasks: [],
              }),
            ),
          mkdir: () => Promise.resolve(),
          writeFile: () => Promise.resolve(),
        },
      }))

      mock.module('child_process', () => ({
        execSync: () => 'new-commit', // Git head changed
      }))

      const tasks = await discovery.discover({ useCache: true })

      // Should return empty since no actual discoveries in this test
      expect(tasks).toBeDefined()
    })
  })

  describe('backoff management', () => {
    it('should increase backoff exponentially', () => {
      const initial = discovery.getBackoffSeconds()

      discovery.increaseBackoff()
      expect(discovery.getBackoffSeconds()).toBe(initial * 2)

      discovery.increaseBackoff()
      expect(discovery.getBackoffSeconds()).toBe(initial * 4)
    })

    it('should cap backoff at maximum', () => {
      // Set to near max
      for (let i = 0; i < 20; i++) {
        discovery.increaseBackoff()
      }

      expect(discovery.getBackoffSeconds()).toBe(900) // 15 minutes max
    })

    it('should reset backoff', () => {
      discovery.increaseBackoff()
      discovery.increaseBackoff()

      discovery.resetBackoff()

      expect(discovery.getBackoffSeconds()).toBe(60)
    })
  })

  describe('parseTestFailures', () => {
    it('should extract test failures from output', () => {
      const output = `
        ✓ test 1 passes
        ✗ test 2 fails
        ✓ test 3 passes
        ✗ test 4 fails with error
      `

      const failures = discovery.parseTestFailures(output)

      expect(failures.length).toBeGreaterThan(0)
      expect(failures.some((f) => f.includes('test 2'))).toBe(true)
      expect(failures.some((f) => f.includes('test 4'))).toBe(true)
    })
  })

  describe('parseLintFiles', () => {
    it('should extract file paths from lint output', () => {
      const output = `
        src/test.ts:5:3 - Missing semicolon
        src/other.ts:10:1 - Unused variable
        lib/helper.js:2:5 - Use const
      `

      const files = discovery.parseLintFiles(output)

      expect(files).toContain('src/test.ts')
      expect(files).toContain('src/other.ts')
      expect(files).toContain('lib/helper.js')
    })

    it('should deduplicate files', () => {
      const output = `
        src/test.ts:5:3 - Error 1
        src/test.ts:10:1 - Error 2
      `

      const files = discovery.parseLintFiles(output)

      expect(files.filter((f) => f === 'src/test.ts').length).toBe(1)
    })
  })

  describe('generateId', () => {
    it('should generate unique IDs', () => {
      const id1 = discovery.generateId('test')
      const id2 = discovery.generateId('test')

      expect(id1).not.toBe(id2)
      expect(id1).toMatch(/^test-\d+-[a-z0-9]+$/)
      expect(id2).toMatch(/^test-\d+-[a-z0-9]+$/)
    })
  })
})
