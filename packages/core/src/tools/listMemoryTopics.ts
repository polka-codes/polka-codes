import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'listMemoryTopics',
  description: 'Lists all topics in memory.',
  parameters: z.object({}),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, _args) => {
  const topics = await provider.listTopics()
  if (!topics.length) {
    return { type: ToolResponseType.Reply, message: { type: 'text', value: 'No topics found.' } }
  }
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `Memory topics:\n${topics.join('\n')}`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
