import { z } from 'zod'
import { type AgentToolInfo, type FullAgentToolInfo, type ToolHandler, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'removeFile',
  description: 'Request to remove a file at the specified path.',
  parameters: z
    .object({
      path: z.string().describe('The path of the file to remove').meta({ usageValue: 'File path here' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to remove a file',
          input: {
            path: 'src/main.js',
          },
        },
      ],
    }),
} as const satisfies AgentToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.removeFile) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: 'Not possible to remove file.',
      },
    }
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: `Invalid arguments for removeFile: ${parsed.error.message}`,
      },
    }
  }
  const { path } = parsed.data

  await provider.removeFile(path)

  return {
    type: ToolResponseType.Reply,
    message: {
      type: 'text',
      value: `<remove_file_path>${path}</remove_file_path><status>Success</status>`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullAgentToolInfo
