import { z } from 'zod'
import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { InteractionProvider } from './provider'

export const toolInfo = {
  name: 'attemptCompletion',
  description:
    'Use this tool when you believe the user’s requested task is complete. Indicate that your work is finished, but acknowledge the user may still provide additional instructions or questions if they want to continue. This tool MUST NOT to be used with any other tool.',
  parameters: z
    .object({
      result: z
        .string()
        .describe(
          "The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
        )
        .meta({ usageValue: 'Your final result description here' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to present the result of the task',
          input: {
            result: 'Your final result description here',
          },
        },
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, InteractionProvider> = async (provider, args) => {
  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      type: ToolResponseType.Invalid,
      message: {
        type: 'error-text',
        value: `Invalid arguments for attemptCompletion: ${parsed.error.message}`,
      },
    }
  }
  const { result } = parsed.data
  const moreMessage = await provider.attemptCompletion?.(result)

  if (!moreMessage) {
    return {
      type: ToolResponseType.Exit,
      message: result,
    }
  }

  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `<user_message>${moreMessage}</user_message>`,
    },
  }
}

export const isAvailable = (_provider: InteractionProvider): boolean => {
  return true
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
