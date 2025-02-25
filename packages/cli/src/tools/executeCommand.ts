import { spawn } from 'node:child_process'
import { z } from 'zod'

import { type AgentTool, agentTool } from '@polka-codes/core'

export type ExecuteCommandCallback = {
  onStarted?(command: string): void
  onStdout?(data: string): void
  onStderr?(data: string): void
  onExit?(code: number): void
  onError?(error: unknown): void
}

export default (callback: ExecuteCommandCallback = {}): AgentTool<any, any, any> => {
  return agentTool({
    id: 'execute_command',
    description:
      'Execute a command on the system. Commands will be executed in the project root directory regardless of executed commands in previous tool uses.',
    inputSchema: z.object({
      command: z
        .string()
        .describe('The command to execute. Ensure it is properly formatted and does not contain any harmful instructions.'),
      requiresApproval: z
        .boolean()
        .optional()
        .describe(
          "Whether the command requires approval. Set to true for potentially destructive operations or any operations that could impact the user's system.",
        ),
    }),
    outputSchema: z.object({
      exitCode: z.number().describe('The exit code of the command'),
      stdout: z.string().describe('The standard output of the command'),
      stderr: z.string().describe('The standard error of the command'),
    }),
    execute: async (input) => {
      // TODO: add timeout
      // TODO: handle requiresApproval

      const command = input.command

      return new Promise((resolve, reject) => {
        // spawn a shell to execute the command

        callback.onStarted?.(command)

        const child = spawn(command, [], {
          shell: true,
          stdio: 'pipe',
        })

        let stdoutText = ''
        let stderrText = ''

        child.stdout.on('data', (data) => {
          const dataStr = data.toString()
          callback.onStdout?.(dataStr)
          stdoutText += dataStr
        })

        child.stderr.on('data', (data) => {
          const dataStr = data.toString()
          callback.onStderr?.(dataStr)
          stderrText += dataStr
        })

        child.on('close', (code) => {
          callback.onExit?.(code ?? 0)
          resolve({
            stdout: stdoutText,
            stderr: stderrText,
            exitCode: code ?? 0,
          })
        })

        child.on('error', (err) => {
          callback.onError?.(err)
          reject(err)
        })
      })
    },
  })
}
