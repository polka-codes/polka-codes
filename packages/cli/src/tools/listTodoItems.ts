import type { FullToolInfo, TodoProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { TodoStatus } from '@polka-codes/core'
import { z } from 'zod'

export const toolInfo = {
  name: 'listTodoItems',
  description: 'List root to-do items, or the direct children of one item, optionally filtered by status.',
  parameters: z.object({
    id: z.string().min(1).nullish().describe('Parent item id. Omit to list root items.'),
    status: TodoStatus.nullish().describe('Status filter.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, TodoProvider> = async (provider, args) => {
  if (!provider.listTodoItems) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to list to-do items.',
      },
    }
  }
  const { id, status } = toolInfo.parameters.parse(args)
  const items = await provider.listTodoItems(id, status)

  return {
    success: true,
    message: {
      type: 'json',
      value: items,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
