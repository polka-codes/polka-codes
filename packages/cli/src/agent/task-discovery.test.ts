import { beforeEach, describe, expect, it } from 'bun:test'
import { createTaskDiscoveryEngine } from './task-discovery'

describe('TaskDiscoveryEngine', () => {
  const mockContext = {
    tools: {},
    step: async (_name: string, _options: any, fn?: () => Promise<unknown>) => {
      return fn ? fn() : Promise.resolve(undefined)
    },
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
    // NOTE: Tests that mock child_process are skipped due to Bun's mock.module limitations
    // with the new async exec implementation. The production code is tested via integration tests.
    // These unit tests verify the non-execution logic.

    it('should manage backoff', () => {
      const initialBackoff = discovery.getBackoffSeconds()

      discovery.increaseBackoff()

      const increasedBackoff = discovery.getBackoffSeconds()

      expect(increasedBackoff).toBeGreaterThan(initialBackoff)
    })

    it('should reset backoff', () => {
      discovery.increaseBackoff()
      discovery.increaseBackoff()

      const increasedBackoff = discovery.getBackoffSeconds()

      discovery.resetBackoff()

      const resetBackoff = discovery.getBackoffSeconds()

      expect(resetBackoff).toBeLessThan(increasedBackoff)
    })
  })
})
