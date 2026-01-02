/**
 * Base agent error
 */
export class AgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any,
  ) {
    super(message)
    this.name = 'AgentError'
  }
}

/**
 * Invalid state transition error
 */
export class StateTransitionError extends AgentError {
  constructor(from: string, to: string, reason?: string) {
    super(`Invalid state transition from ${from} to ${to}${reason ? `: ${reason}` : ''}`, 'INVALID_STATE_TRANSITION', { from, to })
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
    super(`Task ${taskId} failed: ${message}`, 'TASK_EXECUTION_FAILED', { taskId })
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
    super(`Workflow ${workflow} failed: ${message}`, 'WORKFLOW_INVOCATION_FAILED', { workflow })
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
    super(`Agent state corrupted: ${message}`, 'STATE_CORRUPTION', details)
    this.name = 'StateCorruptionError'
  }
}

/**
 * Resource limit exceeded error
 */
export class ResourceLimitError extends AgentError {
  constructor(limit: string, current: number, max: number) {
    super(`Resource limit exceeded: ${limit} (${current}/${max})`, 'RESOURCE_LIMIT_EXCEEDED', { limit, current, max })
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
    super(`Configuration validation failed: ${message}`, 'CONFIG_VALIDATION_FAILED', { errors: validationErrors })
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
    super(`Session conflict: ${sessionId} is already active`, 'SESSION_CONFLICT', { sessionId, existingSession })
    this.name = 'SessionConflictError'
  }
}

/**
 * Agent status error
 */
export class AgentStatusError extends AgentError {
  constructor(message: string) {
    super(message, 'AGENT_STATUS_ERROR', {})
    this.name = 'AgentStatusError'
  }
}

/**
 * Safety violation error
 */
export class SafetyViolationError extends AgentError {
  constructor(message: string) {
    super(`Safety violation: ${message}`, 'SAFETY_VIOLATION', {})
    this.name = 'SafetyViolationError'
  }
}
