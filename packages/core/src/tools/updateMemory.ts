import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'updateMemory',
  description: 'Appends, replaces, or removes content from a memory topic.',
  parameters: z.discriminatedUnion('operation', [
    z.object({
      operation: z.literal('append'),
      topic: z.string().nullish().describe('The topic to update in memory. Defaults to ":default:".'),
      content: z.string().describe('The content to append.'),
    }),
    z.object({
      operation: z.literal('replace'),
      topic: z.string().nullish().describe('The topic to update in memory. Defaults to ":default:".'),
      content: z.string().describe('The content to replace with.'),
    }),
    z.object({
      operation: z.literal('remove'),
      topic: z.string().nullish().describe('The topic to update in memory. Defaults to ":default:".'),
    }),
  ]),
} as const satisfies ToolInfo

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

  await provider.updateMemory(params.operation, params.topic ?? undefined, 'content' in params ? params.content : undefined)

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
} satisfies FullToolInfo
