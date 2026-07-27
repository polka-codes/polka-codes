import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'
import { createProviderError } from './utils.js'

export const toolInfo = {
  name: 'writeToFile',
  description:
    'Create or overwrite a text file with the complete supplied content; parent directories are created. Use replaceInFile for targeted edits.',
  parameters: z.object({
    path: z.string().min(1).describe('File path relative to the current working directory.'),
    content: z.string().describe('Complete intended file content, including unchanged sections.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.writeFile) {
    return createProviderError('write file')
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for writeToFile: ${parsed.error.message}`,
      },
    }
  }
  const { path, content } = parsed.data

  await provider.writeFile(path, content)

  return {
    success: true,
    message: {
      type: 'text',
      value: `<write_to_file_path>${path}</write_to_file_path><status>Success</status>`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
