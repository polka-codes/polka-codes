import type { ToolResponseError, ToolResponseExit, ToolResponseResult } from '@polka-codes/core'
import type { JsonModelMessage } from './json-ai-types'

/**
 * Enum representing different kinds of task events
 */
export enum TaskEventKind {
  StartTask = 'StartTask',
  StartRequest = 'StartRequest',
  EndRequest = 'EndRequest',
  Text = 'Text',
  Reasoning = 'Reasoning',
  ToolUse = 'ToolUse',
  ToolReply = 'ToolReply',
  ToolError = 'ToolError',
  UsageExceeded = 'UsageExceeded',
  EndTask = 'EndTask',
}

/**
 * Base interface for all task events
 */
export interface TaskEventBase {
  kind: TaskEventKind
}

/**
 * Event for task start
 */
export interface TaskEventStartTask extends TaskEventBase {
  kind: TaskEventKind.StartTask
  systemPrompt: string
}

/**
 * Event for request start
 */
export interface TaskEventStartRequest extends TaskEventBase {
  kind: TaskEventKind.StartRequest
  userMessage: JsonModelMessage[]
}

/**
 * Event for request end
 */
export interface TaskEventEndRequest extends TaskEventBase {
  kind: TaskEventKind.EndRequest
  message: string
}

/**
 * Event for text/reasoning updates
 */
export interface TaskEventText extends TaskEventBase {
  kind: TaskEventKind.Text | TaskEventKind.Reasoning
  newText: string
}

/**
 * Event for tool-related updates
 */
export interface TaskEventToolUse extends TaskEventBase {
  kind: TaskEventKind.ToolUse
  tool: string
  params: Record<string, any>
}

export interface TaskEventToolResult extends TaskEventBase {
  kind: TaskEventKind.ToolReply
  tool: string
  content: ToolResponseResult
}

export interface TaskEventToolError extends TaskEventBase {
  kind: TaskEventKind.ToolError
  tool: string
  error: ToolResponseError | ToolResponseResult
}

/**
 * Event for task usage exceeded
 */
export interface TaskEventUsageExceeded extends TaskEventBase {
  kind: TaskEventKind.UsageExceeded
}

/**
 * Event for task end
 */
export interface TaskEventEndTask extends TaskEventBase {
  kind: TaskEventKind.EndTask
  exitReason: ExitReason
}

/**
 * Union type of all possible task events
 */
export type TaskEvent =
  | TaskEventStartTask
  | TaskEventStartRequest
  | TaskEventEndRequest
  | TaskEventText
  | TaskEventToolUse
  | TaskEventToolResult
  | TaskEventToolError
  | TaskEventUsageExceeded
  | TaskEventEndTask

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type ExitReasonError = {
  type: 'Error'
  error: { message: string; stack?: string }
}

export type ExitReason = { type: 'UsageExceeded' } | ToolResponseExit | ExitReasonError
