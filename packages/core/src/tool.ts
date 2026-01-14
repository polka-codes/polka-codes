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

export type ToolResponseResultMedia = {
  type: 'media'
  data: string // base64 encoded
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

export type ToolResponse = {
  success: boolean
  message: ToolResponseResult
}

/**
 * Shared context for tool handlers.
 * Provides access to session-level state like file read tracking.
 */
export type ToolContext = {
  // Set of files that have been read (for read-first enforcement)
  readSet?: Set<string>
  // Additional metadata that can be shared across tool invocations
  metadata?: Record<string, unknown>
}

export type ToolHandler<_T, P> = (
  provider: P,
  args: Partial<Record<string, ToolParameterValue>>,
  context?: ToolContext,
) => Promise<ToolResponse>
