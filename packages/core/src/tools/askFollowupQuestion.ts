import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { InteractionProvider } from './provider'
import { getArray, getString } from './utils'

export const toolInfo = {
  name: 'ask_followup_question',
  description:
    'Call this when vital details are missing. Pose each follow-up as one direct, unambiguous question. If it speeds the reply, add up to five short, mutually-exclusive answer options. Group any related questions in the same call to avoid a back-and-forth chain.',
  parameters: [
    {
      name: 'questions',
      description: 'One or more follow-up questions you need answered before you can continue.',
      required: true,
      allowMultiple: true,
      usageValue: 'questions here',
      children: [
        {
          name: 'prompt',
          description: 'The text of the question.',
          required: true,
          usageValue: 'question text here',
        },
        {
          name: 'options',
          description: 'Ordered list of suggested answers (omit if none).',
          required: false,
          allowMultiple: true,
          usageValue: 'suggested answer here',
        },
      ],
    },
  ],
  examples: [
    {
      description: 'Single clarifying question (no options)',
      parameters: [
        {
          name: 'questions',
          value: { prompt: 'What is the target deployment environment?' },
        },
      ],
    },
    {
      description: 'Single question with multiple-choice options',
      parameters: [
        {
          name: 'questions',
          value: {
            prompt: 'Which frontend framework are you using?',
            options: ['React', 'Angular', 'Vue', 'Svelte'],
          },
        },
      ],
    },
    {
      description: 'Two related questions in one call',
      parameters: [
        {
          name: 'questions',
          value: [
            { prompt: 'What type of application are you building?' },
            {
              prompt: 'Preferred programming language?',
              options: ['JavaScript', 'TypeScript', 'Python', 'Java'],
            },
          ],
        },
      ],
    },
    {
      description: 'Binary (yes/no) confirmation',
      parameters: [
        {
          name: 'questions',
          value: {
            prompt: 'Is it acceptable to refactor existing tests to improve performance?',
            options: ['Yes', 'No'],
          },
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.None,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, InteractionProvider> = async (provider, args) => {
  if (!provider.askFollowupQuestion) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to ask followup question. Abort.',
    }
  }

  const questions = getArray(args, 'questions')
  if (!questions || questions.length === 0) {
    return {
      type: ToolResponseType.Error,
      message: 'No questions provided',
    }
  }

  const answers = []
  for (const question of questions) {
    const prompt = getString(question, 'prompt')
    const options = getArray(question, 'options', []) as string[]
    const answer = await provider.askFollowupQuestion(prompt, options)
    answers.push(`<ask_followup_question_answer question="${prompt}">
${answer}
</ask_followup_question_answer>`)
  }

  return {
    type: ToolResponseType.Reply,
    message: answers.join('\n'),
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
