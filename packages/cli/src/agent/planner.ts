import type { Plan, Task, WorkflowContext } from './types'

/**
 * Creates execution plans from task lists
 */
export class TaskPlanner {
  constructor(private context: WorkflowContext) {}

  /**
   * Create a plan from goal and tasks
   */
  createPlan(goal: string, tasks: Task[]): Plan {
    this.context.logger.info(`[Planner] Creating plan with ${tasks.length} tasks`)

    // Resolve dependencies
    const withDependencies = this.resolveDependencies(tasks)

    // Create execution phases (topological sort)
    const executionOrder = this.createExecutionPhases(withDependencies)

    // Estimate total time
    const estimatedTime = withDependencies.reduce((sum, task) => sum + task.estimatedTime, 0)

    // Identify risks
    const risks = this.identifyRisks(withDependencies)

    // Generate high-level plan text
    const highLevelPlan = this.generateHighLevelPlan(goal, withDependencies)

    // Convert dependency array to Record format
    const dependencyGraph: Record<string, string[]> = {}
    const depArray = this.extractDependencyGraph(withDependencies)
    for (const dep of depArray) {
      dependencyGraph[dep.taskId] = dep.dependsOn
    }

    return {
      goal,
      highLevelPlan,
      tasks: withDependencies,
      executionOrder,
      estimatedTime,
      risks,
      dependencies: dependencyGraph,
    }
  }

  /**
   * Resolve task dependencies
   */
  private resolveDependencies(tasks: Task[]): Task[] {
    const _taskMap = new Map(tasks.map((t) => [t.id, t]))

    const resolved = tasks.map((task) => {
      // Convert dependency titles to IDs
      const depIds: string[] = []

      for (const depTitle of task.dependencies) {
        // Find task by title
        const depTask = tasks.find((t) => t.title === depTitle)
        if (depTask) {
          depIds.push(depTask.id)
        } else {
          this.context.logger.warn(`[Planner] Dependency not found: ${depTitle}`)
        }
      }

      return {
        ...task,
        dependencies: depIds,
      }
    })

    return resolved
  }

  /**
   * Create execution phases using topological sort
   * Tasks in each phase can be executed in parallel
   */
  private createExecutionPhases(tasks: Task[]): string[][] {
    const phases: string[][] = []
    const completed = new Set<string>()
    const _taskMap = new Map(tasks.map((t) => [t.id, t]))

    // Keep processing until all tasks are assigned
    while (completed.size < tasks.length) {
      const readyTasks: string[] = []

      // Find all tasks whose dependencies are met
      for (const task of tasks) {
        if (completed.has(task.id)) continue

        // Check if all dependencies are met
        const depsMet = task.dependencies.every((depId) => completed.has(depId))

        if (depsMet) {
          readyTasks.push(task.id)
        }
      }

      if (readyTasks.length === 0) {
        // Circular dependency or missing dependency
        this.context.logger.warn('[Planner] No ready tasks - possible circular dependency')
        break
      }

      // Add to phases and mark as completed
      phases.push(readyTasks)
      for (const id of readyTasks) {
        completed.add(id)
      }
    }

    return phases
  }

  /**
   * Identify potential risks in the plan
   */
  private identifyRisks(tasks: Task[]): string[] {
    const risks: string[] = []

    // Check for tasks with many dependencies
    for (const task of tasks) {
      if (task.dependencies.length > 5) {
        risks.push(`Task "${task.title}" has ${task.dependencies.length} dependencies - could become blocked`)
      }
    }

    // Check for long-running tasks
    const longTasks = tasks.filter((t) => t.estimatedTime > 120)
    if (longTasks.length > 0) {
      risks.push(`${longTasks.length} tasks have long estimated time (>2 hours)`)
    }

    // Check for high-priority tasks with high complexity
    const riskyTasks = tasks.filter((t) => t.priority >= 800 && t.complexity === 'high')
    if (riskyTasks.length > 0) {
      risks.push(`${riskyTasks.length} high-priority, high-complexity tasks`)
    }

    // Check for tasks affecting many files
    const fileHeavyTasks = tasks.filter((t) => t.files.length > 10)
    if (fileHeavyTasks.length > 0) {
      risks.push(`${fileHeavyTasks.length} tasks affect >10 files - potential for merge conflicts`)
    }

    // Check for many critical tasks
    const criticalTasks = tasks.filter((t) => t.priority === 1000)
    if (criticalTasks.length > 3) {
      risks.push(`${criticalTasks.length} critical-priority tasks - consider prioritizing`)
    }

    return risks
  }

  /**
   * Generate high-level plan description
   */
  private generateHighLevelPlan(goal: string, tasks: Task[]): string {
    const lines: string[] = []

    lines.push(`**Goal:** ${goal}`)
    lines.push('')
    lines.push(`**Overview:** This goal will be achieved through ${tasks.length} tasks organized into logical phases.`)
    lines.push('')

    // Group by type
    const byType = new Map<string, Task[]>()
    for (const task of tasks) {
      if (!byType.has(task.type)) {
        byType.set(task.type, [])
      }
      byType.get(task.type)?.push(task)
    }

    // Show task breakdown
    lines.push(`**Task Breakdown:**`)
    for (const [type, typeTasks] of byType) {
      lines.push(`- ${typeTasks.length} ${type} task(s)`)
    }

    lines.push('')

    // Show phases (simplified)
    const phases = this.createExecutionPhases(tasks)
    lines.push(`**Execution:** ${phases.length} phases`)
    for (let i = 0; i < phases.length; i++) {
      const phaseTasks = phases[i].map((id) => tasks.find((t) => t.id === id)?.title)
      lines.push(`- Phase ${i + 1}: ${phaseTasks.join(', ')}`)
    }

    return lines.join('\n')
  }

  /**
   * Extract dependency graph as list of edges
   */
  private extractDependencyGraph(tasks: Task[]): Array<{
    taskId: string
    dependsOn: string[]
    type: 'hard' | 'soft'
  }> {
    const dependencies: Array<{ taskId: string; dependsOn: string[]; type: 'hard' | 'soft' }> = []

    for (const task of tasks) {
      if (task.dependencies.length > 0) {
        dependencies.push({
          taskId: task.id,
          dependsOn: task.dependencies,
          type: 'hard' as const,
        })
      }
    }

    return dependencies
  }
}
