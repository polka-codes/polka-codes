import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'
import { createFileElement, createProviderError, preprocessBoolean } from './utils.js'

export const toolInfo = {
  name: 'readFile',
  description:
    'Read known text files with line numbers. Use searchFiles to locate content, listFiles to discover paths, and offset/limit for large files.',
  parameters: z.object({
    path: z
      .preprocess(
        (val) => {
          if (!val) return []
          if (Array.isArray(val)) {
            return val
              .map((item) => (typeof item === 'string' ? item.trim() : item))
              .filter((item) => typeof item !== 'string' || item.length > 0)
          }
          if (typeof val === 'string') {
            return val
              .split(',')
              .map((item) => item.trim())
              .filter((item) => item.length > 0)
          }
          return val
        },
        z.array(z.string().min(1)).min(1),
      )
      .describe('One or more file paths relative to the current working directory.'),
    offset: z.number().int().nonnegative().optional().describe('Zero-based line offset; 100 starts at line 101.'),
    limit: z.number().int().positive().optional().describe('Maximum lines to return from each file.'),
    includeIgnored: z
      .preprocess(preprocessBoolean, z.boolean().optional())
      .describe('Allow files normally hidden by ignore rules. Defaults to false.'),
  }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readFile) {
    return createProviderError('read file')
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for readFile: ${parsed.error.message}`,
      },
    }
  }

  const { path: paths, offset, limit, includeIgnored } = parsed.data

  const resp = []
  for (const path of paths) {
    const fileContent = await provider.readFile(path, includeIgnored ?? false)

    if (fileContent === undefined) {
      resp.push(createFileElement('read_file_file_content', path, undefined, { file_not_found: 'true' }))
      continue
    }

    // Apply offset/limit if specified
    let lines = fileContent.split('\n')
    const start = offset ?? 0
    const end = limit ? start + limit : lines.length
    if (offset !== undefined || limit !== undefined) {
      lines = lines.slice(start, end)
    }

    // Add line numbers
    const lineOffset = offset ?? 0
    const numberedContent = lines
      .map((line, i) => {
        const lineNumber = lineOffset + i + 1
        const paddedNumber = String(lineNumber).padStart(6, ' ')
        return `${paddedNumber}→${line}`
      })
      .join('\n')

    resp.push(createFileElement('read_file_file_content', path, numberedContent))
  }

  return {
    success: true,
    message: {
      type: 'text',
      value: resp.join('\n'),
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
