import { beforeEach, describe, expect, it, mock } from 'bun:test'
import type { Logger } from '@polka-codes/core'
import { InterruptHandler } from './interrupt'

// Mock Logger
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
} as unknown as Logger

// Mock Agent
const mockAgent = {
  stop: mock(async () => {}),
  cleanup: mock(async () => {}),
}

describe('InterruptHandler', () => {
  let handler: InterruptHandler

  beforeEach(() => {
    mockAgent.stop.mockClear()
    mockAgent.cleanup.mockClear()
    handler = new InterruptHandler(mockLogger, mockAgent)
  })

  it('should start not interrupted', () => {
    expect(handler.shouldStop()).toBe(false)
    expect(handler.getReason()).toBe('')
  })

  it('should set interrupted state when interrupt is called', () => {
    handler.interrupt('Manual stop')
    expect(handler.shouldStop()).toBe(true)
    expect(handler.getReason()).toBe('Manual stop')
  })

  it('should reset state', () => {
    handler.interrupt('Stop')
    handler.reset()
    expect(handler.shouldStop()).toBe(false)
    expect(handler.getReason()).toBe('')
  })

  it('should call agent stop and cleanup on interrupt', async () => {
    // Mock process.exit to prevent actual exit
    const originalExit = process.exit
    const mockExit = mock(() => {}) as unknown as typeof process.exit
    process.exit = mockExit

    try {
      // We access the private method via any cast to simulate the event handler
      await (handler as any).handleInterrupt('SIGINT')

      expect(mockAgent.stop).toHaveBeenCalled()
      expect(mockAgent.cleanup).toHaveBeenCalled()
      expect(mockExit).toHaveBeenCalledWith(0)
    } finally {
      process.exit = originalExit
    }
  })
})
