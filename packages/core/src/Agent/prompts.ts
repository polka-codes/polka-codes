import type { LanguageModelV3ToolResultOutput } from '@ai-sdk/provider'
import type { FilePart, ImagePart, TextPart } from 'ai'

const NO_REASON_PROVIDED = 'No reason provided'

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
  toolResults: (tool: string, result: LanguageModelV3ToolResultOutput): Array<TextPart | ImagePart | FilePart> => {
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
            // Handle text parts directly
            if (part.type === 'text') {
              return part
            }
            // Handle image-data parts
            if ('mediaType' in part && 'data' in part && part.mediaType.startsWith('image/')) {
              return {
                type: 'image',
                mediaType: part.mediaType,
                image: part.data,
              } as const
            }
            // Handle file-data parts
            if ('mediaType' in part && 'data' in part) {
              return {
                type: 'file',
                mediaType: part.mediaType,
                data: part.data,
              } as const
            }
            // Fallback for URL-based and other part types
            return {
              type: 'text',
              text: JSON.stringify(part),
            } satisfies TextPart
          }),
          {
            type: 'text',
            text: '</tool_response>',
          },
        ]
      case 'execution-denied':
        return [
          {
            type: 'text',
            text: `<tool_response_error name=${tool}>Execution denied: ${result.reason ?? NO_REASON_PROVIDED}</tool_response_error>`,
          },
        ]
      default: {
        return [
          {
            type: 'text',
            text: `<tool_response_error name=${tool}>Unknown result type: ${JSON.stringify(result)}</tool_response_error>`,
          },
        ]
      }
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
