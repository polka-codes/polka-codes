import { describe, expect, test } from 'bun:test'
import { formatRunnerToolResponse } from './runner'
import { wsIncomingMessageSchema } from './types'

describe('Runner tool response normalization', () => {
  test('preserves tagged image and file content', () => {
    expect(
      formatRunnerToolResponse('readBinaryFile', {
        type: 'content',
        value: [
          {
            type: 'file',
            data: { type: 'data', data: 'aGVsbG8=' },
            mediaType: 'image/png',
          },
          {
            type: 'file',
            data: { type: 'data', data: 'ZmlsZQ==' },
            mediaType: 'application/pdf',
          },
        ],
      }),
    ).toEqual([
      { type: 'text', text: '<tool_response name=readBinaryFile>' },
      { type: 'image', mediaType: 'image/png', source: { type: 'base64', data: 'aGVsbG8=' } },
      { type: 'file', mediaType: 'application/pdf', source: { type: 'base64', data: 'ZmlsZQ==' } },
      { type: 'text', text: '</tool_response>' },
    ])
  })

  test('normalizes URL results without private runner state', () => {
    expect(
      formatRunnerToolResponse('readBinaryFile', {
        type: 'content',
        value: [
          { type: 'image-url', url: 'https://example.com/image.png' },
          { type: 'file-url', url: 'https://example.com/file.pdf' },
        ],
      }),
    ).toEqual([
      { type: 'text', text: '<tool_response name=readBinaryFile>' },
      { type: 'text', text: '<media url="https://example.com/image.png" />' },
      { type: 'text', text: '<media url="https://example.com/file.pdf" />' },
      { type: 'text', text: '</tool_response>' },
    ])
  })

  test('requires incoming tool parameters to be an object', () => {
    const message = { type: 'pending_tools', step: 1, requests: [{ index: 0, tool: 'readFile', params: null }] }

    expect(wsIncomingMessageSchema.safeParse(message).success).toBe(false)
  })
})
