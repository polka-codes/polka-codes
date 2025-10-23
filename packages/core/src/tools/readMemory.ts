import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'readMemory',
  description: 'Reads content from a memory topic.',
  parameters: z.object({
    topic: z.string().optional().describe('The topic to read from memory. Defaults to ":default:".'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic } = toolInfo.parameters.parse(args)
  const content = await provider.read(topic || ':default:')
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: content || `No content found for memory topic '${topic || ':default:'}'.`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
