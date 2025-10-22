import type { LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
import type { FilePart, ImagePart, TextPart } from 'ai'

export const customScripts = (commands: Record<string, string | { command: string; description: string }>) => {
  const joined = Object.entries(commands)
    .map(([name, command]) => {
      if (typeof command === 'string') {
        return `- ${name}\n  - Command: \`${command}\``
      }
      return `- ${name}\n  - Command: \`${command.command}\`\n  - Description: ${command.description}`
    })
    .join('\n')
  if (joined.trim() === '') {
    return ''
  }

  return `
====

USER'S CUSTOM COMMANDS

The following additional commands are provided by the user, and should be followed to the best of your ability without interfering with the TOOL USE guidelines.

${joined}`
}

export const responsePrompts = {
  errorInvokeTool: (tool: string, error: unknown) => `An error occurred while invoking the tool "${tool}": ${error}`,
  requireUseTool: `Error: No tool use detected. You MUST use a tool before proceeding.
e.g. <tool_tool_name>tool_name</tool_tool_name>

Ensure the opening and closing tags are correctly nested and closed, and that you are using the correct tool name.
Avoid unnecessary text or symbols before or after the tool use.
Avoid unnecessary escape characters or special characters.
`,
  requireUseToolNative: `Error: No tool use detected. You MUST use a tool before proceeding.
`,
  toolResults: (tool: string, result: LanguageModelV2ToolResultOutput): Array<TextPart | ImagePart | FilePart> => {
    switch (result.type) {
      case 'text':
        return [
          {
            type: 'text',
            text: `<tool_response name=${tool}>${result.value}</tool_response>`,
          },
        ]
      case 'error-text':
        return [
          {
            type: 'text',
            text: `<tool_response_error name=${tool}>${result.value}</tool_response_error>`,
          },
        ]
      case 'json':
        return [
          {
            type: 'text',
            text: `<tool_response_json name=${tool}>${JSON.stringify(result.value)}</tool_response_json>`,
          },
        ]
      case 'error-json':
        return [
          {
            type: 'text',
            text: `<tool_response_error_json name=${tool}>${JSON.stringify(result.value)}</tool_response_error_json>`,
          },
        ]
      case 'content':
        return [
          {
            type: 'text',
            text: `<tool_response name=${tool}>`,
          },
          ...result.value.map((part) => {
            if (part.type === 'text') {
              return part
            }
            if (part.mediaType.startsWith('image/')) {
              return {
                type: 'image',
                mediaType: part.mediaType,
                image: part.data,
              } as const
            }
            return {
              type: 'file',
              mediaType: part.mediaType,
              data: part.data,
            } as const
          }),
          {
            type: 'text',
            text: '</tool_response>',
          },
        ]
    }
  },
  commandResult: (command: string, exitCode: number, stdout: string, stderr: string) => `<command>${command}</command>
<command_exit_code>${exitCode}</command_exit_code>
<command_stdout>
${stdout}
</command_stdout>
<command_stderr>
${stderr}
</command_stderr>`,
} as const
