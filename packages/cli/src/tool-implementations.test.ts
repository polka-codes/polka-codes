import { describe, expect, test } from 'bun:test'
import { prepareGenerateTextRequest } from './tool-implementations'

describe('prepareGenerateTextRequest', () => {
  test('moves system messages into the dedicated system prompt', () => {
    const request = prepareGenerateTextRequest(
      {
        systemPrompt: 'Primary system prompt.',
        messages: [
          { role: 'system', content: 'Continuation system prompt.' },
          { role: 'user', content: 'User request.' },
          { role: 'assistant', content: 'Assistant reply.' },
        ],
      },
      'openai',
      'gpt-5-mini',
    )

    expect(request.system).toBe('Primary system prompt.\n\nContinuation system prompt.')
    expect(request.messages).toEqual([
      { role: 'user', content: 'User request.' },
      { role: 'assistant', content: 'Assistant reply.' },
    ])
  })
})
