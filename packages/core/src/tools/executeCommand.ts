import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { CommandProvider } from './provider.js'
import { createProviderError, preprocessBoolean } from './utils.js'

export const toolInfo = {
  name: 'executeCommand',
  description:
    'Run one CLI command from the project-root working directory. Use for builds, tests, diagnostics, and other command-line tasks. After calling executeCommand, wait for the command result before deciding on the next action.',

  parameters: z
    .object({
      command: z.string().describe('The exact command to run for the current OS.').meta({ usageValue: 'your-command-here' }),
      requiresApproval: z
        .preprocess(preprocessBoolean, z.boolean())
        .default(false)
        .describe(
          'Set to `true` for commands that install/uninstall software, modify or delete files, change system settings, perform network operations, or have other side effects. Use `false` for safe, read-only, or purely local development actions (e.g., listing files, make a build, running tests).',
        )
        .meta({ usageValue: 'true | false' }),
    })
    .meta({
      examples: [
        {
          description: 'Make a build',
          input: {
            command: 'npm run build',
            requiresApproval: 'false',
          },
        },
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, CommandProvider> = async (provider, args) => {
  if (!provider.executeCommand) {
    return createProviderError('execute command. Abort')
  }

  const { command, requiresApproval } = toolInfo.parameters.parse(args)
  try {
    const result = await provider.executeCommand(command, requiresApproval)
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
