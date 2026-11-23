import { describe, expect, it } from 'bun:test'
import { parseJsonFromMarkdown } from './parseJsonFromMarkdown'

describe('parseJsonFromMarkdown', () => {
  it.each(['{"key":"value"}', '```\n{"key":"value"}\n```', '  ```JSON \r\n{"key":"value"}\r\n```\n'])(
    'parses a raw or fenced JSON object from %j',
    (text) => {
      expect(parseJsonFromMarkdown(text)).toEqual({ success: true, data: { key: 'value' } })
    },
  )

  it('parses an array', () => {
    expect(parseJsonFromMarkdown('```json\n[1,true,null]\n```')).toEqual({ success: true, data: [1, true, null] })
  })

  it('preserves a JSON string containing serialized JSON', () => {
    const value = '{"key":"value"}'
    const encoded = JSON.stringify(value)
    expect(parseJsonFromMarkdown(encoded)).toEqual({ success: true, data: value })
    expect(parseJsonFromMarkdown(`\`\`\`json\n${encoded}\n\`\`\``)).toEqual({ success: true, data: value })
  })

  it.each([
    'Before\n```json\n{}\n```',
    '```json\n{}\n```\nAfter',
    '{} []',
    '```json\n{}\n```\n```json\n[]\n```',
    '```json\n{"private text":invalid}\n```',
    'This is just a string.',
  ])('rejects invalid input without including it in the error (%j)', (text) => {
    expect(parseJsonFromMarkdown(text)).toEqual({ success: false, error: 'No JSON object found in the string.' })
  })
})
