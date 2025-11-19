import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { WebProvider } from './provider'

export const toolInfo = {
  name: 'search',
  description:
    'Search the web for information using Google Search. Use this tool to find current information, facts, news, documentation, or research that is not available in your training data. Returns comprehensive search results with relevant content extracted from the web.',
  parameters: z
    .object({
      query: z.string().describe('The query to search for').meta({ usageValue: 'Your search query here' }),
    })
    .meta({
      examples: [
        {
          description: 'Search for current events or news',
          input: {
            query: 'latest developments in AI language models 2024',
          },
        },
        {
          description: 'Look up technical documentation',
          input: {
            query: 'TypeScript advanced type system features',
          },
        },
        {
          description: 'Research specific information',
          input: {
            query: 'Node.js performance optimization best practices',
          },
        },
      ],
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
