import { z } from 'zod'
import { type FullToolInfoV2, type ToolHandler, type ToolInfoV2, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'readBinaryFile',
  description:
    'Read a binary file from a URL or local path. Use file:// prefix to access local files. This can be used to access non-text files such as PDFs or images.',
  parameters: z.object({
    url: z.string().describe('The URL or local path of the file to read.'),
  }),
} as const satisfies ToolInfoV2

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readBinaryFile) {
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: 'Not possible to fetch files. Abort.',
      },
    }
  }

  const { url } = toolInfo.parameters.parse(args)

  try {
    const filePart = await provider.readBinaryFile(url)

    return {
      type: ToolResponseType.Reply,
      message: {
        type: 'content',
        value: [
          {
            type: 'media',
            url,
            base64Data: filePart.base64Data,
            mediaType: filePart.mediaType,
          },
        ],
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      type: ToolResponseType.Error,
      message: {
        type: 'error-text',
        value: `Error fetching file from ${url}: ${errorMessage}`,
      },
    }
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return typeof provider.readBinaryFile === 'function'
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfoV2
