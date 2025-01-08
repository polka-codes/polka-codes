import { expect, test } from 'bun:test'

import { allTools } from '../../tools'
import { fullSystemPrompt } from './prompts'

test('fullSystemPrompt', () => {
  const prompt = fullSystemPrompt(
    {
      os: 'Linux',
    },
    Object.values(allTools),
    'tool_',
    ['custom instructions', 'more'],
    {
      test: 'test',
      check: {
        command: 'check',
        description: 'Check the code',
      },
      format: {
        command: 'format',
        description: 'Format the code',
      },
    },
    false,
  )

  expect(prompt).toMatchSnapshot()
})
