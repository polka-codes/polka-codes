import { z } from 'zod'
import { type FullToolInfoV2, PermissionLevel, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { CommandProvider } from './provider'

export const toolInfo = {
  name: 'execute_command',
  description:
    'Run a single CLI command. The command is always executed in the project-root working directory (regardless of earlier commands). Prefer one-off shell commands over wrapper scripts for flexibility. **IMPORTANT**: After an `execute_command` call, you MUST stop and NOT allowed to make further tool calls in the same message.',

  parameters: z.object({
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
  }),
  examples: [
    {
      description: 'Make a build',
      parameters: [
        { name: 'command', value: 'npm run build' },
        { name: 'requiresApproval', value: 'false' },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Arbitrary,
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, CommandProvider> = async (provider, args) => {
  if (!provider.executeCommand) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to execute command. Abort.',
    }
  }

  const { command, requiresApproval } = toolInfo.parameters.parse(args)
  try {
    console.log('Executing command:', command, 'Requires approval:', requiresApproval)
    const result = await provider.executeCommand(command, requiresApproval)
    const message = `<command>${command}</command>
<command_exit_code>${result.exitCode}</command_exit_code>
<command_stdout>
${result.stdout}
</command_stdout>
<command_stderr>
${result.stderr}
</command_stderr>`

    if (result.exitCode === 0) {
      return {
        type: ToolResponseType.Reply,
        message,
      }
    }
    return {
      type: ToolResponseType.Error,
      message,
    }
  } catch (error) {
    return {
      type: ToolResponseType.Error,
      message: error instanceof Error ? error.message : String(error),
    }
  }
}

export const isAvailable = (provider: CommandProvider): boolean => {
  return !!provider.executeCommand
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfoV2
