import { describe, expect, test } from 'bun:test'
import { boundRunnerOutput, RUNNER_OUTPUT_MAX_JSON_BYTES } from './output'

describe('runner output excerpts', () => {
  test.each(['', 'short output\n', 'x'.repeat(RUNNER_OUTPUT_MAX_JSON_BYTES - 2)])('preserves output within the encoded budget', (text) => {
    expect(boundRunnerOutput(text)).toEqual({ text, truncated: false })
  })

  test.each(['x', '🙂é', '\u0000\n\t"\\'])('bounds %j output, preserving both ends and the omitted byte count', (content) => {
    const original = `BEGIN\n${content.repeat(20_000)}\nEND`
    const result = boundRunnerOutput(original)
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(JSON.stringify(result.text))).toBeLessThanOrEqual(RUNNER_OUTPUT_MAX_JSON_BYTES)
    expect(Buffer.from(result.text).toString('utf8')).toBe(result.text)
    const match =
      /^\[runner output truncated: omitted (\d+) UTF-8 bytes;[^\n]+\]\n\n([\s\S]*)\n\n\[\.\.\. omitted output \.\.\.\]\n\n([\s\S]*)$/.exec(
        result.text,
      )
    if (!match) throw new Error('Expected a visible truncation notice and separated head/tail')
    const [, omittedBytes, head, tail] = match
    expect(head.startsWith('BEGIN\n')).toBe(true)
    expect(tail.endsWith('\nEND')).toBe(true)
    expect(original.startsWith(head)).toBe(true)
    expect(original.endsWith(tail)).toBe(true)
    expect(Number(omittedBytes)).toBe(Buffer.byteLength(original) - Buffer.byteLength(head) - Buffer.byteLength(tail))
  })

  test('truncates immediately above the encoded budget', () => {
    expect(boundRunnerOutput('x'.repeat(RUNNER_OUTPUT_MAX_JSON_BYTES - 1)).truncated).toBe(true)
  })
})
