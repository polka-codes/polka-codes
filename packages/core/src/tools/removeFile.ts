import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getString } from './utils'

export const toolInfo = {
  name: 'remove_file',
  description: 'Request to remove a file at the specified path.',
  parameters: [
    {
      name: 'path',
      description: 'The path of the file to remove',
      required: true,
      usageValue: 'File path here',
    },
  ],
  examples: [
    {
      description: 'Request to remove a file',
      parameters: [
        {
          name: 'path',
          value: 'src/main.js',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Write,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.removeFile) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to remove file. Abort.',
    }
  }

  const path = getString(args, 'path')

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
} satisfies FullToolInfo
