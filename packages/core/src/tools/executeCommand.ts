import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { CommandProvider } from './provider.js'
import { createProviderError, preprocessBoolean } from './utils.js'

export const toolInfo = {
  name: 'executeCommand',
  description: 'Run a shell command in the project root and return its exit code and output. Use for builds, tests, and diagnostics.',

  parameters: z.object({
    command: z.string().min(1).describe('Exact command to run for the current operating system.'),
    requiresApproval: z
      .preprocess(preprocessBoolean, z.boolean().optional())
      .describe(
        'Request provider approval before execution. Use true for destructive or external side effects. Providers without approval support may ignore this request.',
      ),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, CommandProvider> = async (provider, args) => {
  if (!provider.executeCommand) {
    return createProviderError('execute command. Abort')
  }

  const { command, requiresApproval } = toolInfo.parameters.parse(args)
  try {
    const result = await provider.executeCommand(command, requiresApproval ?? false)
    let message = `<command>${command}</command>
<command_exit_code>${result.exitCode}</command_exit_code>
`
    if (result.summary) {
      message += `<command_output_summary>\n${result.summary}\n</command_output_summary>\n`
    } else {
      message += `<command_stdout>
${result.stdout}
</command_stdout>
<command_stderr>
${result.stderr}
</command_stderr>
`
    }

    if (result.exitCode === 0) {
      return {
        success: true,
        message: {
          type: 'text',
          value: message,
        },
      }
    }
    return {
      success: false,
      message: {
        type: 'error-text',
        value: message,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: error instanceof Error ? error.message : String(error),
      },
    }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
