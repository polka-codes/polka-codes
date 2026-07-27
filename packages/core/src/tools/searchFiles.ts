import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'

export const toolInfo = {
  name: 'searchFiles',
  description:
    'Search file contents recursively with a Rust-compatible regex and return filename, line, and context matches. Use listFiles to search by filename.',
  parameters: z.object({
    path: z.string().min(1).describe('Directory path relative to the current working directory.'),
    regex: z.string().min(1).describe('Rust-compatible regular expression applied to file contents.'),
    filePattern: z.string().min(1).optional().describe('Comma-separated file globs, such as "*.ts,*.tsx". Omit to search all files.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.searchFiles) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to search files.',
      },
    }
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for searchFiles: ${parsed.error.message}`,
      },
    }
  }
  const { path, regex, filePattern } = parsed.data
  const resolvedFilePattern = filePattern ?? '*'

  try {
    const files = await provider.searchFiles(path, regex, resolvedFilePattern)

    return {
      success: true,
      message: {
        type: 'text',
        value: `<search_files_path>${path}</search_files_path>
<search_files_regex>${regex}</search_files_regex>
<search_files_file_pattern>${resolvedFilePattern}</search_files_file_pattern>
<search_files_files>
${files.join('\n')}
</search_files_files>
`,
      },
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Error searching files: ${errorMessage}`,
      },
    }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
