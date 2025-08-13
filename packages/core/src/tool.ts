import type { JSONValue } from '@ai-sdk/provider'
import type { z } from 'zod'

export type ToolParameterValue = string | { [key: string]: ToolParameterValue } | ToolParameterValue[]

export type ToolExample = {
  description: string
  input: Record<string, ToolParameterValue>
}

export enum PermissionLevel {
  // This tool is completely safe
  None = 0,
  // This tool can read files
  Read = 1,
  // This tool can write files
  Write = 2,
  // This tool can perform arbitrary action
  Arbitrary = 3,
}

export type ToolParameter = {
  name: string
  description: string
  required: boolean
  usageValue?: string
  allowMultiple?: boolean
  children?: ToolParameter[]
}

export type ToolInfo = {
  name: string
  description: string
  parameters: ToolParameter[]
  examples?: ToolExample[]
  permissionLevel: PermissionLevel
}

export type ToolInfoV2 = {
  name: string
  description: string
  parameters: z.ZodObject<any>
  permissionLevel: PermissionLevel
}

export type FullToolInfo = ToolInfo & {
  handler: ToolHandler<ToolInfo, any>
  isAvailable: (provider: any) => boolean
}

export type FullToolInfoV2 = ToolInfoV2 & {
  handler: ToolHandler<ToolInfoV2, any>
  isAvailable: (provider: any) => boolean
}

export enum ToolResponseType {
  Reply = 'Reply',
  Exit = 'Exit',
  Invalid = 'Invalid',
  Error = 'Error',
  Interrupted = 'Interrupted',
  HandOver = 'HandOver',
  Delegate = 'Delegate',
  Pause = 'Pause',
}

export type ToolResponseResultMedia = {
  type: 'media'
  base64Data: string
  mediaType: string
  url: string
}

// Modified LanguageModelV2ToolResultOutput
export type ToolResponseResult =
  | {
      type: 'text'
      value: string
    }
  | {
      type: 'json'
      value: JSONValue
    }
  | {
      type: 'error-text'
      value: string
    }
  | {
      type: 'error-json'
      value: JSONValue
    }
  | {
      type: 'content'
      value: Array<
        | {
            type: 'text'
            text: string
          }
        | ToolResponseResultMedia
      >
    }

// Reply to the tool use
export type ToolResponseReply = {
  type: ToolResponseType.Reply
  message: ToolResponseResult
}

// Should end the message thread
// e.g. task completed successfully
export type ToolResponseExit = {
  type: ToolResponseType.Exit
  message: string
  object?: any
}

// The tool arguments are invalid
export type ToolResponseInvalid = {
  type: ToolResponseType.Invalid
  message: ToolResponseResult
}

// Some error occurred when executing the tool
// e.g. network request error, IO error
export type ToolResponseError = {
  type: ToolResponseType.Error
  message: ToolResponseResult
  // If true, the tool can be retried
  // e.g. network request error are generally retryable
  // but IO errors are not
  canRetry?: boolean
}

// The tool execution was interrupted
// e.g. user cancelled the tool execution
// or some security policy was violated
export type ToolResponseInterrupted = {
  type: ToolResponseType.Interrupted
  message: string
}

// Hand over the task to another agent
// e.g. hand over a coding task to the coder agent
export type ToolResponseHandOver = {
  type: ToolResponseType.HandOver
  agentName: string
  task: string
  context?: string
  files?: string[]
}

// Delegate the task to another agent
export type ToolResponseDelegate = {
  type: ToolResponseType.Delegate
  agentName: string
  task: string
  context?: string
  files?: string[]
}

export type ToolResponsePause = {
  type: ToolResponseType.Pause
  object: any
}

export type ToolResponse =
  | ToolResponseReply
  | ToolResponseExit
  | ToolResponseInvalid
  | ToolResponseError
  | ToolResponseInterrupted
  | ToolResponseHandOver
  | ToolResponseDelegate
  | ToolResponsePause

export type ToolHandler<_T, P> = (provider: P, args: Partial<Record<string, ToolParameterValue>>) => Promise<ToolResponse>
