import type { FullToolInfo, TodoProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { z } from 'zod'

export const toolInfo = {
  name: 'getTodoItem',
  description: 'Get one to-do item and its direct children by id.',
  parameters: z.object({
    id: z.string().min(1).describe('To-do item id.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, TodoProvider> = async (provider, args) => {
  if (!provider.getTodoItem) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to get a to-do item.',
      },
    }
  }
  const { id } = toolInfo.parameters.parse(args)
  const item = await provider.getTodoItem(id)
  return {
    success: true,
    message: {
      type: 'json',
      value: item ?? null,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
