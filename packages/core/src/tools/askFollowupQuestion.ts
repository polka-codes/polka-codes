import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { InteractionProvider } from './provider.js'

const questionObject = z.object({
  prompt: z.string().trim().min(1).describe('Concise question for the user.'),
  options: z
    .array(z.string().trim().min(1))
    .optional()
    .describe('Ordered, mutually exclusive suggested answers. Omit for free-text input.'),
})

export const toolInfo = {
  name: 'askFollowupQuestion',
  description: 'Ask concise questions when missing information blocks safe progress. Offer short, mutually exclusive options when useful.',
  parameters: z.object({
    questions: z.array(questionObject).min(1).describe('Questions that must be answered before work can continue.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, InteractionProvider> = async (provider, args) => {
  if (!provider.askFollowupQuestion) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to ask followup question.',
      },
    }
  }

  const { questions } = toolInfo.parameters.parse(args)

  const answers = []
  for (const question of questions) {
    const { prompt, options } = question
    const answer = await provider.askFollowupQuestion(prompt, options ?? [])
    answers.push(`<ask_followup_question_answer question="${prompt}">
${answer}
</ask_followup_question_answer>`)
  }

  return {
    success: true,
    message: {
      type: 'text',
      value: answers.join('\n'),
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
