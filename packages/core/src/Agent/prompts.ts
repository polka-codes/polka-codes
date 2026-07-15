import type { FilePart, ImagePart, TextPart } from 'ai'
import type { ToolResponseResult, ToolResponseResultContentPart } from '../tool.js'

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
  toolResults: (tool: string, result: ToolResponseResult): Array<TextPart | ImagePart | FilePart> => {
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
          ...result.value.map(toPromptPart),
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

const toPromptPart = (part: ToolResponseResultContentPart): TextPart | ImagePart | FilePart => {
  switch (part.type) {
    case 'text':
      return part
    case 'file': {
      const isImage = part.mediaType === 'image' || part.mediaType.startsWith('image/')
      if (isImage && part.data.type !== 'text') {
        const image = part.data.type === 'data' ? part.data.data : part.data.type === 'url' ? part.data.url : part.data.reference
        return {
          type: 'image',
          mediaType: part.mediaType === 'image' ? undefined : part.mediaType,
          image,
          providerOptions: part.providerOptions,
        }
      }
      return part
    }
    case 'image-data':
      return { type: 'image', mediaType: part.mediaType, image: part.data, providerOptions: part.providerOptions }
    case 'image-url':
      return { type: 'image', image: new URL(part.url), providerOptions: part.providerOptions }
    case 'image-file-reference':
      return { type: 'image', image: part.providerReference, providerOptions: part.providerOptions }
    case 'file-data':
      return {
        type: 'file',
        mediaType: part.mediaType,
        filename: part.filename,
        data: { type: 'data', data: part.data },
        providerOptions: part.providerOptions,
      }
    case 'file-url':
      return {
        type: 'file',
        mediaType: part.mediaType ?? 'application/octet-stream',
        data: { type: 'url', url: new URL(part.url) },
        providerOptions: part.providerOptions,
      }
    case 'file-reference':
      return {
        type: 'file',
        mediaType: 'application/octet-stream',
        data: { type: 'reference', reference: part.providerReference },
        providerOptions: part.providerOptions,
      }
    default:
      return {
        type: 'text',
        text: JSON.stringify(part),
      }
  }
}
