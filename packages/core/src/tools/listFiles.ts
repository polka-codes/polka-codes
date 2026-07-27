import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'
import { createProviderError, preprocessBoolean } from './utils.js'

export const toolInfo = {
  name: 'listFiles',
  description: 'List files under a directory. Recurses by default and reports when the result is truncated.',
  parameters: z.object({
    path: z.string().min(1).describe('Directory path relative to the current working directory.'),
    maxCount: z.coerce.number().int().positive().optional().describe('Maximum files to return. Defaults to 2000.'),
    recursive: z
      .preprocess(preprocessBoolean, z.boolean().optional())
      .describe('Set false to return only direct child files. Defaults to true.'),
    includeIgnored: z
      .preprocess(preprocessBoolean, z.boolean().optional())
      .describe('Include files normally hidden by ignore rules. Defaults to false.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.listFiles) {
    return createProviderError('list files')
  }

  const { path, maxCount, recursive, includeIgnored } = toolInfo.parameters.parse(args)
  const [files, limitReached] = await provider.listFiles(path, recursive ?? true, maxCount ?? 2000, includeIgnored ?? false)

  return {
    success: true,
    message: {
      type: 'text',
      value: `<list_files_path>${path}</list_files_path>
<list_files_files>
${files.join('\n')}
</list_files_files>
<list_files_truncated>${limitReached}</list_files_truncated>`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
