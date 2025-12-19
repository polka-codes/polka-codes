import type { FullToolInfo, TodoProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { z } from 'zod'

export const toolInfo = {
  name: 'getTodoItem',
  description: 'Get a to-do item by its ID.',
  parameters: z.object({
    id: z.string().describe('The ID of the to-do item.'),
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
