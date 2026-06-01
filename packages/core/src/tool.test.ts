import { describe, expect, test } from 'bun:test'
import type { ToolResponseResultMedia } from './tool'

const mediaParts = [
  {
    type: 'image-data',
    data: 'aW1hZ2U=',
    mediaType: 'image/png',
  },
  {
    type: 'file-data',
    data: 'ZmlsZQ==',
    mediaType: 'application/pdf',
  },
  {
    type: 'media',
    data: 'bGVnYWN5',
    mediaType: 'image/png',
  },
] satisfies ToolResponseResultMedia[]

describe('ToolResponseResultMedia', () => {
  test('accepts current and deprecated SDK media content parts', () => {
    expect(mediaParts.map((part) => part.type)).toEqual(['image-data', 'file-data', 'media'])
  })
})
