import { z } from 'zod'
import { type AgentToolInfo, type FullAgentToolInfo, type ToolHandler, ToolResponseType } from '../tool'
import type { TodoProvider } from './provider'
import { TodoStatus } from './todo'

export const toolInfo = {
  name: 'listTodoItems',
  description: 'List all to-do items, sorted by id. If an id is provided, it lists all sub-items for that id. Can be filtered by status.',
  parameters: z.object({
    id: z.string().nullish(),
    status: TodoStatus.nullish(),
  }),
} as const satisfies AgentToolInfo

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
  const items = await provider.listTodoItems(id, status)

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
} satisfies FullAgentToolInfo
