import type { FullToolInfo, MemoryProvider, ToolHandler, ToolInfo } from '@polka-codes/core'
import { z } from 'zod'

export const toolInfo = {
  name: 'readMemory',
  description: 'Read content from a memory topic. If no topic is specified, reads from the default topic.',
  parameters: z.object({
    topic: z.string().nullish().describe('The topic to read from memory. Defaults to ":default:".'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic } = toolInfo.parameters.parse(args)
  const content = await provider.readMemory(topic ?? undefined)
  if (content) {
    return {
      success: true,
      message: {
        type: 'text',
        value: `<memory${topic ? ` topic="${topic}"` : ''}>\n${content}\n</memory>`,
      },
    }
  }
  return {
    success: true,
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
