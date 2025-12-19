import type { FullToolInfo, MemoryProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { z } from 'zod'

export const toolInfo = {
  name: 'listMemoryTopics',
  description: 'Lists all topics in memory. Use this to see what information has been stored and which topics are available to read from.',
  parameters: z.object({}),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, _args) => {
  const topics = await provider.listMemoryTopics()
  if (!topics.length) {
    return { success: true, message: { type: 'text', value: 'No topics found.' } }
  }
  return {
    success: true,
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
