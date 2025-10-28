import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'readMemory',
  description:
    'Reads content from a memory topic. Use this to retrieve information stored in previous steps. If no topic is specified, reads from the default topic.',
  parameters: z.object({
    topic: z.string().optional().describe('The topic to read from memory. Defaults to ":default:".'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic } = toolInfo.parameters.parse(args)
  const content = await provider.readMemory(topic)
  if (content) {
    return {
      type: ToolResponseType.Reply,
      message: {
        type: 'text',
        value: `<memory${topic ? ` topic="${topic}"` : ''}>\n${content}\n</memory>`,
      },
    }
  }
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `<memory ${topic ? `topic="${topic}"` : ''} isEmpty="true" />`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
