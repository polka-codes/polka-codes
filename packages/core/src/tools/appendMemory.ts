import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { MemoryProvider } from './provider'

export const toolInfo = {
  name: 'appendMemory',
  description: 'Appends content to a memory topic.',
  parameters: z.object({
    topic: z.string().optional().describe('The topic to append to in memory. Defaults to ":default:".'),
    content: z.string().describe('The content to append.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, MemoryProvider> = async (provider, args) => {
  const { topic, content } = toolInfo.parameters.parse(args)
  await provider.append(topic || ':default:', content)
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `Content appended to memory topic '${topic || ':default:'}'.`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
