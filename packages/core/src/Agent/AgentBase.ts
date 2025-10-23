import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import type { LanguageModelUsage } from 'ai'
import type { ToolResponseError, ToolResponseExit, ToolResponseResult } from '../tool'

/**
 * Enum representing different kinds of task events
 */
export enum TaskEventKind {
  StartTask = 'StartTask',
  StartRequest = 'StartRequest',
  EndRequest = 'EndRequest',
  Usage = 'Usage',
  Text = 'Text',
  Reasoning = 'Reasoning',
  ToolUse = 'ToolUse',
  ToolReply = 'ToolReply',
  ToolInvalid = 'ToolInvalid',
  ToolError = 'ToolError',
  ToolPause = 'ToolPause',
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
  userMessage: ModelMessage[]
}

/**
 * Event for request end
 */
export interface TaskEventEndRequest extends TaskEventBase {
  kind: TaskEventKind.EndRequest
  message: string
}

/**
 * Event for API usage updates
 */
export interface TaskEventUsage extends TaskEventBase {
  kind: TaskEventKind.Usage
  usage: LanguageModelUsage
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
  kind: TaskEventKind.ToolReply | TaskEventKind.ToolInvalid
  tool: string
  content: ToolResponseResult
}

export interface TaskEventToolError extends TaskEventBase {
  kind: TaskEventKind.ToolError
  tool: string
  error: ToolResponseError | ToolResponseResult
}

export interface TaskEventToolPause extends TaskEventBase {
  kind: TaskEventKind.ToolPause
  tool: string
  object: any
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
  | TaskEventUsage
  | TaskEventText
  | TaskEventToolUse
  | TaskEventToolResult
  | TaskEventToolError
  | TaskEventToolPause
  | TaskEventUsageExceeded
  | TaskEventEndTask

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type ToolResponseOrToolPause =
  | { type: 'response'; tool: string; response: LanguageModelV2ToolResultOutput; id?: string }
  | { type: 'pause'; tool: string; object: any; id?: string }

export type ExitReason =
  | { type: 'UsageExceeded' }
  | { type: 'WaitForUserInput' }
  | { type: 'Aborted' }
  | ToolResponseExit
  | {
      type: 'Pause'
      responses: ToolResponseOrToolPause[]
    }
