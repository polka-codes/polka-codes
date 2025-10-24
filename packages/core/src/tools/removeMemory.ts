import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'removeMemory',
  description: 'Removes a topic from memory.',
  parameters: z.object({
    topic: z.string().optional().describe('The topic to remove from memory. Defaults to ":default:".'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic } = toolInfo.parameters.parse(args)
  await provider.removeMemory(topic)
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `Memory topic '${topic || ''}' removed.`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
