import { z } from 'zod'
import { type AgentToolInfo, type FullAgentToolInfo, type ToolHandler, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'listMemoryTopics',
  description: 'Lists all topics in memory. Use this to see what information has been stored and which topics are available to read from.',
  parameters: z.object({}),
} as const satisfies AgentToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, _args) => {
  const topics = await provider.listMemoryTopics()
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
} satisfies FullAgentToolInfo
