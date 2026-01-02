import type { Logger } from '@polka-codes/core'
import type { ApprovalDecision, ApprovalLevel, Task } from '../types'
import { Priority } from '../types'

/**
 * Manages task approval requirements
 */
export class ApprovalManager {
  constructor(
    private logger: Logger,
    private approvalLevel: ApprovalLevel,
    private autoApproveSafeTasks: boolean,
    private maxAutoApprovalCost: number,
    private destructiveOperations: string[],
  ) {}

  /**
   * Check if task requires approval
   */
  requiresApproval(task: Task): boolean {
    // Always approve if level is 'none'
    if (this.approvalLevel === 'none') {
      return false
    }

    // Always require approval for all tasks if level is 'all'
    if (this.approvalLevel === 'all') {
      return true
    }

    // Check if task is destructive
    if (this.isDestructive(task)) {
      return true
    }

    // Require approval for commits if level is 'commits'
    if (this.approvalLevel === 'commits' && task.type === 'commit') {
      return true
    }

    // Auto-approve safe tasks if within time threshold and low priority
    if (this.autoApproveSafeTasks && task.estimatedTime <= this.maxAutoApprovalCost && task.priority === Priority.TRIVIAL) {
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
      this.logger.warn(`⚠️  Not running in an interactive terminal - auto-rejecting task: ${task.title}`)
      return { approved: false, reason: 'Non-interactive environment (no TTY)' }
    }

    this.logger.info(`\n${'═'.repeat(60)}`)
    this.logger.info(`🤖 Approval Required: ${task.title}`)
    this.logger.info('═'.repeat(60))
    this.logger.info(`📝 Description: ${task.description}`)
    this.logger.info(`🏷️  Type: ${task.type}`)
    this.logger.info(`⚖️  Complexity: ${task.complexity}`)
    this.logger.info(`📊 Priority: ${Priority[task.priority]} (${task.priority})`)
    this.logger.info(`⏱️  Estimated Time: ${task.estimatedTime} minutes`)
    if (task.files.length > 0) {
      this.logger.info(`📁 Files: ${task.files.join(', ')}`)
    }
    this.logger.info('═'.repeat(60))

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
    if (this.destructiveOperations.includes(task.type)) {
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
}
