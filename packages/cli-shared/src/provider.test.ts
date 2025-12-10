import { describe, expect, it } from 'bun:test'
import { getProvider } from './provider'

describe('getProvider', () => {
  describe('askFollowupQuestion', () => {
    it('should return first option when yes is true and options are provided', async () => {
      const provider = getProvider({ yes: true })
      if (!provider.askFollowupQuestion) throw new Error('askFollowupQuestion not defined')
      const result = await provider.askFollowupQuestion('Question?', ['Option 1', 'Option 2'])
      expect(result).toBe('Option 1')
    })

    it('should return empty string when yes is true and no options are provided', async () => {
      const provider = getProvider({ yes: true })
      if (!provider.askFollowupQuestion) throw new Error('askFollowupQuestion not defined')
      const result = await provider.askFollowupQuestion('Question?', [])
      expect(result).toBe('')
    })
  })
})
