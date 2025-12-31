import { describe, expect, it, spyOn } from 'bun:test'
import executeCommand from './executeCommand'
import { MockProvider } from './provider'

describe('executeCommand', () => {
  it('should execute command successfully', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'executeCommand').mockResolvedValue({
      stdout: 'Command output',
      stderr: 'stderr',
      exitCode: 0,
    })

    const result = await executeCommand.handler(mockProvider, {
      command: 'echo test',
      requiresApproval: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.executeCommand).toHaveBeenCalledWith('echo test', false)
  })

  it('should handle command errors', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'executeCommand').mockRejectedValue(new Error('Command failed'))

    const result = executeCommand.handler(mockProvider, {
      command: 'invalid-command',
      requiresApproval: 'false',
    })

    // The handler now catches the error and returns a ToolResponseError
    const toolResponse = await result
    expect(toolResponse).toMatchSnapshot()
    expect(mockProvider.executeCommand).toHaveBeenCalledWith('invalid-command', false)
  })

  it('should handle command with non-zero exit code', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'executeCommand').mockResolvedValue({
      stdout: 'Command output',
      stderr: 'stderr',
      exitCode: 1,
    })

    const result = await executeCommand.handler(mockProvider, {
      command: 'invalid-command',
      requiresApproval: 'false',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.executeCommand).toHaveBeenCalledWith('invalid-command', false)
  })

  it('should handle approval required', async () => {
    const mockProvider = new MockProvider()
    spyOn(mockProvider, 'executeCommand').mockResolvedValue({
      stdout: 'Approved command',
      stderr: 'stderr',
      exitCode: 0,
    })

    const result = await executeCommand.handler(mockProvider, {
      command: 'rm -rf /',
      requiresApproval: 'true',
    })

    expect(result).toMatchSnapshot()
    expect(mockProvider.executeCommand).toHaveBeenCalledWith('rm -rf /', true)
  })
})
