import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { InteractionProvider } from './provider'
import { getString, getStringArray } from './utils'

export const toolInfo = {
  name: 'ask_followup_question',
  description:
    'Whenever you need extra details or clarification to complete the task, pose a direct question to the user. Use this tool sparingly to avoid excessive back-and-forth. If helpful, offer multiple-choice options or examples to guide the user’s response.',
  parameters: [
    {
      name: 'question',
      description: 'The question to ask the user. This should be a clear, specific question that addresses the information you need.',
      required: true,
      usageValue: 'Your question here',
    },
    {
      name: 'options',
      description:
        'A comma separated list of possible answers to the question. If not provided, the user will be prompted to provide an answer.',
      required: false,
      usageValue: 'A comma separated list of possible answers (optional)',
    },
  ],
  examples: [
    {
      description: 'Request to ask a question',
      parameters: [
        {
          name: 'question',
          value: 'What is the name of the project?',
        },
      ],
    },
    {
      description: 'Request to ask a question with options',
      parameters: [
        {
          name: 'question',
          value: 'What framework do you use?',
        },
        {
          name: 'options',
          value: 'React,Angular,Vue,Svelte',
        },
      ],
    },
  ],
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, InteractionProvider> = async (provider, args) => {
  if (!provider.askFollowupQuestion) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to ask followup question. Abort.',
    }
  }

  const question = getString(args, 'question')
  const options = getStringArray(args, 'options', [])

  const answer = await provider.askFollowupQuestion(question, options)

  return {
    type: ToolResponseType.Reply,
    message: `<ask_followup_question_question>${question}</ask_followup_question_question>
<ask_followup_question_answer>${answer}</ask_followup_question_answer>`,
  }
}

export const isAvailable = (provider: InteractionProvider): boolean => {
  return !!provider.askFollowupQuestion
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
