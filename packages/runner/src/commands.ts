import { executeCommand } from '@polka-codes/core'
import { boundRunnerOutput } from './output'
import type { RunnerCommandResponse, WsIncomingMessage } from './types'

type CommandResult = { stdout: string; stderr: string; exitCode: number }
type CommandExecutor = (command: string, requiresApproval: boolean) => Promise<CommandResult>

// Preserve process results as protocol data; formatted model text cannot prove success.
export async function executeRunnerCommands(
  requests: Extract<WsIncomingMessage, { type: 'pending_tools' }>['requests'],
  execute: CommandExecutor,
) {
  const commands = requests.map((request) => ({ index: request.index, ...executeCommand.parameters.parse(request.params) }))
  const responses: Array<{ index: number; tool: string; response: RunnerCommandResponse }> = []
  let failed = false
  for (const command of commands) {
    const response = failed
      ? { stdout: '', stderr: 'Skipped because an earlier command failed.', exitCode: null }
      : await execute(command.command, command.requiresApproval ?? false)
    const stdout = boundRunnerOutput(response.stdout)
    const stderr = boundRunnerOutput(response.stderr)
    responses.push({
      index: command.index,
      tool: 'executeCommand',
      response: {
        stdout: stdout.text,
        stderr: stderr.text,
        exitCode: response.exitCode,
        ...(stdout.truncated || stderr.truncated ? { outputTruncated: true } : {}),
      },
    })
    if (response.exitCode !== 0) failed = true
  }
  return responses
}
