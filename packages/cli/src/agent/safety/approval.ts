import * as readline from 'node:readline'
import type { Logger } from '@polka-codes/core'
import type { ApprovalDecision, ApprovalLevel, PlanApprovalRequest, Task } from '../types'
import { Priority } from '../types'

/**
 * Manages task approval requirements
 */
export class ApprovalManager {
  #logger: Logger
  #approvalLevel: ApprovalLevel
  #autoApproveSafeTasks: boolean
  #maxAutoApprovalCost: number
  #destructiveOperations: string[]

  constructor(
    logger: Logger,
    approvalLevel: ApprovalLevel,
    autoApproveSafeTasks: boolean,
    maxAutoApprovalCost: number,
    destructiveOperations: string[],
  ) {
    this.#logger = logger
    this.#approvalLevel = approvalLevel
    this.#autoApproveSafeTasks = autoApproveSafeTasks
    this.#maxAutoApprovalCost = maxAutoApprovalCost
    this.#destructiveOperations = destructiveOperations
  }

  /**
   * Check if task requires approval
   */
  requiresApproval(task: Task): boolean {
    // Always approve if level is 'none'
    if (this.#approvalLevel === 'none') {
      return false
    }

    // Always require approval for all tasks if level is 'all'
    if (this.#approvalLevel === 'all') {
      return true
    }

    // Check if task is destructive
    if (this.isDestructive(task)) {
      return true
    }

    // Require approval for commits if level is 'commits'
    if (this.#approvalLevel === 'commits' && task.type === 'commit') {
      return true
    }

    // Auto-approve safe tasks if within time threshold and low priority
    if (this.#autoApproveSafeTasks && task.estimatedTime <= this.#maxAutoApprovalCost && task.priority === Priority.TRIVIAL) {
      return false
    }

    return true
  }

  /**
   * Request user approval for a task
   */
  async requestApproval(task: Task): Promise<ApprovalDecision> {
    // Check if running in an interactive terminal
    if (!process.stdin.isTTY) {
      this.#logger.warn(`⚠️  Not running in an interactive terminal - auto-rejecting task: ${task.title}`)
      return { approved: false, reason: 'Non-interactive environment (no TTY)' }
    }

    this.#logger.info(`\n${'═'.repeat(60)}`)
    this.#logger.info(`🤖 Approval Required: ${task.title}`)
    this.#logger.info('═'.repeat(60))
    this.#logger.info(`📝 Description: ${task.description}`)
    this.#logger.info(`🏷️  Type: ${task.type}`)
    this.#logger.info(`⚖️  Complexity: ${task.complexity}`)
    this.#logger.info(`📊 Priority: ${Priority[task.priority]} (${task.priority})`)
    this.#logger.info(`⏱️  Estimated Time: ${task.estimatedTime} minutes`)
    if (task.files.length > 0) {
      this.#logger.info(`📁 Files: ${task.files.join(', ')}`)
    }
    this.#logger.info('═'.repeat(60))

    // Read user input from stdin
    const readline = require('node:readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    const answer = await new Promise<string>((resolve) => {
      rl.question('Approve this task? (yes/no): ', (response: string) => {
        rl.close()
        resolve(response)
      })
    })

    if (!answer) {
      return { approved: false, reason: 'No response' }
    }

    const normalized = answer.toLowerCase().trim()

    if (normalized === 'yes' || normalized === 'y') {
      return { approved: true }
    }

    return { approved: false, reason: 'Rejected by user' }
  }

  /**
   * Check if task is destructive
   */
  private isDestructive(task: Task): boolean {
    // Check if task type is in destructive list
    if (this.#destructiveOperations.includes(task.type)) {
      return true
    }

    // Check if task affects many files
    if (task.files.length > 10) {
      return true
    }

    // Check description for destructive keywords
    const destructiveKeywords = ['delete', 'remove', 'force', 'reset', 'drop']
    const description = task.description.toLowerCase()
    if (destructiveKeywords.some((kw) => description.includes(kw))) {
      return true
    }

    return false
  }

  /**
   * Request user approval for a plan
   *
   * Displays the plan details and asks the user to approve or reject it.
   * This is used before executing a multi-task plan.
   *
   * @param request - Plan approval request with all plan details
   * @returns Approval decision with approved flag and optional reason
   */
  async requestPlanApproval(request: PlanApprovalRequest): Promise<ApprovalDecision> {
    // Check if running in an interactive terminal
    if (!process.stdin.isTTY) {
      this.#logger.warn(`⚠️  Not running in an interactive terminal - auto-rejecting plan: ${request.goal}`)
      return { approved: false, reason: 'Non-interactive environment (no TTY)' }
    }

    // Display plan header
    this.#logger.info(`\n${'═'.repeat(60)}`)
    this.#logger.info(`📋 Plan Approval Required`)
    this.#logger.info('═'.repeat(60))

    // Display goal
    this.#logger.info(`\n🎯 Goal: ${request.goal}`)

    // Display task summary
    this.#logger.info(`\n📝 Tasks: ${request.tasks.length} tasks in ${request.executionOrder.length} phase(s)`)
    for (let i = 0; i < request.executionOrder.length; i++) {
      const phase = request.executionOrder[i]
      this.#logger.info(`   Phase ${i + 1}: ${phase.length} task(s)`)
    }

    // Display task details
    this.#logger.info(`\n📋 Task List:`)
    for (let i = 0; i < request.tasks.length; i++) {
      const task = request.tasks[i]
      const priorityLabel = Priority[task.priority] || task.priority
      this.#logger.info(`   ${i + 1}. [${priorityLabel}] ${task.title}`)
      this.#logger.info(`      ${task.description}`)
    }

    // Display estimated time
    const timeInMinutes = Math.round(request.estimatedTime)
    this.#logger.info(`\n⏱️  Estimated Time: ${timeInMinutes} minutes`)

    // Display risks if any
    if (request.risks.length > 0) {
      this.#logger.info(`\n⚠️  Risks:`)
      for (const risk of request.risks) {
        this.#logger.info(`   - ${risk}`)
      }
    }

    // Ask for approval
    this.#logger.info(`\n${'═'.repeat(60)}`)

    const answer = await this.askQuestion('Do you want to proceed with this plan? (yes/no): ')

    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      this.#logger.info('✅ Plan approved - proceeding with execution\n')
      return { approved: true }
    } else {
      this.#logger.info('❌ Plan rejected - stopping execution\n')
      return { approved: false, reason: 'User rejected the plan' }
    }
  }

  /**
   * Ask a question via stdin/stdout
   *
   * Creates a new readline interface for each question.
   * Note: This is intentional and safe for approval workflow which:
   * - Is low-frequency (once per plan approval)
   * - Properly closes the interface after each question
   * - Avoids listener leaks by creating fresh interface each time
   *
   * @param query - Question to display
   * @returns User's answer
   */
  private async askQuestion(query: string): Promise<string> {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    return new Promise((resolve) => {
      rl.question(query, (answer) => {
        rl.close()
        resolve(answer.trim())
      })
    })
  }
}
