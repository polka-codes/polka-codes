import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'

/**
 * Manages agent sessions to prevent conflicts
 */
export class SessionManager {
  private static activeSessions: Map<string, SessionInfo> = new Map()
  private static lockDir: string = path.join(os.tmpdir(), 'polka-agent-locks')

  /**
   * Try to acquire a session
   * Returns true if successful, false if session is already active
   */
  static async acquire(sessionId: string): Promise<AcquireResult> {
    // Check in-memory active sessions
    const existingMemSession = SessionManager.activeSessions.get(sessionId)
    if (existingMemSession) {
      const age = Date.now() - existingMemSession.startTime

      if (age < 3600000) {
        // 1 hour
        return {
          acquired: false,
          reason: 'Session is already active',
          existingSession: existingMemSession,
        }
      }

      // Session is stale, remove it
      SessionManager.activeSessions.delete(sessionId)
    }

    // Check for stale lock file
    const lockFile = path.join(SessionManager.lockDir, `${sessionId}.lock`)

    try {
      const stats = await fs.stat(lockFile)
      const age = Date.now() - stats.mtimeMs

      if (age < 3600000) {
        // 1 hour
        return {
          acquired: false,
          reason: 'Session lock file exists (recent)',
          existingSession: await SessionManager.readLockFile(lockFile),
        }
      }

      // Lock file is stale, remove it
      await fs.unlink(lockFile)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
      // No lock file, safe to proceed
    }

    // Create lock file
    await fs.mkdir(SessionManager.lockDir, { recursive: true })

    const sessionInfo: SessionInfo = {
      sessionId,
      pid: process.pid,
      ppid: process.ppid,
      startTime: Date.now(),
      hostname: os.hostname(),
      username: os.userInfo().username,
    }

    await fs.writeFile(lockFile, JSON.stringify(sessionInfo, null, 2))

    // Add to in-memory sessions
    SessionManager.activeSessions.set(sessionId, sessionInfo)

    return { acquired: true, sessionInfo }
  }

  /**
   * Release a session
   */
  static async release(sessionId: string): Promise<void> {
    // Remove from in-memory
    SessionManager.activeSessions.delete(sessionId)

    // Remove lock file
    const lockFile = path.join(SessionManager.lockDir, `${sessionId}.lock`)

    try {
      await fs.unlink(lockFile)
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * List all active sessions
   */
  static listActive(): SessionInfo[] {
    return Array.from(SessionManager.activeSessions.values())
  }

  /**
   * Check if a session is active
   */
  static isActive(sessionId: string): boolean {
    return SessionManager.activeSessions.has(sessionId)
  }

  /**
   * Get session info
   */
  static getSession(sessionId: string): SessionInfo | undefined {
    return SessionManager.activeSessions.get(sessionId)
  }

  /**
   * Read lock file
   */
  private static async readLockFile(lockFile: string): Promise<SessionInfo> {
    const content = await fs.readFile(lockFile, 'utf-8')
    return JSON.parse(content)
  }
}

/**
 * Session acquisition result
 */
export interface AcquireResult {
  acquired: boolean
  reason?: string
  sessionInfo?: SessionInfo
  existingSession?: SessionInfo
}

/**
 * Session information
 */
export interface SessionInfo {
  sessionId: string
  pid: number
  ppid: number
  startTime: number
  hostname: string
  username: string
}
