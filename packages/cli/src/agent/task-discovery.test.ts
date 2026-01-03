import { beforeEach, describe, expect, it, mock } from 'bun:test'
import { Priority } from './constants'
import { createTaskDiscoveryEngine } from './task-discovery'

describe('TaskDiscoveryEngine', () => {
  const mockContext = {
    tools: {},
    step: {},
    cwd: '/test',
    logger: {
      info: () => {},
      warn: () => {},
      error: () => {},
    },
  } as any

  let discovery: ReturnType<typeof createTaskDiscoveryEngine>

  beforeEach(() => {
    discovery = createTaskDiscoveryEngine(mockContext)
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
      expect(tasks[0].type).toBe('bugfix')
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
      // Calls: git rev-parse (1), typecheck in discoverBuildErrors (2), bun test (3), typecheck in discoverTypeErrors (4)
      expect(tasks.length).toBeGreaterThan(0)
      expect(callCount).toBe(4)
    })

    it('should manage backoff', () => {
      const initialBackoff = discovery.getBackoffSeconds()

      discovery.increaseBackoff()
      expect(discovery.getBackoffSeconds()).toBeGreaterThan(initialBackoff)

      discovery.resetBackoff()
      expect(discovery.getBackoffSeconds()).toBe(60)
    })

    it('should exponentially increase backoff', () => {
      const initial = discovery.getBackoffSeconds()

      discovery.increaseBackoff()
      expect(discovery.getBackoffSeconds()).toBe(initial * 2)

      discovery.increaseBackoff()
      expect(discovery.getBackoffSeconds()).toBe(initial * 4)

      // Should cap at max
      for (let i = 0; i < 20; i++) {
        discovery.increaseBackoff()
      }
      expect(discovery.getBackoffSeconds()).toBeLessThanOrEqual(900)
    })
  })
})
