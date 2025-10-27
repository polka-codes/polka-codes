import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
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
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: 'Not possible to list to-do items.',
      },
    }
  }
  const { id, status } = toolInfo.parameters.parse(args)
  let items = await provider.listTodoItems(id)

  if (status) {
    items = items.filter((item) => item.status === status)
  }

  items.sort((a, b) => {
    const aParts = a.id.split('.')
    const bParts = b.id.split('.')
    const len = Math.min(aParts.length, bParts.length)
    for (let i = 0; i < len; i++) {
      const comparison = aParts[i].localeCompare(bParts[i], undefined, { numeric: true })
      if (comparison !== 0) {
        return comparison
      }
    }
    return aParts.length - bParts.length
  })

  return {
    type: ToolResponseType.Reply,
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
