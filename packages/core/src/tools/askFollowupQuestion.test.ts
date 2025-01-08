import { describe, expect, it, spyOn } from 'bun:test'
import askFollowupQuestion from './askFollowupQuestion'
import { MockProvider } from './provider'

describe('askFollowupQuestion', () => {
  it('should return the correct response', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockResolvedValue('Test response')

    const result = await askFollowupQuestion.handler(mockProvider, {
      question: 'Test question',
      options: 'option1,option2',
    })

    expect(result).toMatchSnapshot()
  })

  it('should handle errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockRejectedValue(new Error('Test error'))

    await expect(
      askFollowupQuestion.handler(mockProvider, {
        question: 'Test question',
        options: 'option1,option2',
      }),
    ).rejects.toMatchSnapshot()
  })
})
