import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool.js'
import type { FilesystemProvider } from './provider.js'
import { createFileElement, createProviderError, preprocessBoolean } from './utils.js'

export const toolInfo = {
  name: 'readFile',
  description: `Read one or more text files. Use this to inspect known files before editing, understand code, or read configuration. Prefer searchFiles for content searches and listFiles for directory discovery. The result includes line numbers; use offset and limit for large files.`,
  parameters: z
    .object({
      path: z
        .preprocess((val) => {
          if (!val) return []
          // Only split by comma if the input is a string
          // If it's already an array, use it as-is to support files with commas in names
          if (Array.isArray(val)) {
            return val.filter((s) => typeof s === 'string' && s.length > 0)
          }
          // Single string input - split by comma for multiple files
          return (val as string).split(',').filter((s) => s.length > 0)
        }, z.array(z.string()))
        .describe('The path of the file to read')
        .meta({ usageValue: 'Comma separated paths here' }),
      offset: z.number().optional().describe('Skip first N lines (for partial file reading)').meta({ usageValue: '100' }),
      limit: z.number().optional().describe('Read at most N lines (for partial file reading)').meta({ usageValue: '50' }),
      includeIgnored: z
        .preprocess(preprocessBoolean, z.boolean())
        .default(false)
        .describe('Whether to include ignored files. Use true to include files ignored by .gitignore.')
        .meta({ usageValue: 'true or false (optional)' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to read the contents of a file',
          input: {
            path: 'src/main.js',
          },
        },
        {
          description: 'Request to read multiple files',
          input: {
            path: 'src/main.js,src/index.js',
          },
        },
        {
          description: 'Read partial file (lines 100-150)',
          input: {
            path: 'src/large-file.ts',
            offset: 100,
            limit: 50,
          },
        },
      ],
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

    if (!fileContent) {
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
