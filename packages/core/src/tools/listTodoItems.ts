import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { TodoProvider } from './provider'

export const toolInfo = {
  name: 'listTodoItems',
  description: 'List all to-do items. If an id is provided, it lists all sub-items for that id.',
  parameters: z.object({
    id: z.string().nullish(),
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
  const { id } = toolInfo.parameters.parse(args)
  const items = await provider.listTodoItems(id)
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
