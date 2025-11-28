import { describe, expect, test } from 'bun:test'
import { PassThrough } from 'node:stream'
import { TaskEventKind } from '@polka-codes/core'
import { logGlobalToolCallStats, printEvent } from './eventHandler'

class TestStream extends PassThrough {
  output = ''
  _write(chunk: any, _encoding: BufferEncoding, callback: (error?: Error | null) => void): void {
    this.output += chunk.toString()
    callback()
  }
}

describe('eventHandler', () => {
  test('should not double count stats when logGlobalToolCallStats is called after EndTask', () => {
    const stream = new TestStream()
    const usageMeter = { getUsageText: () => '' } as any

    const handleEvent = printEvent(1, usageMeter, stream)

    // Task 1
    handleEvent({ kind: TaskEventKind.StartTask, systemPrompt: 'sys' })
    handleEvent({ kind: TaskEventKind.ToolUse, tool: 'test-tool', params: {} })
    handleEvent({ kind: TaskEventKind.ToolReply, tool: 'test-tool', content: { type: 'text', value: 'ok' } })
    handleEvent({
      kind: TaskEventKind.EndTask,
      exitReason: { type: 'Exit', message: 'done', messages: [] },
    })

    // Clear output to focus on global stats
    stream.output = ''

    logGlobalToolCallStats(stream)

    expect(stream.output).toMatchSnapshot()
  })
})
