import { describe, expect, it, spyOn } from 'bun:test'
import attemptCompletion from './attemptCompletion'
import { MockProvider } from './provider'

describe('attemptCompletion', () => {
  it('should return the correct response', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'attemptCompletion').mockResolvedValue('Test completion')

    const result = await attemptCompletion.handler(mockProvider, {
      result: 'Test result',
    })

    expect(result).toMatchSnapshot()
  })

  it('should handle errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'attemptCompletion').mockRejectedValue(new Error('Test error'))

    await expect(
      attemptCompletion.handler(mockProvider, {
        result: 'Test result',
      }),
    ).rejects.toMatchSnapshot()
  })
})
