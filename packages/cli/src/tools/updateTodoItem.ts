import type { FullToolInfo, TodoProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { UpdateTodoItemInputSchema } from '@polka-codes/core'

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
