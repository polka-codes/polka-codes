import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getBoolean, getInt, getString } from './utils'

export const toolInfo = {
  name: 'list_files',
  description:
    'Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.',
  parameters: [
    {
      name: 'path',
      description: 'The path of the directory to list contents for (relative to the current working directory)',
      required: true,
      usageValue: 'Directory path here',
    },
    {
      name: 'max_count',
      description: 'The maximum number of files to list. Default to 2000',
      required: false,
      usageValue: 'Maximum number of files to list (optional)',
    },
    {
      name: 'recursive',
      description: 'Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.',
      required: false,
      usageValue: 'true or false (optional)',
    },
  ],
  examples: [
    {
      description: 'Request to list files',
      parameters: [
        {
          name: 'path',
          value: 'src',
        },
        {
          name: 'max_count',
          value: '100',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Read,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.listFiles) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to list files. Abort.',
    }
  }

  const path = getString(args, 'path')
  const maxCount = getInt(args, 'max_count', 2000)
  const recursive = getBoolean(args, 'recursive', true)

  const [files, limitReached] = await provider.listFiles(path, recursive, maxCount)

  return {
    type: ToolResponseType.Reply,
    message: `<list_files_path>${path}</list_files_path>
<list_files_files>
${files.join('\n')}
</list_files_files>
<list_files_truncated>${limitReached}</list_files_truncated>`,
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.listFiles
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
