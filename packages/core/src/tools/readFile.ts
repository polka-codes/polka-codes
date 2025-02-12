import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getStringArray } from './utils'

export const toolInfo = {
  name: 'read_file',
  description:
    'Request to read the contents of one or multiple files at the specified paths. Use comma separated paths to read multiple files. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. May not be suitable for other types of binary files, as it returns the raw content as a string. Try to list all the potential files are relevent to the task, and then use this tool to read all the relevant files.',
  parameters: [
    {
      name: 'path',
      description: 'The path of the file to read',
      required: true,
      usageValue: 'Comma separated paths here',
    },
  ],
  examples: [
    {
      description: 'Request to read the contents of a file',
      parameters: [
        {
          name: 'path',
          value: 'src/main.js',
        },
      ],
    },
    {
      description: 'Request to read multiple files',
      parameters: [
        {
          name: 'path',
          value: 'src/main.js,src/index.js',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Read,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readFile) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to read file. Abort.',
    }
  }

  const paths = getStringArray(args, 'path')

  const resp = []
  for (const path of paths) {
    const fileContent = await provider.readFile(path)
    const isEmpty = fileContent.trim().length === 0
    if (isEmpty) {
      resp.push(`<read_file_file_content path="${path}" is_empty="true" />`)
    } else {
      resp.push(`<read_file_file_conten path="${path}">${fileContent}</read_file_file_content>`)
    }
  }

  return {
    type: ToolResponseType.Reply,
    message: resp.join('\n'),
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.readFile
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
