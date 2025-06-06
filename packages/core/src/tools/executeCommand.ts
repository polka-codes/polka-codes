import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { CommandProvider } from './provider'
import { getBoolean, getString } from './utils'

export const toolInfo = {
  name: 'execute_command',
  description:
    'Run a single CLI command. The command is always executed in the project-root working directory (regardless of earlier commands). Prefer one-off shell commands over wrapper scripts for flexibility. **IMPORTANT**: After an `execute_command` call, you MUST stop and NOT allowed to make further tool calls in the same message.',

  parameters: [
    {
      name: 'command',
      description: 'The exact command to run  (valid for the current OS). It must be correctly formatted and free of harmful instructions.',
      required: true,
      usageValue: 'your-command-here',
    },
    {
      name: 'requires_approval',
      description:
        'Set to `true` for commands that install/uninstall software, modify or delete files, change system settings, perform network operations, or have other side effects. Use `false` for safe, read-only, or purely local development actions (e.g., listing files, make a build, running tests).',
      required: false,
      usageValue: 'true | false',
    },
  ],
  examples: [
    {
      description: 'Make a build',
      parameters: [
        { name: 'command', value: 'npm run build' },
        { name: 'requires_approval', value: 'false' },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Arbitrary,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, CommandProvider> = async (provider, args) => {
  if (!provider.executeCommand) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to execute command. Abort.',
    }
  }

  const command = getString(args, 'command')
  const requiresApproval = getBoolean(args, 'requires_approval', false)
  const result = await provider.executeCommand?.(command, requiresApproval)

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
}

export const isAvailable = (provider: CommandProvider): boolean => {
  return !!provider.executeCommand
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
