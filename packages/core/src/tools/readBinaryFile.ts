import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'readBinaryFile',
  description:
    'Read a binary file from a URL or local path. Use file:// prefix to access local files. This can be used to access non-text files such as PDFs or images.',
  parameters: z.object({
    url: z.string().describe('The URL or local path of the file to read.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readBinaryFile) {
    return {
      success: false,
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
      success: true,
      message: {
        type: 'content',
        value: [
          {
            type: 'media',
            url,
            data: filePart.base64Data,
            mediaType: filePart.mediaType,
          },
        ],
      },
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Error fetching file from ${url}: ${errorMessage}`,
      },
    }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
