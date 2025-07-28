import { z } from 'zod'
import { type FullToolInfoV2, PermissionLevel, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'remove_file',
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
  permissionLevel: PermissionLevel.Write,
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.removeFile) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to remove file. Abort.',
    }
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      type: ToolResponseType.Invalid,
      message: `Invalid arguments for remove_file: ${parsed.error.message}`,
    }
  }
  const { path } = parsed.data

  await provider.removeFile(path)

  return {
    type: ToolResponseType.Reply,
    message: `<remove_file_path>${path}</remove_file_path><status>Success</status>`,
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.removeFile
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfoV2
