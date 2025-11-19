import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { WebProvider } from './provider'

export const toolInfo = {
  name: 'search',
  description: 'Search the web for information.',
  parameters: z.object({
    query: z.string().describe('The query to search for'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, WebProvider> = async (provider, args) => {
  const { query } = toolInfo.parameters.parse(args)

  if (!provider.search) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'text',
        value: 'This tool requires a web provider to be installed.',
      },
    }
  }
  const result = await provider.search(query)
  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: result,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
