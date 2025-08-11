import { z } from 'zod'
import { type FullToolInfoV2, PermissionLevel, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'fetch_file',
  description: 'Fetch a file from a URL.',
  parameters: z.object({
    url: z.string().describe('The URL of the file to fetch.'),
  }),
  permissionLevel: PermissionLevel.Read,
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.fetchFile) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to fetch files. Abort.',
    }
  }

  const { url } = toolInfo.parameters.parse(args)

  try {
    const filePart = await provider.fetchFile(url)
    return {
      type: ToolResponseType.Reply,
      message: [filePart],
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      type: ToolResponseType.Error,
      message: `Error fetching file from ${url}: ${errorMessage}`,
    }
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return typeof provider.fetchFile === 'function'
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfoV2
