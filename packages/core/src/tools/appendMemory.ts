import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'appendMemory',
  description: 'Appends content to a memory topic.',
  parameters: z.object({
    topic: z.string().nullish().describe('The topic to append to in memory. Defaults to ":default:".'),
    content: z.string().describe('The content to append.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic, content } = toolInfo.parameters.parse(args)
  await provider.appendMemory(topic ?? undefined, content)
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `Content appended to memory topic '${topic || ''}'.`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
