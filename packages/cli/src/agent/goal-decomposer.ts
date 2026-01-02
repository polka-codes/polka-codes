import { z } from 'zod'
import { runAgentWithSchema } from '../workflows/agent-builder'
import { WORKFLOW_MAPPING } from './constants'
import type { GoalDecompositionResult, Task, TaskComplexity, WorkflowContext } from './types'
import { Priority } from './types'

/**
 * Schema for goal decomposition result
 */
const GoalDecompositionSchema = z.object({
  requirements: z.array(z.string()).min(1),
  highLevelPlan: z.string().min(10),
  tasks: z
    .array(
      z.object({
        title: z.string().min(5),
        description: z.string().min(10),
        type: z.enum(['feature', 'bugfix', 'refactor', 'test', 'docs', 'other']),
        priority: z.enum(['critical', 'high', 'medium', 'low', 'trivial']),
        complexity: z.enum(['low', 'medium', 'high']),
        estimatedTime: z.number().min(1),
        files: z.array(z.string()).optional(),
        dependencies: z.array(z.string()).optional(),
      }),
    )
    .min(1),
  risks: z.array(z.string()),
})

/**
 * Decomposes a high-level goal into actionable tasks
 */
export class GoalDecomposer {
  constructor(private context: WorkflowContext) {}

  /**
   * Decompose goal into implementation plan
   */
  async decompose(goal: string): Promise<GoalDecompositionResult> {
    this.context.logger.info(`[GoalDecomposer] Analyzing goal: ${goal}`)

    // Gather context about codebase
    const codebaseContext = await this.gatherCodebaseContext()

    // Use agent to decompose goal
    const result = await runAgentWithSchema(this.context, {
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildDecompositionPrompt(goal, codebaseContext),
      schema: GoalDecompositionSchema,
      maxToolRoundTrips: 50,
    })

    // Convert to tasks with Priority enum and proper types
    const tasks = result.tasks.map((t, i) => {
      const priority = this.mapPriority(t.priority)
      const workflow = WORKFLOW_MAPPING[t.type]

      return {
        id: `task-${Date.now()}-${i}`,
        type: t.type,
        title: t.title,
        description: t.description,
        priority,
        complexity: t.complexity,
        dependencies: t.dependencies || [],
        estimatedTime: t.estimatedTime,
        status: 'pending' as const,
        files: t.files || [],
        workflow,
        workflowInput: this.buildWorkflowInput(t),
        retryCount: 0,
        createdAt: Date.now(),
      }
    })

    // Estimate total complexity
    const complexityScores = { low: 1, medium: 2, high: 3 }
    const avgComplexity = tasks.reduce((sum, t) => sum + complexityScores[t.complexity], 0) / tasks.length
    const estimatedComplexity: TaskComplexity = avgComplexity < 1.5 ? 'low' : avgComplexity < 2.5 ? 'medium' : 'high'

    // Extract dependencies
    const dependencies = this.extractDependencies(tasks)

    return {
      goal,
      requirements: result.requirements,
      highLevelPlan: result.highLevelPlan,
      tasks,
      estimatedComplexity,
      dependencies,
      risks: result.risks,
    }
  }

  /**
   * Map string priority to enum
   */
  private mapPriority(priority: string): Priority {
    switch (priority) {
      case 'critical':
        return Priority.CRITICAL
      case 'high':
        return Priority.HIGH
      case 'medium':
        return Priority.MEDIUM
      case 'low':
        return Priority.LOW
      case 'trivial':
        return Priority.TRIVIAL
      default:
        return Priority.MEDIUM
    }
  }

  /**
   * Build system prompt for goal decomposition
   */
  private buildSystemPrompt(): string {
    return `You are an expert software architect and project manager.

Your task is to:
1. Analyze the given goal and identify requirements
2. Create a high-level implementation plan
3. Break down the plan into specific, actionable tasks
4. Estimate complexity and time for each task
5. Identify dependencies between tasks
6. Flag potential risks

Task Types:
- feature: New functionality to implement
- bugfix: Fixing bugs or errors
- refactor: Improving code structure without changing behavior
- test: Adding or improving tests
- docs: Adding or improving documentation
- other: Tasks that don't fit the above categories

Priority Guidelines:
- critical: Build failures, security issues, data loss (Priority 1000)
- high: Test failures, type errors, bugs (Priority 800)
- medium: Refactoring, documentation, coverage (Priority 600)
- low: Nice-to-have features, optimizations (Priority 400)
- trivial: Style fixes, minor cleanups (Priority 200)

Complexity Guidelines:
- low: Simple, straightforward task (<30 min)
- medium: Moderate complexity, some research needed (30-60 min)
- high: Complex, requires significant work (>60 min)

For each task, specify:
- title: Brief, descriptive title
- description: What needs to be done
- type: One of the task types above
- priority: critical/high/medium/low/trivial
- complexity: low/medium/high
- estimatedTime: Time in minutes
- files: Expected files to be affected (if known)
- dependencies: Array of task titles this task depends on

Be specific and actionable. Break complex tasks into smaller steps.`
  }

  /**
   * Build decomposition prompt
   */
  private buildDecompositionPrompt(goal: string, codebaseContext: string): string {
    return `I need you to analyze the following goal and break it down into executable tasks.

**Goal:**
${goal}

**Codebase Context:**
${codebaseContext}

Please:
1. Identify the requirements for this goal
2. Create a high-level implementation plan
3. Break down the plan into 3-10 specific, actionable tasks
4. For each task, specify the required details
5. Identify any dependencies between tasks
6. Flag any potential risks

Return your response as a JSON object following the provided schema.`
  }

  /**
   * Build workflow input for task
   */
  private buildWorkflowInput(task: any): any {
    switch (task.type) {
      case 'feature':
        return {
          task: task.description,
          files: task.files || [],
        }

      case 'bugfix':
        return {
          error: task.description,
        }

      case 'refactor':
        return {
          task: task.description,
          files: task.files || [],
        }

      case 'test':
        return {
          task: `Add tests for: ${task.description}`,
          files: task.files || [],
        }

      case 'docs':
        return {
          task: task.description,
          files: task.files || [],
        }

      default:
        return {
          task: task.description,
        }
    }
  }

  /**
   * Extract dependencies between tasks
   */
  private extractDependencies(tasks: Task[]): Array<{
    taskId: string
    dependsOn: string[]
    type: 'hard' | 'soft'
  }> {
    const taskMap = new Map(tasks.map((t) => [t.title, t.id]))
    const dependencies: Array<{ taskId: string; dependsOn: string[]; type: 'hard' | 'soft' }> = []

    for (const task of tasks) {
      if (task.dependencies.length > 0) {
        const depIds: string[] = []

        for (const depTitle of task.dependencies) {
          const depId = taskMap.get(depTitle)
          if (depId) {
            depIds.push(depId)
          }
        }

        if (depIds.length > 0) {
          dependencies.push({
            taskId: task.id,
            dependsOn: depIds,
            type: 'hard' as const,
          })
        }
      }
    }

    return dependencies
  }

  /**
   * Gather context about the codebase
   */
  private async gatherCodebaseContext(): Promise<string> {
    const context: string[] = []

    try {
      // Get project structure
      const pkgResult = await this.context.tools.executeCommand({
        command: 'find',
        args: ['src', '-name', '*.ts', '-not', '-path', '*/node_modules/*', '-not', '-path', '*/dist/*'].split(' '),
      })

      const files = pkgResult.stdout.split('\n').filter(Boolean).slice(0, 20) // First 20 files
      if (files.length > 0) {
        context.push(`**Project Structure (first 20 files):**`)
        context.push(files.map((f) => `- ${f}`).join('\n'))
      }
    } catch (_error) {
      // Failed to get structure, continue without it
    }

    try {
      // Get package.json info
      const pkgContent = await this.context.tools.readFile({ path: 'package.json' })
      const pkg = JSON.parse(pkgContent)

      context.push(`**Package:** ${pkg.name}`)
      context.push(`**Version:** ${pkg.version}`)
      if (pkg.description) {
        context.push(`**Description:** ${pkg.description}`)
      }
    } catch (_error) {
      // No package.json, continue without it
    }

    try {
      // Get git info
      const gitBranch = await this.context.tools.executeCommand({
        command: 'git',
        args: ['branch', '--show-current'],
      })

      context.push(`**Current Branch:** ${gitBranch.stdout.trim()}`)
    } catch (_error) {
      // Not a git repo
    }

    return context.join('\n\n')
  }
}
