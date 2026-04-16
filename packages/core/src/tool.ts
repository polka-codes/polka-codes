import type { ToolResultOutput } from '@ai-sdk/provider-utils'
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

export type ToolResponseResult = ToolResultOutput

export type ToolResponseResultContentPart = Extract<ToolResponseResult, { type: 'content' }>['value'][number]
export type ToolResponseResultMedia = Extract<ToolResponseResultContentPart, { type: 'media' }>

export type ToolResponse = {
  success: boolean
  message: ToolResponseResult
}

export type ToolHandler<_T, P> = (provider: P, args: Partial<Record<string, ToolParameterValue>>) => Promise<ToolResponse>
