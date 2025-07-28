import { z } from 'zod'
import { type FullToolInfoV2, PermissionLevel, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { InteractionProvider } from './provider'

const questionObject = z.object({
  prompt: z.string().describe('The text of the question.').meta({ usageValue: 'question text here' }),
  options: z
    .array(z.string())
    .default([])
    .describe('Ordered list of suggested answers (omit if none).')
    .meta({ usageValue: 'suggested answer here' }),
})

export const toolInfo = {
  name: 'ask_followup_question',
  description:
    'Call this when vital details are missing. Pose each follow-up as one direct, unambiguous question. If it speeds the reply, add up to five short, mutually-exclusive answer options. Group any related questions in the same call to avoid a back-and-forth chain.',
  parameters: z
    .object({
      questions: z
        .array(questionObject)
        .describe('One or more follow-up questions you need answered before you can continue.')
        .meta({ usageValue: 'questions here' }),
    })
    .meta({
      examples: [
        {
          description: 'Single clarifying question (no options)',
          input: {
            questions: { prompt: 'What is the target deployment environment?' },
          },
        },
        {
          description: 'Single question with multiple-choice options',
          input: {
            questions: {
              prompt: 'Which frontend framework are you using?',
              options: ['React', 'Angular', 'Vue', 'Svelte'],
            },
          },
        },
        {
          description: 'Two related questions in one call',
          input: {
            questions: [
              { prompt: 'What type of application are you building?' },
              {
                prompt: 'Preferred programming language?',
                options: ['JavaScript', 'TypeScript', 'Python', 'Java'],
              },
            ],
          },
        },
        {
          description: 'Binary (yes/no) confirmation',
          input: {
            questions: {
              prompt: 'Is it acceptable to refactor existing tests to improve performance?',
              options: ['Yes', 'No'],
            },
          },
        },
      ],
    }),
  permissionLevel: PermissionLevel.None,
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, InteractionProvider> = async (provider, args) => {
  if (!provider.askFollowupQuestion) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to ask followup question. Abort.',
    }
  }

  const { questions } = toolInfo.parameters.parse(args)
  if (questions.length === 0) {
    return {
      type: ToolResponseType.Invalid,
      message: 'No questions provided',
    }
  }

  const answers = []
  for (const question of questions) {
    const { prompt, options } = question
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
} satisfies FullToolInfoV2
