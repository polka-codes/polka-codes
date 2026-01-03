/**
 * Error suggestions for common issues
 */
export interface ErrorSuggestions {
  /** Short, actionable suggestions */
  suggestions: string[]
  /** Relevant documentation links */
  docs?: string[]
  /** Related files to check */
  files?: string[]
  /** Recovery steps */
  recovery?: string[]
}

/**
 * Format any error for display
 * Uses enhanced formatting for AgentError, basic formatting for other errors
 */
export function formatError(error: unknown): string {
  if (error instanceof AgentError) {
    return error.getFormattedMessage()
  }

  if (error instanceof Error) {
    return `❌ ${error.name}: ${error.message}\n   ${error.stack || ''}`
  }

  return `❌ Error: ${String(error)}`
}

/**
 * Base agent error with enhanced context and suggestions
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
    public readonly suggestions?: ErrorSuggestions,
  ) {
    super(message)
    this.name = 'AgentError'
  }

  /**
   * Get formatted error message with suggestions
   */
  getFormattedMessage(): string {
    let output = `❌ ${this.message}\n`
    output += `   Error Code: ${this.code}\n`

    if (this.details && Object.keys(this.details).length > 0) {
      output += `   Details: ${JSON.stringify(this.details, null, 2)}\n`
    }

    if (this.suggestions) {
      if (this.suggestions.suggestions.length > 0) {
        output += `\n   💡 Suggestions:\n`
        this.suggestions.suggestions.forEach((s, i) => {
          output += `      ${i + 1}. ${s}\n`
        })
      }

      if (this.suggestions.recovery && this.suggestions.recovery.length > 0) {
        output += `\n   🔧 Recovery Steps:\n`
        this.suggestions.recovery.forEach((r, i) => {
          output += `      ${i + 1}. ${r}\n`
        })
      }

      if (this.suggestions.files && this.suggestions.files.length > 0) {
        output += `\n   📁 Check Files:\n`
        this.suggestions.files.forEach((f) => {
          output += `      - ${f}\n`
        })
      }

      if (this.suggestions.docs && this.suggestions.docs.length > 0) {
        output += `\n   📚 Documentation:\n`
        this.suggestions.docs.forEach((d) => {
          output += `      - ${d}\n`
        })
      }
    }

    return output
  }
}

/**
 * Invalid state transition error
 */
export class StateTransitionError extends AgentError {
  constructor(from: string, to: string, reason?: string) {
    const details = { from, to, reason }
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Check if the agent is in the correct state for this operation`,
        `Review the state machine in ARCHITECTURE.md`,
        `Ensure previous operations completed successfully`,
      ],
      recovery: [
        `Wait for current operation to complete`,
        `Call stop() to reset the agent to idle state`,
        `Check agent status with getCurrentStatus()`,
      ],
      files: [
        'packages/cli/src/agent/orchestrator.ts',
        'packages/cli/src/agent/state-manager.ts',
        'packages/cli/src/agent/ARCHITECTURE.md',
      ],
    }

    super(`Invalid state transition from ${from} to ${to}${reason ? `: ${reason}` : ''}`, 'INVALID_STATE_TRANSITION', details, suggestions)
    this.name = 'StateTransitionError'
  }
}

/**
 * Task execution error
 */
export class TaskExecutionError extends AgentError {
  constructor(
    taskId: string,
    message: string,
    public readonly originalError?: Error,
  ) {
    const details = { taskId, originalError: originalError?.message }
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Check the task logs for more details`,
        `Verify all required dependencies are installed`,
        `Ensure the task input is valid`,
        `Check if there are sufficient system resources`,
      ],
      recovery: [
        `Review the error details above`,
        `Fix the underlying issue and retry the task`,
        `Use --dry-run to test without making changes`,
        `Check logs in the state directory for full stack traces`,
      ],
      files: ['packages/cli/src/agent/executor.ts', 'packages/cli/src/agent/workflow-adapter.ts'],
      docs: ['Task Execution: packages/cli/src/agent/ARCHITECTURE.md#task-executor'],
    }

    super(`Task ${taskId} failed: ${message}`, 'TASK_EXECUTION_FAILED', details, suggestions)
    this.name = 'TaskExecutionError'
  }
}

/**
 * Workflow invocation error
 */
export class WorkflowInvocationError extends AgentError {
  constructor(
    workflow: string,
    message: string,
    public readonly originalError?: Error,
  ) {
    const details = { workflow, originalError: originalError?.message }
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Verify the workflow name is correct`,
        `Check if the workflow exists in packages/cli/src/workflows/`,
        `Ensure workflow input matches expected schema`,
        `Check if the workflow was cancelled or timed out`,
      ],
      recovery: [
        `Check workflow implementation for issues`,
        `Verify all required tools are available`,
        `Review workflow input/output format`,
        `Test the workflow manually using the CLI`,
      ],
      files: ['packages/cli/src/agent/workflow-adapter.ts', `packages/cli/src/workflows/${workflow}.workflow.ts`],
      docs: ['Workflows: packages/cli/src/agent/ARCHITECTURE.md#workflow-adapter'],
    }

    super(`Workflow ${workflow} failed: ${message}`, 'WORKFLOW_INVOCATION_FAILED', details, suggestions)
    this.name = 'WorkflowInvocationError'
  }
}

/**
 * State corruption error
 */
export class StateCorruptionError extends AgentError {
  constructor(
    message: string,
    public readonly details?: any,
  ) {
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `State file may have been modified externally`,
        `Disk corruption or filesystem issues`,
        `Concurrent writes to state file`,
        `Incomplete shutdown or crash`,
      ],
      recovery: [
        `Delete the corrupted state file in /tmp/polka-agent-*`,
        `Restart the agent to create a fresh state`,
        `Check filesystem health and disk space`,
        `Ensure no other agent instances are running`,
      ],
      files: ['packages/cli/src/agent/state-manager.ts', 'packages/cli/src/agent/session.ts'],
    }

    super(`Agent state corrupted: ${message}`, 'STATE_CORRUPTION', details, suggestions)
    this.name = 'StateCorruptionError'
  }
}

/**
 * Resource limit exceeded error
 */
export class ResourceLimitError extends AgentError {
  constructor(limit: string, current: number, max: number) {
    const details = { limit, current, max, usagePercent: ((current / max) * 100).toFixed(1) }
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Increase the resource limit in agent config`,
        `Reduce task complexity or break into smaller tasks`,
        `Close other applications to free up resources`,
        `Check for memory leaks or inefficient operations`,
      ],
      recovery: [
        `Wait for current operations to complete`,
        `Adjust config.resourceLimits in agent config`,
        `Use smaller batch sizes for operations`,
        `Monitor resource usage with system tools`,
      ],
      files: ['packages/cli/src/agent/resource-monitor.ts', 'packages/cli/src/agent/config.ts'],
    }

    super(`Resource limit exceeded: ${limit} (${current}/${max})`, 'RESOURCE_LIMIT_EXCEEDED', details, suggestions)
    this.name = 'ResourceLimitError'
  }
}

/**
 * Configuration validation error
 */
export class ConfigValidationError extends AgentError {
  constructor(
    message: string,
    public readonly validationErrors: string[],
  ) {
    const details = { validationErrors }
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Review your agent configuration file`,
        `Check for required fields that are missing`,
        `Verify data types match expected values`,
        `Ensure enum values are from allowed set`,
      ],
      recovery: [
        `Fix the validation errors listed above`,
        `Use --config flag to specify valid config file`,
        `Check example config in packages/cli/src/agent/config.ts`,
        `Use default config preset: --preset balanced`,
      ],
      files: ['packages/cli/src/agent/config.ts', 'packages/cli/src/agent/types.ts'],
      docs: ['Configuration: packages/cli/src/agent/ARCHITECTURE.md#configuration'],
    }

    super(`Configuration validation failed: ${message}`, 'CONFIG_VALIDATION_FAILED', details, suggestions)
    this.name = 'ConfigValidationError'
  }
}

/**
 * Session conflict error
 */
export class SessionConflictError extends AgentError {
  constructor(
    sessionId: string,
    public readonly existingSession?: any,
  ) {
    const details = { sessionId, existingSession }
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Another agent instance is already running`,
        `Previous session may not have shut down cleanly`,
        `Check for running agent processes`,
      ],
      recovery: [
        `Wait for the other session to complete`,
        `Stop the other agent instance if it's hung`,
        `Delete stale lock file: /tmp/polka-agent-*.lock`,
        `Check processes: ps aux | grep polka`,
      ],
      files: ['packages/cli/src/agent/session.ts', 'packages/cli/src/agent/orchestrator.ts'],
    }

    super(`Session conflict: ${sessionId} is already active`, 'SESSION_CONFLICT', details, suggestions)
    this.name = 'SessionConflictError'
  }
}

/**
 * Agent status error
 */
export class AgentStatusError extends AgentError {
  constructor(message: string) {
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Agent may be in an invalid state`,
        `Check if the agent was properly initialized`,
        `Review the agent lifecycle in ARCHITECTURE.md`,
      ],
      recovery: [
        `Restart the agent to reset its state`,
        `Ensure initialize() was called before operations`,
        `Check agent state with getCurrentStatus()`,
      ],
      files: ['packages/cli/src/agent/orchestrator.ts', 'packages/cli/src/agent/ARCHITECTURE.md'],
    }

    super(message, 'AGENT_STATUS_ERROR', {}, suggestions)
    this.name = 'AgentStatusError'
  }
}

/**
 * Safety violation error
 */
export class SafetyViolationError extends AgentError {
  constructor(message: string) {
    const suggestions: ErrorSuggestions = {
      suggestions: [
        `Operation was blocked for safety reasons`,
        `Review the approval workflow settings`,
        `Check if operation is in destructiveOperations blacklist`,
        `Ensure proper approval workflow is followed`,
      ],
      recovery: [
        `Adjust approval level in agent config`,
        `Manually approve the operation if safe`,
        `Update destructiveOperations config if needed`,
        `Use --yes flag for auto-approval (use with caution)`,
      ],
      files: ['packages/cli/src/agent/safety/checks.ts', 'packages/cli/src/agent/safety/approval.ts', 'packages/cli/src/agent/config.ts'],
      docs: ['Safety Features: packages/cli/src/agent/ARCHITECTURE.md#safety-features'],
    }

    super(`Safety violation: ${message}`, 'SAFETY_VIOLATION', {}, suggestions)
    this.name = 'SafetyViolationError'
  }
}
