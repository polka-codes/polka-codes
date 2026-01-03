import type { Logger, WorkflowTools } from '@polka-codes/core'
import { quoteForShell } from './utils/shell'

/**
 * Validate git branch/ref parameters to prevent command injection
 * Branch names cannot contain spaces or special shell characters
 */
function validateBranchName(param: string, paramName: string): void {
  // Git branch names: alphanumeric, dots, hyphens, underscores, forward slashes
  // No spaces allowed in branch names
  const safePattern = /^[a-zA-Z0-9._\-/]+$/

  if (!safePattern.test(param)) {
    throw new Error(`Invalid ${paramName}: contains unsafe characters. Branch names can only contain alphanumeric, ., -, _, and /.`)
  }
}

/**
 * Validate git file path parameters to prevent command injection
 * File paths can contain spaces, so we'll quote them in commands
 */
function validateFilePath(param: string, paramName: string): void {
  // Allow: alphanumeric, dots, hyphens, underscores, forward slashes, spaces, and common symbols
  // File paths can have spaces, but we'll need to quote them in shell commands
  const safePattern = /^[a-zA-Z0-9._\-/@:~^ \s]+$/

  if (!safePattern.test(param)) {
    throw new Error(`Invalid ${paramName}: contains potentially unsafe characters.`)
  }
}

/**
 * Validate git range parameters (commit hashes, refs, ranges)
 */
function validateGitRange(param: string, paramName: string): void {
  // Allow: alphanumeric, dots, hyphens, underscores, forward slashes, @, :, ~, ^, and spaces
  // Ranges can include spaces (e.g., "HEAD..main")
  const safePattern = /^[a-zA-Z0-9._\-/@:~^ \s]+$/

  if (!safePattern.test(param)) {
    throw new Error(`Invalid ${paramName}: contains potentially unsafe characters.`)
  }
}

export interface FileChange {
  path: string
  status: string
  insertions?: number
  deletions?: number
}

/**
 * GitOperations provides a high-level interface for common git operations
 * used across workflows. It centralizes git command execution and parsing logic.
 */
export class GitOperations {
  constructor(private tools: WorkflowTools<any>) {}

  /**
   * Get file changes for a git range (commit, branch, or PR reference)
   */
  async getFileChanges(range?: string): Promise<FileChange[]> {
    if (range) {
      validateGitRange(range, 'range')
    }

    const command = range ? `git --no-pager diff --name-status --no-color ${range}` : 'git --no-pager diff --name-status --no-color HEAD'

    const diffResult = await this.tools.executeCommand({
      command,
      requiresApproval: false,
    })

    if (diffResult.exitCode !== 0) {
      throw new Error(`Git diff failed: ${diffResult.stderr}`)
    }

    const files = this.parseNameStatus(diffResult.stdout)
    await this.enrichWithNumStats(files, range)
    return files
  }

  /**
   * Get file changes for a pull request
   */
  async getPullRequestChanges(prNumber: number): Promise<{ files: FileChange[]; baseRefOid: string }> {
    const prDetails = await this.tools.executeCommand({
      command: `gh pr view ${prNumber} --json baseRefOid`,
      requiresApproval: false,
    })

    if (prDetails.exitCode !== 0) {
      throw new Error(`Failed to get PR details: ${prDetails.stderr}`)
    }

    const details = JSON.parse(prDetails.stdout)
    const files = await this.getFileChanges(`${details.baseRefOid}...HEAD`)

    return { files, baseRefOid: details.baseRefOid }
  }

  /**
   * Get staged and unstaged file changes
   */
  async getLocalChanges(): Promise<{ staged: FileChange[]; unstaged: FileChange[] }> {
    const statusResult = await this.tools.executeCommand({
      command: 'git status --porcelain',
      requiresApproval: false,
    })

    if (statusResult.exitCode !== 0) {
      throw new Error(`Git status failed: ${statusResult.stderr}`)
    }

    const allFiles = this.parseStatus(statusResult.stdout)

    const stagedStats = await this.getNumStats(['--staged', '--numstat'])
    const unstagedStats = await this.getNumStats(['--numstat'])

    const staged: FileChange[] = []
    const unstaged: FileChange[] = []

    for (const file of allFiles) {
      const stagedStat = stagedStats[file.path]
      const unstagedStat = unstagedStats[file.path]

      if (stagedStat) {
        staged.push({
          ...file,
          insertions: stagedStat.insertions,
          deletions: stagedStat.deletions,
        })
      }

      if (unstagedStat) {
        unstaged.push({
          ...file,
          insertions: unstagedStat.insertions,
          deletions: unstagedStat.deletions,
        })
      }
    }

    return { staged, unstaged }
  }

  /**
   * Get the current branch name
   */
  async getCurrentBranch(): Promise<string> {
    const result = await this.tools.executeCommand({
      command: 'git rev-parse --abbrev-ref HEAD',
      requiresApproval: false,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get current branch: ${result.stderr}`)
    }

    return result.stdout.trim()
  }

  /**
   * Get the default branch name
   */
  async getDefaultBranch(): Promise<string> {
    const result = await this.tools.executeCommand({
      command: 'git rev-parse --abbrev-ref origin/HEAD',
      requiresApproval: false,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get default branch: ${result.stderr}`)
    }

    const fullRef = result.stdout.trim()
    return fullRef.replace('origin/', '')
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasUncommittedChanges(): Promise<boolean> {
    const result = await this.tools.executeCommand({
      command: 'git status --porcelain',
      requiresApproval: false,
    })

    return result.stdout.trim().length > 0
  }

  /**
   * Checkout a branch
   */
  async checkoutBranch(branchName: string): Promise<void> {
    validateBranchName(branchName, 'branchName')

    const result = await this.tools.executeCommand({
      command: `git checkout ${branchName}`,
      requiresApproval: true,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to checkout branch '${branchName}': ${result.stderr}`)
    }
  }

  /**
   * Create and checkout a new branch
   */
  async createAndCheckoutBranch(branchName: string): Promise<void> {
    validateBranchName(branchName, 'branchName')

    const result = await this.tools.executeCommand({
      command: `git checkout -b ${branchName}`,
      requiresApproval: true,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to create branch '${branchName}': ${result.stderr}`)
    }
  }

  /**
   * Get commit messages for a range
   */
  async getCommitMessages(range: string): Promise<string> {
    validateGitRange(range, 'range')

    const result = await this.tools.executeCommand({
      command: `git log --format=%s%n%b ${range}`,
      requiresApproval: false,
    })

    if (result.exitCode !== 0) {
      throw new Error(`Failed to get commit messages: ${result.stderr}`)
    }

    return result.stdout.trim()
  }

  /**
   * Parse git diff --name-status output
   */
  private parseNameStatus(stdout: string): FileChange[] {
    const lines = stdout.split('\n').filter((line) => line.trim())
    return lines.map((line) => {
      const [status, ...pathParts] = line.split('\t')
      const path = pathParts.join('\t')
      let statusDescription: string

      switch (status[0]) {
        case 'A':
          statusDescription = 'Added'
          break
        case 'D':
          statusDescription = 'Deleted'
          break
        case 'M':
          statusDescription = 'Modified'
          break
        case 'R':
          statusDescription = 'Renamed'
          break
        case 'C':
          statusDescription = 'Copied'
          break
        default:
          statusDescription = status
      }

      return { path, status: statusDescription }
    })
  }

  /**
   * Enrich files with numstats (insertions/deletions)
   */
  private async enrichWithNumStats(files: FileChange[], range?: string): Promise<void> {
    if (range) {
      validateGitRange(range, 'range')
    }

    const command = range ? `git --no-pager diff --numstat --no-color ${range}` : 'git --no-pager diff --numstat --no-color HEAD'

    const statResult = await this.tools.executeCommand({
      command,
      requiresApproval: false,
    })

    if (statResult.exitCode === 0) {
      const stats = this.parseNumStat(statResult.stdout)
      for (const file of files) {
        if (stats[file.path]) {
          file.insertions = stats[file.path].insertions
          file.deletions = stats[file.path].deletions
        }
      }
    }
  }

  /**
   * Get numstats for specific git args
   */
  private async getNumStats(args: string[]): Promise<Record<string, { insertions: number; deletions: number }>> {
    try {
      // Validate each arg to prevent command injection
      for (const arg of args) {
        validateFilePath(arg, 'git argument')
      }

      // Quote each argument to handle spaces safely
      const quotedArgs = args.map(quoteForShell)
      const command = `git --no-pager diff ${quotedArgs.join(' ')} --no-color`
      const result = await this.tools.executeCommand({
        command,
        requiresApproval: false,
      })

      if (result.exitCode === 0) {
        return this.parseNumStat(result.stdout)
      }
    } catch {
      // Ignore error
    }
    return {}
  }

  /**
   * Parse git diff --numstat output
   */
  private parseNumStat(stdout: string): Record<string, { insertions: number; deletions: number }> {
    const stats: Record<string, { insertions: number; deletions: number }> = {}
    const lines = stdout.split('\n').filter((line) => line.trim())

    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length >= 3) {
        const insertions = parts[0] === '-' ? 0 : parseInt(parts[0], 10)
        const deletions = parts[1] === '-' ? 0 : parseInt(parts[1], 10)
        const path = parts[2]

        if (!Number.isNaN(insertions) && !Number.isNaN(deletions)) {
          stats[path] = { insertions, deletions }
        }
      }
    }

    return stats
  }

  /**
   * Parse git status --porcelain output
   */
  private parseStatus(stdout: string): FileChange[] {
    const statusLines = stdout.split('\n').filter((line) => line)
    const files: FileChange[] = []

    for (const line of statusLines) {
      const indexStatus = line[0]
      const workingTreeStatus = line[1]
      const path = line.length > 3 ? this.unquotePath(line.slice(3)) : line

      let status = ''
      if (indexStatus !== ' ' && indexStatus !== '?') {
        status += indexStatus === 'A' ? 'Added (staged)' : indexStatus === 'D' ? 'Deleted (staged)' : 'Modified (staged)'
      }
      if (workingTreeStatus !== ' ' && workingTreeStatus !== '?') {
        if (status) status += ' & '
        status +=
          workingTreeStatus === 'A'
            ? 'Added'
            : workingTreeStatus === 'D'
              ? 'Deleted'
              : workingTreeStatus === 'M'
                ? 'Modified'
                : workingTreeStatus
      }

      if (!status) {
        status = indexStatus === '?' ? 'Untracked' : 'Unknown'
      }

      files.push({ path, status })
    }

    return files
  }

  /**
   * Remove git quoting from path
   */
  private unquotePath(path: string): string {
    if (path.startsWith('"') && path.endsWith('"')) {
      return path.slice(1, -1).replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\t/g, '\t').replace(/\\"/g, '"')
    }
    return path
  }
}

/**
 * Helper function to print file changes (for backward compatibility)
 */
export function printChangedFiles(logger: Logger, changedFiles: FileChange[]): void {
  if (changedFiles.length === 0) {
    return
  }
  logger.info('Changed Files:')
  for (const file of changedFiles) {
    let statString = ''
    if (file.insertions !== undefined || file.deletions !== undefined) {
      const insertions = file.insertions ?? 0
      const deletions = file.deletions ?? 0
      statString = ` (+${insertions}, -${deletions})`
    }
    logger.info(`- ${file.status}: ${file.path}${statString}`)
  }
}
