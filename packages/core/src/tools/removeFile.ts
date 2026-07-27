import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'
import { createProviderError } from './utils.js'

export const toolInfo = {
  name: 'removeFile',
  description: 'Permanently delete one file or symbolic link. This does not remove directories.',
  parameters: z.object({
    path: z.string().min(1).describe('File path relative to the current working directory.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.removeFile) {
    return createProviderError('remove file')
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for removeFile: ${parsed.error.message}`,
      },
    }
  }
  const { path } = parsed.data

  await provider.removeFile(path)

  return {
    success: true,
    message: {
      type: 'text',
      value: `<remove_file_path>${path}</remove_file_path><status>Success</status>`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
