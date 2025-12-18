import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { CommandProvider } from './provider'

export const toolInfo = {
  name: 'executeCommand',
  description:
    'Run a single CLI command. The command is always executed in the project-root working directory (regardless of earlier commands). Prefer one-off shell commands over wrapper scripts for flexibility. **IMPORTANT**: After an `execute_command` call, you MUST stop and NOT allowed to make further tool calls in the same message.',

  parameters: z
    .object({
      command: z
        .string()
        .describe('The exact command to run  (valid for the current OS). It must be correctly formatted and free of harmful instructions.')
        .meta({ usageValue: 'your-command-here' }),
      requiresApproval: z
        .preprocess((val) => {
          if (typeof val === 'string') {
            const lower = val.toLowerCase()
            if (lower === 'false') return false
            if (lower === 'true') return true
          }
          return val
        }, z.boolean().optional().default(false))
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
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to execute command. Abort.',
      },
    }
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
