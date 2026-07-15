import { describe, expect, test } from 'bun:test'
import type { ToolResponseResultMedia } from './tool'

const mediaParts = [
  {
    type: 'file',
    data: { type: 'data', data: 'aW1hZ2U=' },
    mediaType: 'image/png',
  },
  {
    type: 'file-data',
    data: 'ZmlsZQ==',
    mediaType: 'application/pdf',
  },
] satisfies ToolResponseResultMedia[]

describe('ToolResponseResultMedia', () => {
  test('accepts current and supported deprecated SDK media content parts', () => {
    expect(mediaParts.map((part) => part.type)).toEqual(['file', 'file-data'])
  })
})
