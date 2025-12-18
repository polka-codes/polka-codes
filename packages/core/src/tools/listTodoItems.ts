import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { TodoProvider } from './provider'
import { TodoStatus } from './todo'

export const toolInfo = {
  name: 'listTodoItems',
  description: 'List all to-do items, sorted by id. If an id is provided, it lists all sub-items for that id. Can be filtered by status.',
  parameters: z.object({
    id: z.string().nullish(),
    status: TodoStatus.nullish(),
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
