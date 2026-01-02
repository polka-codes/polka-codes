import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { StateCorruptionError } from './errors'
import type { AgentConfig, AgentState, Task } from './types'

/**
 * Manages agent state persistence with immutable updates
 */
export class AgentStateManager {
  private state: AgentState | null = null
  private stateFilePath: string
  private saveTimer: NodeJS.Timeout | null = null
  private checkpointDir: string

  constructor(stateDir: string, _sessionId: string) {
    this.stateFilePath = path.join(stateDir, 'agent-state.json')
    this.checkpointDir = path.join(stateDir, 'checkpoints')
  }

  /**
   * Initialize a new agent state
   */
  async initialize(config: AgentConfig): Promise<AgentState> {
    this.state = {
      sessionId: this.generateSessionId(),
      currentMode: 'idle',
      config,
      taskQueue: [],
      completedTasks: [],
      failedTasks: [],
      blockedTasks: [],
      executionHistory: [],
      metrics: this.emptyMetrics(),
      timestamps: {
        startTime: Date.now(),
        lastActivity: Date.now(),
        lastSaveTime: 0,
        lastMetricsUpdate: 0,
        modeTransitions: [],
      },
      session: {
        id: this.generateSessionId(),
        iterationCount: 0,
        parentPid: process.ppid,
        pid: process.pid,
      },
    }

    await this.saveState()
    return this.state
  }

  /**
   * Load existing state from disk
   */
  async loadState(): Promise<AgentState | null> {
    try {
      const content = await fs.readFile(this.stateFilePath, 'utf-8')

      // Validate JSON structure
      const state = JSON.parse(content) as AgentState

      // Basic validation
      if (!state.sessionId || !state.currentMode || !state.config) {
        throw new StateCorruptionError('Missing required fields in state file')
      }

      this.state = state
      return this.state
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return null // No existing state
      }

      if (error instanceof StateCorruptionError) {
        throw error
      }

      throw new StateCorruptionError('Failed to load state file', { originalError: error })
    }
  }

  /**
   * Get current state (readonly)
   */
  getState(): AgentState | null {
    return this.state
  }

  /**
   * Update state with immutable merge
   */
  async updateState(updates: Partial<AgentState>): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded. Call initialize() or loadState() first.')
    }

    // Create new state with updates (immutable)
    this.state = {
      ...this.state,
      ...updates,
      timestamps: {
        ...this.state.timestamps,
        lastActivity: Date.now(),
      },
    }

    // Automatically persist
    await this.saveState()
  }

  /**
   * Update specific task in queue (immutable)
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded')
    }

    // Create new task array with updated task
    const updatedQueue = this.state.taskQueue.map((task) => (task.id === taskId ? { ...task, ...updates } : task))

    const updatedCompleted = this.state.completedTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))

    const updatedFailed = this.state.failedTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))

    const updatedBlocked = this.state.blockedTasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task))

    // Update state with new arrays
    await this.updateState({
      taskQueue: updatedQueue,
      completedTasks: updatedCompleted,
      failedTasks: updatedFailed,
      blockedTasks: updatedBlocked,
    })
  }

  /**
   * Move task from queue to completed/failed/blocked (immutable)
   */
  async moveTask(taskId: string, _from: 'queue', to: 'completed' | 'failed' | 'blocked'): Promise<void> {
    if (!this.state) {
      throw new Error('No state loaded')
    }

    // Find task
    const taskIndex = this.state.taskQueue.findIndex((t) => t.id === taskId)
    if (taskIndex === -1) {
      throw new Error(`Task ${taskId} not found in queue`)
    }

    const task = this.state.taskQueue[taskIndex]

    // Remove from queue
    const newQueue = this.state.taskQueue.filter((t) => t.id !== taskId)

    // Add to destination
    let newCompleted = this.state.completedTasks
    let newFailed = this.state.failedTasks
    let newBlocked = this.state.blockedTasks

    if (to === 'completed') {
      newCompleted = [...this.state.completedTasks, task]
    } else if (to === 'failed') {
      newFailed = [...this.state.failedTasks, task]
    } else if (to === 'blocked') {
      newBlocked = [...this.state.blockedTasks, task]
    }

    // Update state
    await this.updateState({
      taskQueue: newQueue,
      completedTasks: newCompleted,
      failedTasks: newFailed,
      blockedTasks: newBlocked,
    })
  }

  /**
   * Save state to disk
   */
  async saveState(): Promise<void> {
    if (!this.state) {
      throw new Error('No state to save')
    }

    this.state.timestamps.lastSaveTime = Date.now()

    // Ensure directory exists
    await fs.mkdir(path.dirname(this.stateFilePath), { recursive: true })

    // Write state atomically
    const tempPath = `${this.stateFilePath}.tmp`
    await fs.writeFile(tempPath, JSON.stringify(this.state, null, 2))
    await fs.rename(tempPath, this.stateFilePath)
  }

  /**
   * Start auto-save timer
   */
  startAutoSave(intervalMs: number): void {
    this.stopAutoSave()
    this.saveTimer = setInterval(async () => {
      await this.saveState()
    }, intervalMs)
  }

  /**
   * Stop auto-save timer
   */
  stopAutoSave(): void {
    if (this.saveTimer) {
      clearInterval(this.saveTimer)
      this.saveTimer = null
    }
  }

  /**
   * Create a named checkpoint
   */
  async checkpoint(name: string): Promise<string> {
    if (!this.state) {
      throw new Error('No state to checkpoint')
    }

    await fs.mkdir(this.checkpointDir, { recursive: true })
    const checkpointPath = path.join(this.checkpointDir, `checkpoint-${name}-${Date.now()}.json`)

    await fs.writeFile(checkpointPath, JSON.stringify(this.state, null, 2))
    return checkpointPath
  }

  /**
   * List available checkpoints
   */
  async listCheckpoints(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.checkpointDir)
      return files.filter((f) => f.startsWith('checkpoint-'))
    } catch {
      return []
    }
  }

  /**
   * Restore from checkpoint
   */
  async restoreCheckpoint(checkpointName: string): Promise<AgentState> {
    const files = await this.listCheckpoints()
    const matching = files.find((f) => f.includes(checkpointName))

    if (!matching) {
      throw new Error(`Checkpoint not found: ${checkpointName}`)
    }

    const checkpointPath = path.join(this.checkpointDir, matching)
    const content = await fs.readFile(checkpointPath, 'utf-8')
    this.state = JSON.parse(content)

    await this.saveState()
    return this.state
  }

  /**
   * Clear all state
   */
  async clearState(): Promise<void> {
    this.state = null
    this.stopAutoSave()

    try {
      await fs.unlink(this.stateFilePath)
    } catch {
      // Ignore if file doesn't exist
    }
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Create empty metrics object
   */
  private emptyMetrics() {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalTasks: 0,
      totalExecutionTime: 0,
      averageTaskTime: 0,
      successRate: 0,
      git: {
        totalCommits: 0,
        totalFilesChanged: 0,
        totalInsertions: 0,
        totalDeletions: 0,
        branchesCreated: 0,
      },
      tests: {
        totalTestsRun: 0,
        testsPassed: 0,
        testsFailed: 0,
        currentCoverage: 0,
        testsAdded: 0,
      },
      improvements: {
        bugsFixed: 0,
        testsAdded: 0,
        refactoringsCompleted: 0,
        documentationAdded: 0,
        qualityImprovements: 0,
      },
      resources: {
        peakMemoryMB: 0,
        averageCpuPercent: 0,
        totalApiCalls: 0,
        totalTokensUsed: 0,
      },
    }
  }
}
