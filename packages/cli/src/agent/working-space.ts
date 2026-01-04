import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import type { Logger } from '@polka-codes/core'
import type { Plan, Task, WorkflowContext } from './types'

/**
 * Working Space Manager
 *
 * Manages a user-specified working directory for:
 * - Storing and loading plans as markdown files
 * - Discovering pending/incomplete tasks
 * - Documenting completed tasks
 *
 * Directory Structure:
 * working-dir/
 *   plans/
 *     plan-1.md
 *     plan-2.md
 *   tasks/
 *     pending/
 *       task-1.md
 *       task-2.md
 *     completed/
 *       task-3.md
 *   logs/
 *     task-1.log
 */
export class WorkingSpace {
  private plansDir: string
  private tasksDir: string
  private pendingTasksDir: string
  private completedTasksDir: string
  private logsDir: string

  constructor(
    private workingDir: string,
    private logger: Logger,
  ) {
    this.plansDir = path.join(workingDir, 'plans')
    this.tasksDir = path.join(workingDir, 'tasks')
    this.pendingTasksDir = path.join(this.tasksDir, 'pending')
    this.completedTasksDir = path.join(this.tasksDir, 'completed')
    this.logsDir = path.join(workingDir, 'logs')
  }

  /**
   * Initialize working directory structure
   */
  async initialize(): Promise<void> {
    await fs.mkdir(this.plansDir, { recursive: true })
    await fs.mkdir(this.pendingTasksDir, { recursive: true })
    await fs.mkdir(this.completedTasksDir, { recursive: true })
    await fs.mkdir(this.logsDir, { recursive: true })

    this.logger.info(`[WorkingSpace] Initialized: ${this.workingDir}`)
  }

  /**
   * Save a plan to a markdown file
   */
  async savePlan(plan: Plan): Promise<void> {
    const sanitizedGoal = this.sanitizeFilename(plan.goal.slice(0, 50))
    const filename = `${sanitizedGoal}.md`
    const filepath = path.join(this.plansDir, filename)

    const markdown = this.planToMarkdown(plan)
    await fs.writeFile(filepath, markdown, 'utf-8')

    this.logger.info(`[WorkingSpace] Saved plan: ${filename}`)
  }

  /**
   * Load all plans from the working directory
   */
  async loadPlans(): Promise<Plan[]> {
    const plans: Plan[] = []

    try {
      const files = await fs.readdir(this.plansDir)
      for (const file of files) {
        if (!file.endsWith('.md')) continue

        const filepath = path.join(this.plansDir, file)
        const content = await fs.readFile(filepath, 'utf-8')
        const plan = this.markdownToPlan(content, file)
        if (plan) {
          plans.push(plan)
        }
      }
    } catch (_error) {
      this.logger.warn('[WorkingSpace] No plans found or error reading plans')
    }

    return plans
  }

  /**
   * Discover pending tasks from the working directory
   */
  async discoverPendingTasks(): Promise<Task[]> {
    const tasks: Task[] = []

    try {
      const files = await fs.readdir(this.pendingTasksDir)
      for (const file of files) {
        if (!file.endsWith('.md')) continue

        const filepath = path.join(this.pendingTasksDir, file)
        const content = await fs.readFile(filepath, 'utf-8')
        const task = this.markdownToTask(content, file)
        if (task && task.status === 'pending') {
          tasks.push(task)
        }
      }
    } catch (_error) {
      this.logger.warn('[WorkingSpace] No pending tasks found')
    }

    this.logger.info(`[WorkingSpace] Discovered ${tasks.length} pending tasks`)
    return tasks
  }

  /**
   * Document a completed task
   */
  async documentCompletedTask(task: Task, result: string): Promise<void> {
    const sanitizedTitle = this.sanitizeFilename(`${task.id}-${task.title.slice(0, 30)}`)
    const filename = `${sanitizedTitle}.md`
    const sourcePath = path.join(this.pendingTasksDir, filename)
    const destPath = path.join(this.completedTasksDir, filename)

    // Update task status and add result
    const completedTask: Task = {
      ...task,
      status: 'completed',
      completedAt: Date.now(),
    }

    const markdown = this.taskToMarkdown(completedTask, result)

    // Try to move from pending to completed, otherwise just write to completed
    try {
      await fs.rename(sourcePath, destPath)
      await fs.writeFile(destPath, markdown, 'utf-8')
    } catch {
      await fs.writeFile(destPath, markdown, 'utf-8')
    }

    this.logger.info(`[WorkingSpace] Documented completed task: ${task.title}`)
  }

  /**
   * Create a pending task file
   */
  async createPendingTask(task: Task): Promise<void> {
    const sanitizedTitle = this.sanitizeFilename(`${task.id}-${task.title.slice(0, 30)}`)
    const filename = `${sanitizedTitle}.md`
    const filepath = path.join(this.pendingTasksDir, filename)

    const markdown = this.taskToMarkdown(task)
    await fs.writeFile(filepath, markdown, 'utf-8')

    this.logger.info(`[WorkingSpace] Created pending task: ${task.title}`)
  }

  /**
   * Convert plan to markdown format
   */
  private planToMarkdown(plan: Plan): string {
    const tasksByPhase = plan.executionOrder.map((phase, index) => {
      const phaseTasks = phase.map((id) => plan.tasks.find((t) => t.id === id)).filter(Boolean) as Task[]
      return `### Phase ${index + 1}\n\n${phaseTasks.map((t) => `- **${t.title}** (${t.type}, ${t.priority}p): ${t.description}`).join('\n')}`
    })

    return `# Plan: ${plan.goal}

${plan.highLevelPlan}

## Execution Order

${tasksByPhase.join('\n\n')}

## Tasks

${plan.tasks.map((t) => this.taskToMarkdown(t)).join('\n\n---\n\n')}

## Risks

${plan.risks.map((r) => `- ${r}`).join('\n')}

## Estimated Time: ${plan.estimatedTime} minutes

---
*Generated by Polka Codes Agent*
`.trim()
  }

  /**
   * Convert task to markdown format
   */
  private taskToMarkdown(task: Task, result?: string): string {
    let md = `# Task: ${task.title}

**ID:** \`${task.id}\`
**Type:** ${task.type}
**Priority:** ${task.priority}
**Status:** ${task.status}
**Estimated Time:** ${task.estimatedTime} minutes

## Description

${task.description}

## Workflow

${task.workflow}

## Dependencies

${task.dependencies.length > 0 ? task.dependencies.map((d) => `- \`${d}\``).join('\n') : 'None'}

## Files

${task.files.length > 0 ? task.files.map((f) => `- \`${f}\``).join('\n') : 'None'}

`

    if (result) {
      md += `## Result\n\n${result}\n\n`
    }

    md += `---\n\n*Created: ${new Date(task.createdAt).toISOString()}*`

    if (task.completedAt) {
      md += `\n*Completed: ${new Date(task.completedAt).toISOString()}*`
    }

    return md.trim()
  }

  /**
   * Parse markdown to plan (simplified version)
   */
  private markdownToPlan(content: string, filename: string): Plan | null {
    try {
      // Extract goal from header - more lenient pattern accepts different header levels and spacing
      const goalMatch = content.match(/^#{1,6}\s*[Pp]lan:\s*(.+)$/m)
      const goal = goalMatch?.[1]?.trim() || filename.replace('.md', '')

      // Extract high-level plan (content after goal until next section)
      const lines = content.split('\n')
      let highLevelPlan = 'Loaded from working directory'
      const goalLineIndex = lines.findIndex((l) => l.match(/^#\s+Plan:/))
      if (goalLineIndex >= 0) {
        const planLines: string[] = []
        for (let i = goalLineIndex + 1; i < lines.length; i++) {
          if (lines[i].startsWith('##')) break
          if (lines[i].trim()) planLines.push(lines[i])
        }
        if (planLines.length > 0) {
          highLevelPlan = planLines.join('\n').trim()
        }
      }

      // Extract estimated time (with or without bold formatting)
      const estimatedTimeMatch = content.match(/(?:\*\*)?Estimated Time:(?:\*\*)?\s*(\d+)\s*minutes?/i)
      const estimatedTime = estimatedTimeMatch?.[1] ? parseInt(estimatedTimeMatch[1], 10) : 0

      // Extract risks
      const risksSection = content.match(/^##\s*Risks?\s*$/im)
      const risks: string[] = []
      if (risksSection) {
        const risksStart = content.indexOf(risksSection[0]) + risksSection[0].length
        const risksEnd = content.indexOf('---', risksStart)
        const risksContent = content.slice(risksStart, risksEnd > 0 ? risksEnd : content.length)
        const riskItems = risksContent.match(/^-\s*(.+)$/gm) || []
        risks.push(...riskItems.map((r) => r.replace(/^-\s*/, '').trim()))
      }

      // This is a simplified parser - in production you'd want more robust parsing
      return {
        goal,
        highLevelPlan,
        tasks: [],
        executionOrder: [],
        estimatedTime,
        risks,
        dependencies: {},
      }
    } catch {
      return null
    }
  }

  /**
   * Parse markdown to task (simplified version)
   */
  private markdownToTask(content: string, filename: string): Task | null {
    try {
      // Extract title from header - more lenient pattern accepts different header levels and spacing
      const titleMatch = content.match(/^#{1,6}\s*[Tt]ask:\s*(.+)$/m)
      const title = titleMatch?.[1]?.trim() || filename.replace('.md', '')

      // Helper to extract field value
      const extractField = (fieldName: string): string | undefined => {
        const patterns = [
          new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*\`(.+?)\``, 'i'), // **Field:** `value`
          new RegExp(`\\*\\*${fieldName}:\\*\\*\\s*(.+)`, 'i'), // **Field:** value
        ]
        for (const pattern of patterns) {
          const match = content.match(pattern)
          if (match?.[1]) {
            return match[1].trim()
          }
        }
        return undefined
      }

      // Extract basic fields
      const id = extractField('ID') || filename.replace('.md', '')
      const type = (extractField('Type') || 'task') as Task['type']
      const priorityStr = extractField('Priority') || '600'
      const priority = parseInt(priorityStr, 10)
      const status = (extractField('Status') || 'pending') as Task['status']
      const estimatedTimeStr = extractField('Estimated Time') || '10'
      const estimatedTime = parseInt(estimatedTimeStr, 10)

      // Extract workflow from section
      let workflow = 'code' as Task['workflow']
      const workflowSection = content.match(/^##\s*Workflow\s*$/im)
      if (workflowSection) {
        const workflowStart = content.indexOf(workflowSection[0]) + workflowSection[0].length
        const nextHeader = content.indexOf('##', workflowStart)
        const workflowContent = content.slice(workflowStart, nextHeader > 0 ? nextHeader : content.length)
        const workflowValue = workflowContent.trim()
        if (workflowValue && workflowValue !== 'None') {
          workflow = workflowValue as Task['workflow']
        }
      }

      // Extract description (after Description header until next section)
      const descSection = content.match(/^##\s*Description\s*$/im)
      let description = 'Loaded from working directory'
      if (descSection) {
        const descStart = content.indexOf(descSection[0]) + descSection[0].length
        const nextHeader = content.indexOf('##', descStart)
        const descContent = content.slice(descStart, nextHeader > 0 ? nextHeader : content.length)
        description = descContent.trim() || description
      }

      // Extract dependencies (list items)
      const depsSection = content.match(/^##\s*Dependencies\s*$/im)
      const dependencies: string[] = []
      if (depsSection) {
        const depsStart = content.indexOf(depsSection[0]) + depsSection[0].length
        const nextHeader = content.indexOf('##', depsStart)
        const depsContent = content.slice(depsStart, nextHeader > 0 ? nextHeader : content.length)
        const depItems = depsContent.match(/^-\s*`(.+?)`/gm) || []
        dependencies.push(...depItems.map((d) => d.replace(/^-\s*`\s*|\s*`$/g, '').trim()))
      }

      // Extract files (list items)
      const filesSection = content.match(/^##\s*Files\s*$/im)
      const files: string[] = []
      if (filesSection) {
        const filesStart = content.indexOf(filesSection[0]) + filesSection[0].length
        const nextHeader = content.indexOf('##', filesStart)
        const filesContent = content.slice(filesStart, nextHeader > 0 ? nextHeader : content.length)
        const fileItems = filesContent.match(/^-\s*`(.+?)`/gm) || []
        files.push(...fileItems.map((f) => f.replace(/^-\s*`\s*|\s*`$/g, '').trim()))
      }

      // Extract timestamps
      const createdAtMatch = content.match(/\*Created:\s*(.+?)\*/)
      const createdAt = createdAtMatch?.[1] ? new Date(createdAtMatch[1]).getTime() : Date.now()

      const completedAtMatch = content.match(/\*Completed:\s*(.+?)\*/)
      const completedAt = completedAtMatch?.[1] ? new Date(completedAtMatch[1]).getTime() : undefined

      return {
        id,
        title,
        type,
        description,
        priority,
        complexity: 'medium',
        dependencies,
        estimatedTime,
        status,
        files,
        workflow,
        workflowInput: {},
        retryCount: 0,
        createdAt,
        completedAt,
      }
    } catch {
      return null
    }
  }

  /**
   * Sanitize filename for safe filesystem usage
   */
  private sanitizeFilename(filename: string): string {
    let sanitized = filename
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 100)

    // If result is empty, use a default name
    if (!sanitized) {
      sanitized = `plan-${Date.now()}`
    }

    return sanitized
  }

  /**
   * Get working directory path
   */
  getWorkingDir(): string {
    return this.workingDir
  }

  /**
   * Check if working directory exists
   */
  async exists(): Promise<boolean> {
    try {
      await fs.access(this.workingDir)
      return true
    } catch {
      return false
    }
  }

  /**
   * Clean up old completed tasks (keep last N)
   */
  async cleanupOldCompletedTasks(keepCount: number = 100): Promise<void> {
    try {
      const files = await fs.readdir(this.completedTasksDir)
      if (files.length <= keepCount) return

      // Sort by modification time and delete oldest
      const fileStats = await Promise.all(
        files.map(async (file) => ({
          file,
          path: path.join(this.completedTasksDir, file),
          mtime: (await fs.stat(path.join(this.completedTasksDir, file))).mtimeMs,
        })),
      )

      fileStats.sort((a, b) => b.mtime - a.mtime)
      const toDelete = fileStats.slice(keepCount)

      for (const { path: filepath } of toDelete) {
        await fs.unlink(filepath)
      }

      this.logger.info(`[WorkingSpace] Cleaned up ${toDelete.length} old completed tasks`)
    } catch (error) {
      this.logger.warn('[WorkingSpace] Error cleaning up old tasks', error as Error)
    }
  }

  /**
   * Get statistics about the working space
   */
  async getStats(): Promise<{
    planCount: number
    pendingTaskCount: number
    completedTaskCount: number
    totalSize: number
  }> {
    let planCount = 0
    let pendingTaskCount = 0
    let completedTaskCount = 0
    let totalSize = 0

    try {
      const [plans, pending, completed] = await Promise.all([
        fs.readdir(this.plansDir).catch(() => [] as string[]),
        fs.readdir(this.pendingTasksDir).catch(() => [] as string[]),
        fs.readdir(this.completedTasksDir).catch(() => [] as string[]),
      ])

      planCount = plans.filter((f) => f.endsWith('.md')).length
      pendingTaskCount = pending.filter((f) => f.endsWith('.md')).length
      completedTaskCount = completed.filter((f) => f.endsWith('.md')).length

      // Calculate total size by iterating through each directory independently
      // to avoid double-counting when files have the same name in different directories
      for (const file of plans) {
        try {
          const stat = await fs.stat(path.join(this.plansDir, file))
          totalSize += stat.size
        } catch {
          // File might not exist
        }
      }
      for (const file of pending) {
        try {
          const stat = await fs.stat(path.join(this.pendingTasksDir, file))
          totalSize += stat.size
        } catch {
          // File might not exist
        }
      }
      for (const file of completed) {
        try {
          const stat = await fs.stat(path.join(this.completedTasksDir, file))
          totalSize += stat.size
        } catch {
          // File might not exist
        }
      }
    } catch (error) {
      this.logger.warn('[WorkingSpace] Error calculating stats', error as Error)
    }

    return { planCount, pendingTaskCount, completedTaskCount, totalSize }
  }
}

/**
 * Create a working space manager and initialize it
 */
export async function createWorkingSpace(workingDir: string, logger: Logger, _context: WorkflowContext): Promise<WorkingSpace> {
  const space = new WorkingSpace(workingDir, logger)

  // Initialize the working directory structure
  await space.initialize()

  return space
}
