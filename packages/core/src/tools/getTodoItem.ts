import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { TodoProvider } from './provider'

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
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: 'Not possible to get a to-do item.',
      },
    }
  }
  const { id } = toolInfo.parameters.parse(args)
  const item = await provider.getTodoItem(id)
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'json',
      value: item,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
