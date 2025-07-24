import { expect, test } from 'bun:test'

import { toToolInfoV1 } from '../../tool-v1-compat'
import { allTools } from '../../tools'
import { fullSystemPrompt } from './prompts'

test('fullSystemPrompt', () => {
  const prompt = fullSystemPrompt(
    {
      os: 'Linux',
    },
    Object.values(allTools).map(toToolInfoV1),
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
