import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { TodoProvider } from './provider'
import { UpdateTodoItemInputSchema } from './todo'

export const toolInfo = {
  name: 'updateTodoItem',
  description: 'Add or update a to-do item.',
  parameters: UpdateTodoItemInputSchema,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, TodoProvider> = async (provider, args) => {
  if (!provider.updateTodoItem) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to update a to-do item.',
      },
    }
  }
  const input = toolInfo.parameters.parse(args)
  const result = await provider.updateTodoItem(input)
  return {
    success: true,
    message: {
      type: 'json',
      value: result,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
