import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { InteractionProvider } from './provider'
import { getString } from './utils'

export const toolInfo = {
  name: 'attempt_completion',
  description:
    'Use this tool when you believe the user’s requested task is complete. Indicate that your work is finished, but acknowledge the user may still provide additional instructions or questions if they want to continue. This tool MUST NOT to be used with any other tool.',
  parameters: [
    {
      name: 'result',
      description:
        "The result of the task. Formulate this result in a way that is final and does not require further input from the user. Don't end your result with questions or offers for further assistance.",
      required: true,
      usageValue: 'Your final result description here',
    },
  ],
  examples: [
    {
      description: 'Request to present the result of the task',
      parameters: [
        {
          name: 'result',
          value: 'Your final result description here',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.None,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, InteractionProvider> = async (provider, args) => {
  const result = getString(args, 'result')

  const moreMessage = await provider.attemptCompletion?.(result)

  if (!moreMessage) {
    return {
      type: ToolResponseType.Exit,
      message: result,
    }
  }

  return {
    type: ToolResponseType.Reply,
    message: `<user_message>${moreMessage}</user_message>`,
  }
}

export const isAvailable = (provider: InteractionProvider): boolean => {
  return true
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
