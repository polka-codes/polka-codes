import { describe, expect, test } from 'bun:test'
import type { ModelMessage } from '@ai-sdk/provider-utils'
import { fromJsonModelMessage, toJsonModelMessage } from './json-ai-types'

describe('JSON AI message conversion', () => {
  test('preserves tagged file data and provider references', () => {
    const message: ModelMessage = {
      role: 'user',
      content: [
        {
          type: 'file',
          mediaType: 'text/plain',
          data: { type: 'text', text: 'hello' },
        },
        {
          type: 'file',
          mediaType: 'application/pdf',
          data: { type: 'reference', reference: { openai: 'file-123' } },
        },
        {
          type: 'image',
          mediaType: 'image/png',
          image: { openai: 'file-456' },
        },
      ],
    }

    const jsonMessage = toJsonModelMessage(message)
    expect(JSON.parse(JSON.stringify(jsonMessage))).toEqual(jsonMessage)
    expect(fromJsonModelMessage(jsonMessage)).toEqual(message)
  })

  test('serializes reasoning files and nested tool-result files', () => {
    const message: ModelMessage = {
      role: 'assistant',
      content: [
        {
          type: 'reasoning-file',
          data: { type: 'url', url: new URL('https://example.com/reasoning.txt') },
          mediaType: 'text/plain',
        },
        {
          type: 'tool-result',
          toolCallId: 'call-1',
          toolName: 'readBinaryFile',
          output: {
            type: 'content',
            value: [
              {
                type: 'file',
                data: { type: 'data', data: Buffer.from('file') },
                mediaType: 'application/octet-stream',
              },
            ],
          },
        },
      ],
    }

    const jsonMessage = toJsonModelMessage(message)
    expect(JSON.parse(JSON.stringify(jsonMessage))).toEqual(jsonMessage)
    expect(fromJsonModelMessage(jsonMessage)).toEqual(message)
  })
})
