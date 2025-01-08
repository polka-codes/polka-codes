import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getString } from './utils'

export const toolInfo = {
  name: 'search_files',
  description:
    'Request to perform a regex search across files in a specified directory, outputting context-rich results that include surrounding lines. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.',
  parameters: [
    {
      name: 'path',
      description:
        'The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.',
      required: true,
      usageValue: 'Directory path here',
    },
    {
      name: 'regex',
      description: 'The regular expression pattern to search for. Uses Rust regex syntax.',
      required: true,
      usageValue: 'Your regex pattern here',
    },
    {
      name: 'file_pattern',
      description: 'Glob pattern to filter files (e.g., "*.ts" for TypeScript files). If not provided, it will search all files (*).',
      required: false,
      usageValue: 'file pattern here (optional)',
    },
  ],
  examples: [
    {
      description: 'Request to perform a regex search across files',
      parameters: [
        {
          name: 'path',
          value: 'src',
        },
        {
          name: 'regex',
          value: '^components/',
        },
        {
          name: 'file_pattern',
          value: '*.ts',
        },
      ],
    },
  ],
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.searchFiles) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to search files. Abort.',
    }
  }

  const path = getString(args, 'path')
  const regex = getString(args, 'regex')
  const filePattern = getString(args, 'file_pattern', '*')

  const files = await provider.searchFiles(path, regex, filePattern)

  return {
    type: ToolResponseType.Reply,
    message: `<search_files_path>${path}</search_files_path>
<search_files_regex>${regex}</search_files_regex>
<search_files_file_pattern>${filePattern}</search_files_file_pattern>
<search_files_files>
${files.join('\n')}
</search_files_files>
`,
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.searchFiles
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
