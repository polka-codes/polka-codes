import { describe, expect, it, spyOn } from 'bun:test'
import askFollowupQuestion from './askFollowupQuestion'
import { MockProvider } from './provider'

describe('askFollowupQuestion', () => {
  it('should return the correct response', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockResolvedValue('Test response')

    const result = await askFollowupQuestion.handler(mockProvider, {
      questions: [
        {
          prompt: 'Test question',
          options: ['option1', 'option2'],
        },
      ],
    })

    expect(result).toMatchSnapshot()
  })

  it('should handle errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockRejectedValue(new Error('Test error'))

    await expect(
      askFollowupQuestion.handler(mockProvider, {
        questions: [
          {
            prompt: 'Test question',
            options: ['option1', 'option2'],
          },
        ],
      }),
    ).rejects.toMatchSnapshot()
  })

  it('should handle multiple questions', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockResolvedValue('Answer1|Answer2')

    const result = await askFollowupQuestion.handler(mockProvider, {
      questions: [
        {
          prompt: 'First question?',
          options: ['A', 'B'],
        },
        {
          prompt: 'Second question?',
          options: ['X', 'Y'],
        },
      ],
    })

    expect(result).toMatchSnapshot()
  })

  it('should handle questions without options', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockResolvedValue('Free text answer')

    const result = await askFollowupQuestion.handler(mockProvider, {
      questions: [
        {
          prompt: 'Open-ended question',
        },
      ],
    })

    expect(result).toMatchSnapshot()
  })

  it('should handle empty options array', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'askFollowupQuestion').mockResolvedValue('Fallback answer')

    const result = await askFollowupQuestion.handler(mockProvider, {
      questions: [
        {
          prompt: 'Question with empty options',
          options: [],
        },
      ],
    })

    expect(result).toMatchSnapshot()
  })

  it('should validate required parameters', async () => {
    const mockProvider = new MockProvider()

    await expect(askFollowupQuestion.handler(mockProvider, {} as any)).rejects.toMatchSnapshot()

    await expect(
      askFollowupQuestion.handler(mockProvider, {
        questions: [{}],
      } as any),
    ).rejects.toMatchSnapshot()
  })
})
