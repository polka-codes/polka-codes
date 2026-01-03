import { beforeEach, describe, expect, it } from 'bun:test'
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { acquire, getSession, isActive, listActive, release, SessionManager } from './session'

describe('session', () => {
  // Global cleanup to ensure tests don't interfere with each other
  beforeEach(async () => {
    // Clear all in-memory sessions
    const sessions = listActive()
    for (const s of sessions) {
      await release(s.sessionId)
    }

    // Also clean up any stale lock files
    const lockDir = path.join(os.tmpdir(), 'polka-agent-locks')
    try {
      const files = await fs.readdir(lockDir)
      for (const file of files) {
        if (file.endsWith('.lock')) {
          await fs.unlink(path.join(lockDir, file)).catch(() => {})
        }
      }
    } catch {
      // Directory doesn't exist, that's fine
    }
  })

  describe('acquire', () => {
    it('should acquire new session successfully', async () => {
      const result = await acquire('test-session-acquire')

      expect(result.acquired).toBe(true)
      expect(result.sessionInfo).toBeDefined()
      expect(result.sessionInfo?.sessionId).toBe('test-session-acquire')
      expect(result.sessionInfo?.pid).toBeDefined()
      expect(result.sessionInfo?.startTime).toBeDefined()
    })

    it('should fail to acquire already active session', async () => {
      await acquire('test-session-duplicate')
      const result = await acquire('test-session-duplicate')

      expect(result.acquired).toBe(false)
      expect(result.reason).toBe('Session is already active')
      expect(result.existingSession).toBeDefined()
    })

    it('should include hostname in session info', async () => {
      const result = await acquire('test-session-hostname')

      expect(result.sessionInfo?.hostname).toBeDefined()
      expect(typeof result.sessionInfo?.hostname).toBe('string')
    })

    it('should include username in session info', async () => {
      const result = await acquire('test-session-username')

      expect(result.sessionInfo?.username).toBeDefined()
      expect(typeof result.sessionInfo?.username).toBe('string')
    })

    it('should include parent PID in session info', async () => {
      const result = await acquire('test-session-ppid')

      expect(result.sessionInfo?.ppid).toBeDefined()
      expect(typeof result.sessionInfo?.ppid).toBe('number')
    })
  })

  describe('release', () => {
    it('should release active session', async () => {
      await acquire('test-session-release')
      await release('test-session-release')

      expect(isActive('test-session-release')).toBe(false)
    })

    it('should handle releasing non-existent session gracefully', async () => {
      // Should not throw
      await release('non-existent-session')

      expect(isActive('non-existent-session')).toBe(false)
    })

    it('should allow re-acquiring after release', async () => {
      await acquire('test-session-reacquire')
      await release('test-session-reacquire')

      const result = await acquire('test-session-reacquire')
      expect(result.acquired).toBe(true)
    })
  })

  describe('isActive', () => {
    it('should return false for non-existent session', () => {
      expect(isActive('test-session-not-active')).toBe(false)
    })

    it('should return true for active session', async () => {
      await acquire('test-session-active')

      expect(isActive('test-session-active')).toBe(true)
    })

    it('should return false after release', async () => {
      await acquire('test-session-after-release')
      await release('test-session-after-release')

      expect(isActive('test-session-after-release')).toBe(false)
    })
  })

  describe('getSession', () => {
    it('should return undefined for non-existent session', () => {
      const session = getSession('test-session-not-exist')

      expect(session).toBeUndefined()
    })

    it('should return session info for active session', async () => {
      await acquire('test-session-get')
      const session = getSession('test-session-get')

      expect(session).toBeDefined()
      expect(session?.sessionId).toBe('test-session-get')
    })

    it('should return session with all required fields', async () => {
      await acquire('test-session-fields')
      const session = getSession('test-session-fields')

      expect(session?.sessionId).toBeDefined()
      expect(session?.pid).toBeDefined()
      expect(session?.ppid).toBeDefined()
      expect(session?.startTime).toBeDefined()
      expect(session?.hostname).toBeDefined()
      expect(session?.username).toBeDefined()
    })
  })

  describe('listActive', () => {
    it('should return empty array when no sessions', async () => {
      // Clear any existing sessions from other tests
      const sessions = listActive()
      for (const s of sessions) {
        await release(s.sessionId)
      }

      const emptyList = listActive()
      expect(emptyList).toEqual([])
    })

    it('should list all active sessions', async () => {
      const _result1 = await acquire('session-list-1')
      const _result2 = await acquire('session-list-2')
      const _result3 = await acquire('session-list-3')

      const sessions = listActive()

      expect(sessions.length).toBeGreaterThanOrEqual(3)
      const sessionIds = sessions.map((s) => s.sessionId)
      expect(sessionIds).toContain('session-list-1')
      expect(sessionIds).toContain('session-list-2')
      expect(sessionIds).toContain('session-list-3')

      // Cleanup
      await release('session-list-1')
      await release('session-list-2')
      await release('session-list-3')
    })

    it('should not include released sessions', async () => {
      await acquire('session-list-release-1')
      await acquire('session-list-release-2')

      await release('session-list-release-1')

      const sessions = listActive()
      const sessionIds = sessions.map((s) => s.sessionId)

      expect(sessionIds).not.toContain('session-list-release-1')
      expect(sessionIds).toContain('session-list-release-2')

      // Cleanup
      await release('session-list-release-2')
    })
  })

  describe('SessionManager (deprecated namespace)', () => {
    it('should provide acquire function', () => {
      expect(SessionManager.acquire).toBeDefined()
      expect(typeof SessionManager.acquire).toBe('function')
    })

    it('should provide release function', () => {
      expect(SessionManager.release).toBeDefined()
      expect(typeof SessionManager.release).toBe('function')
    })

    it('should provide listActive function', () => {
      expect(SessionManager.listActive).toBeDefined()
      expect(typeof SessionManager.listActive).toBe('function')
    })

    it('should provide isActive function', () => {
      expect(SessionManager.isActive).toBeDefined()
      expect(typeof SessionManager.isActive).toBe('function')
    })

    it('should provide getSession function', () => {
      expect(SessionManager.getSession).toBeDefined()
      expect(typeof SessionManager.getSession).toBe('function')
    })

    it('should work with namespace API', async () => {
      const result = await SessionManager.acquire('namespace-test')

      expect(result.acquired).toBe(true)

      await SessionManager.release('namespace-test')

      expect(SessionManager.isActive('namespace-test')).toBe(false)
    })
  })

  describe('session lifecycle', () => {
    it('should handle full lifecycle', async () => {
      const sessionId = 'lifecycle-full-test'

      // Initial state
      expect(isActive(sessionId)).toBe(false)

      // Acquire
      const acquireResult = await acquire(sessionId)
      expect(acquireResult.acquired).toBe(true)
      expect(isActive(sessionId)).toBe(true)

      // Get session info
      const session = getSession(sessionId)
      expect(session).toBeDefined()

      // Release
      await release(sessionId)
      expect(isActive(sessionId)).toBe(false)
      expect(getSession(sessionId)).toBeUndefined()
    })

    it('should handle multiple concurrent sessions', async () => {
      const id1 = 'concurrent-session-1'
      const id2 = 'concurrent-session-2'
      const id3 = 'concurrent-session-3'

      await acquire(id1)
      await acquire(id2)
      await acquire(id3)

      expect(isActive(id1)).toBe(true)
      expect(isActive(id2)).toBe(true)
      expect(isActive(id3)).toBe(true)

      await release(id2)

      expect(isActive(id1)).toBe(true)
      expect(isActive(id2)).toBe(false)
      expect(isActive(id3)).toBe(true)
    })
  })
})
