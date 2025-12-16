import { z } from 'zod'
import { type AgentToolInfo, type FullAgentToolInfo, type ToolHandler, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'searchFiles',
  description:
    'Request to perform a regex search across files in a specified directory, outputting context-rich results that include surrounding lines. This tool searches for patterns or specific content across multiple files, displaying each match with encapsulating context.',
  parameters: z
    .object({
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
    })
    .meta({
      examples: [
        {
          description: 'Request to perform a regex search across files',
          input: {
            path: 'src',
            regex: '^components/',
            filePattern: '*.ts,*.tsx',
          },
        },
      ],
    }),
} as const satisfies AgentToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.searchFiles) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: 'Not possible to search files.',
      },
    }
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: `Invalid arguments for searchFiles: ${parsed.error.message}`,
      },
    }
  }
  const { path, regex, filePattern } = parsed.data

  try {
    const files = await provider.searchFiles(path, regex, filePattern ?? '*')

    return {
      type: ToolResponseType.Reply,
      message: {
        type: 'text',
        value: `<search_files_path>${path}</search_files_path>
<search_files_regex>${regex}</search_files_regex>
<search_files_file_pattern>${filePattern}</search_files_file_pattern>
<search_files_files>
${files.join('\n')}
</search_files_files>
`,
      },
    }
  } catch (error) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: `Error searching files: ${error}`,
      },
    }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullAgentToolInfo
