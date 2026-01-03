import type { Priority } from './constants'
import type { DiscoveryStrategy, Task, WorkflowContext } from './types'
import type { WorkingSpace } from './working-space'

/**
 * Working directory discovery strategy
 *
 * Discovers tasks from the working directory's pending tasks folder.
 * This allows users to manually create tasks as markdown files
 * and have the agent process them.
 */
export function createWorkingDirDiscoveryStrategy(workingSpace: WorkingSpace): DiscoveryStrategy {
  return {
    name: 'working-dir',
    description: 'Discover tasks from working directory pending tasks folder',
    enabled: true,
    checkChanges: false,

    async execute(context: WorkflowContext): Promise<Task[]> {
      context.logger.info('[Discovery] Scanning working directory for pending tasks...')

      const tasks = await workingSpace.discoverPendingTasks()

      context.logger.info(`[Discovery] Found ${tasks.length} pending tasks in working directory`)

      return tasks
    },

    priority(task: Task): { priority: Priority; reason: string } {
      // Tasks in working directory have their own priority
      // Use the task's priority as-is, but provide a reason
      return {
        priority: task.priority,
        reason: `Task from working directory (priority: ${task.priority})`,
      }
    },
  }
}

/**
 * Create working directory discovery strategy
 */
export async function setupWorkingDirDiscovery(
  context: WorkflowContext,
  workingDir: string,
): Promise<{
  workingSpace: WorkingSpace
  discoveryStrategy: DiscoveryStrategy
}> {
  const { WorkingSpace } = await import('./working-space.js')
  const workingSpace = new WorkingSpace(workingDir, context.logger)
  await workingSpace.initialize()

  const discoveryStrategy: DiscoveryStrategy = {
    name: 'working-dir',
    description: 'Discover tasks from working directory',
    enabled: true,
    checkChanges: false,

    async execute(): Promise<Task[]> {
      return workingSpace.discoverPendingTasks()
    },

    priority(task: Task): { priority: Priority; reason: string } {
      return {
        priority: task.priority,
        reason: 'Task from working directory',
      }
    },
  }

  return { workingSpace, discoveryStrategy }
}
