import { z } from 'zod'
import { type FullToolInfoV2, PermissionLevel, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'search_files',
  description:
    'Request to perform a regex search across files in a specified directory, outputting context-rich results that include surrounding lines. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.',
  parameters: z.object({
    path: z
      .string()
      .describe(
        'The path of the directory to search in (relative to the current working directory). This directory will be recursively searched.',
      )
      .meta({ usageValue: 'Directory path here' }),
    regex: z.string().describe('The regular expression pattern to search for. Uses Rust regex syntax.').meta({
      usageValue: 'Your regex pattern here',
    }),
    filePattern: z
      .string()
      .optional()
      .describe(
        'Comma-separated glob pattern to filter files (e.g., "*.ts" for TypeScript files or "*.ts,*.js" for both TypeScript and JavaScript files). If not provided, it will search all files (*).',
      )
      .meta({
        usageValue: 'file pattern here (optional)',
      }),
  }),
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
          name: 'filePattern',
          value: '*.ts,*.tsx',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Read,
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.searchFiles) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to search files. Abort.',
    }
  }

  try {
    const { path, regex, filePattern } = toolInfo.parameters.parse(args)
    const files = await provider.searchFiles(path, regex, filePattern ?? '*')

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
  } catch (error) {
    return {
      type: ToolResponseType.Invalid,
      message: `Invalid arguments for search_files: ${error}`,
    }
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.searchFiles
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfoV2
