/**
 * Tests for the handOver tool
 * Generated by polka.codes
 */

import { describe, expect, test } from 'bun:test'
import { ToolResponseType } from '../tool'
import { handler, toolInfo } from './handOver'

describe('handOver tool', () => {
  test('tool info should be properly defined', () => {
    expect(toolInfo.name).toBe('hand_over')
    expect(toolInfo.parameters).toHaveLength(4)
    expect(toolInfo.examples).toHaveLength(1)
  })

  test('handler should return proper handover response', async () => {
    const result = await handler(
      {},
      {
        agent_name: 'coder',
        task: 'implement feature',
        context: 'test context',
        files: 'file1.ts,file2.ts',
      },
    )

    expect(result).toEqual({
      type: ToolResponseType.HandOver,
      agentName: 'coder',
      task: 'implement feature',
      context: 'test context',
      files: ['file1.ts', 'file2.ts'],
    })
  })

  test('handler should throw error if required parameters are missing', async () => {
    await expect(handler({}, {})).rejects.toThrow()
  })
})
