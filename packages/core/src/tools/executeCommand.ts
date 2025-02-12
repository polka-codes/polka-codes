import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { CommandProvider } from './provider'
import { getBoolean, getString } from './utils'

export const toolInfo = {
  name: 'execute_command',
  description: `Request to execute a CLI command on the system. Use this when you need to perform system operations or run specific commands to accomplish any step in the user's task. You must tailor your command to the user's system and provide a clear explanation of what the command does. Prefer to execute complex CLI commands over creating executable scripts, as they are more flexible and easier to run. Commands will also be executed in the project root directory regardless of executed commands in previous tool uses.`,
  parameters: [
    {
      name: 'command',
      description:
        'The CLI command to execute. This should be valid for the current operating system. Ensure the command is properly formatted and does not contain any harmful instructions.',
      required: true,
      usageValue: 'Your command here',
    },
    {
      name: 'requires_approval',
      description: `A boolean indicating whether this command requires explicit user approval before execution in case the user has auto-approve mode enabled. Set to 'true' for potentially impactful operations like installing/uninstalling packages, deleting/overwriting files, system configuration changes, network operations, or any commands that could have unintended side effects. Set to 'false' for safe operations like reading files/directories, running development servers, building projects, and other non-destructive operations.`,
      required: false,
      usageValue: 'true or false',
    },
  ],
  examples: [
    {
      description: 'Request to execute a command',
      parameters: [
        {
          name: 'command',
          value: 'npm run dev',
        },
        {
          name: 'requires_approval',
          value: 'false',
        },
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
