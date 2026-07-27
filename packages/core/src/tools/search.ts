import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { WebProvider } from './provider.js'

export const toolInfo = {
  name: 'search',
  description: 'Search the web for current or external information. Use fetchUrl for a known URL.',
  parameters: z.object({
    query: z.string().min(1).describe('Specific web search question, including relevant scope or dates.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, WebProvider> = async (provider, args) => {
  const { query } = toolInfo.parameters.parse(args)

  if (!provider.search) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'This tool requires a web provider to be installed.',
      },
    }
  }
  const result = await provider.search(query)
  return {
    success: true,
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
