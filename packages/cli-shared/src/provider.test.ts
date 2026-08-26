import { describe, expect, it, mock } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getProvider } from './provider'

const stdinEofFixturePath = fileURLToPath(new URL('./test-fixtures/read-stdin-until-eof.mjs', import.meta.url))

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
    it('closes stdin while preserving command results and observers', async () => {
      const onStarted = mock(() => {})
      const onStdout = mock(() => {})
      const onStderr = mock(() => {})
      const onExit = mock(() => {})
      const onError = mock(() => {})
      const summarizeOutput = mock(async () => 'summary')
      const provider = getProvider({
        command: {
          onStarted,
          onStdout,
          onStderr,
          onExit,
          onError,
        },
        summaryThreshold: 0,
        summarizeOutput,
      })
      if (!provider.executeCommand) throw new Error('executeCommand not defined')
      const command = `${JSON.stringify(process.execPath)} ${JSON.stringify(stdinEofFixturePath)}`

      const result = await provider.executeCommand(command, false)

      expect(result).toEqual({
        stdout: 'out',
        stderr: 'err',
        exitCode: 7,
        summary: 'summary',
      })
      expect(onStarted).toHaveBeenCalledWith(command)
      expect(onStdout).toHaveBeenCalledWith('out')
      expect(onStderr).toHaveBeenCalledWith('err')
      expect(onExit).toHaveBeenCalledWith(7)
      expect(onError).not.toHaveBeenCalled()
      expect(summarizeOutput).toHaveBeenCalledWith('out', 'err')
    })

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

  describe('readBinaryFile', () => {
    it('rejects sibling paths that share the project path prefix', async () => {
      const outsideDirectory = await mkdtemp(`${process.cwd()}-outside-`)
      const outsideFile = `${outsideDirectory}/image.bin`
      await writeFile(outsideFile, 'outside')

      try {
        const provider = getProvider()
        if (!provider.readBinaryFile) throw new Error('readBinaryFile not defined')

        await expect(provider.readBinaryFile(pathToFileURL(outsideFile).href)).rejects.toThrow('is restricted')
      } finally {
        await rm(outsideDirectory, { recursive: true, force: true })
      }
    })
  })
})
