import type { JSONValue } from '@ai-sdk/provider'
import type { z } from 'zod'

export type ToolParameterValue = string | { [key: string]: ToolParameterValue } | ToolParameterValue[]

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
  parameters: z.ZodObject<any>
}

export type FullToolInfo = ToolInfo & {
  handler: ToolHandler<ToolInfo, any>
}

export enum ToolResponseType {
  Reply = 'Reply',
  Exit = 'Exit',
  Error = 'Error',
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

// Some error occurred when executing the tool
// e.g. network request error, IO error
export type ToolResponseError = {
  type: ToolResponseType.Error
  message: ToolResponseResult
}

export type ToolResponse = ToolResponseReply | ToolResponseExit | ToolResponseError

export type ToolHandler<_T, P> = (provider: P, args: Partial<Record<string, ToolParameterValue>>) => Promise<ToolResponse>
