import { z } from 'zod'
import { type FullToolInfoV2, PermissionLevel, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'list_files',
  description:
    'Request to list files and directories within the specified directory. If recursive is true, it will list all files and directories recursively. If recursive is false or not provided, it will only list the top-level contents. Do not use this tool to confirm the existence of files you may have created, as the user will let you know if the files were created successfully or not.',
  parameters: z.object({
    path: z
      .string()
      .describe('The path of the directory to list contents for (relative to the current working directory)')
      .meta({ usageValue: 'Directory path here' }),
    maxCount: z.coerce
      .number()
      .optional()
      .default(2000)
      .describe('The maximum number of files to list. Default to 2000')
      .meta({ usageValue: 'Maximum number of files to list (optional)' }),
    recursive: z
      .preprocess((val) => {
        if (typeof val === 'string') {
          const lower = val.toLowerCase()
          if (lower === 'false') return false
          if (lower === 'true') return true
        }
        return val
      }, z.boolean().optional().default(true))
      .describe('Whether to list files recursively. Use true for recursive listing, false or omit for top-level only.')
      .meta({ usageValue: 'true or false (optional)' }),
  }),
  examples: [
    {
      description: 'Request to list files',
      parameters: [
        {
          name: 'path',
          value: 'src',
        },
        {
          name: 'maxCount',
          value: '100',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Read,
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.listFiles) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to list files. Abort.',
    }
  }

  const { path, maxCount, recursive } = toolInfo.parameters.parse(args)
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
} satisfies FullToolInfoV2
