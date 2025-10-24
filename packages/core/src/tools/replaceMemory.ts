import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'replaceMemory',
  description: 'Replaces content of a memory topic.',
  parameters: z.object({
    topic: z.string().optional().describe('The topic to replace in memory. Defaults to ":default:".'),
    content: z.string().describe('The new content.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic, content } = toolInfo.parameters.parse(args)
  await provider.replaceMemory(topic, content)
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `Memory topic '${topic || ''}' replaced.`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
