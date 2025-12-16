import { z } from 'zod'
import { type AgentToolInfo, type FullAgentToolInfo, type ToolHandler, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'updateMemory',
  description:
    'Appends, replaces, or removes content from a memory topic. Use "append" to add to existing content, "replace" to overwrite entirely, or "remove" to delete a topic. Memory persists across tool calls within a workflow.',
  parameters: z
    .object({
      operation: z.enum(['append', 'replace', 'remove']).describe('The operation to perform.'),
      topic: z.string().nullish().describe('The topic to update in memory. Defaults to ":default:".'),
      content: z.string().nullish().describe('The content for append or replace operations. Must be omitted for remove operation.'),
    })
    .superRefine((data, ctx) => {
      if (data.operation === 'append' || data.operation === 'replace') {
        if (data.content === undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Content is required for "append" and "replace" operations.',
            path: ['content'],
          })
        }
      } else if (data.operation === 'remove') {
        if (data.content !== undefined) {
          ctx.addIssue({
            code: 'custom',
            message: 'Content must not be provided for "remove" operation.',
            path: ['content'],
          })
        }
      }
    }),
} as const satisfies AgentToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  if (!provider.updateMemory) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: 'Memory operations are not supported by the current provider.',
      },
    }
  }
  const params = toolInfo.parameters.parse(args)

  await provider.updateMemory(params.operation, params.topic ?? undefined, params.content ?? undefined)

  switch (params.operation) {
    case 'append':
      return {
        type: ToolResponseType.Reply,
        message: {
          type: 'text',
          value: `Content appended to memory topic '${params.topic || ':default:'}'.`,
        },
      }
    case 'replace':
      return {
        type: ToolResponseType.Reply,
        message: {
          type: 'text',
          value: `Memory topic '${params.topic || ':default:'}' replaced.`,
        },
      }
    case 'remove':
      return {
        type: ToolResponseType.Reply,
        message: {
          type: 'text',
          value: `Memory topic '${params.topic || ':default:'}' removed.`,
        },
      }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullAgentToolInfo
