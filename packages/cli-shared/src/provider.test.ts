import { describe, expect, it, mock } from 'bun:test'
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

  describe('executeCommand', () => {
    it('does not let command observer failures alter command results', async () => {
      const provider = getProvider({
        command: {
          onStarted: mock(() => {
            throw new Error('started observer failed')
          }),
          onStdout: mock(() => {
            throw new Error('stdout observer failed')
          }),
          onStderr: mock(() => {
            throw new Error('stderr observer failed')
          }),
          onExit: mock(() => {
            throw new Error('exit observer failed')
          }),
          onError: mock(() => {
            throw new Error('error observer failed')
          }),
        },
      })
      if (!provider.executeCommand) throw new Error('executeCommand not defined')

      const result = await provider.executeCommand("printf 'out'; printf 'err' >&2", false)

      expect(result).toMatchObject({
        stdout: 'out',
        stderr: 'err',
        exitCode: 0,
      })
    })
  })
})
