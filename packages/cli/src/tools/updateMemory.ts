import type { FullToolInfo, MemoryProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { z } from 'zod'

export const toolInfo = {
  name: 'updateMemory',
  description: 'Append, replace, or remove durable context in a memory topic.',
  parameters: z
    .object({
      operation: z.enum(['append', 'replace', 'remove']).describe('Memory operation.'),
      topic: z.string().min(1).nullish().describe('Topic name. Omit for ":default:".'),
      content: z.string().nullish().describe('Content for append or replace. Omit for remove.'),
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
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  if (!provider.updateMemory) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Memory operations are not supported by the current provider.',
      },
    }
  }
  const params = toolInfo.parameters.parse(args)

  await provider.updateMemory(params.operation, params.topic ?? undefined, params.content ?? undefined)

  const topic = params.topic || ':default:'
  const messages = {
    append: `Content appended to memory topic '${topic}'`,
    replace: `Memory topic '${topic}' replaced`,
    remove: `Memory topic '${topic}' removed`,
  }

  return {
    success: true,
    message: {
      type: 'text',
      value: messages[params.operation],
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
