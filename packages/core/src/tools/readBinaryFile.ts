import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'

export const toolInfo = {
  name: 'readBinaryFile',
  description: 'Read an image, PDF, or other binary file from an HTTP(S) URL or project-local file:// URL and return it as an attachment.',
  parameters: z.object({
    url: z.union([z.httpUrl(), z.string().regex(/^file:\/\/.+/)]).describe('HTTP(S) URL or project-local file:// URL to read.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readBinaryFile) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Binary file reading is not supported by the current provider.',
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
            type: 'file',
            data: { type: 'data', data: filePart.base64Data },
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
        value: `Error reading file from ${url}: ${errorMessage}`,
      },
    }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
