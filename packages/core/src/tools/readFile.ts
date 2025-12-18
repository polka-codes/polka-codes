import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'readFile',
  description:
    'Request to read the contents of one or multiple files at the specified paths. Use comma separated paths to read multiple files. Use this when you need to examine the contents of an existing file you do not know the contents of, for example to analyze code, review text files, or extract information from configuration files. May not be suitable for other types of binary files, as it returns the raw content as a string. Try to list all the potential files are relevent to the task, and then use this tool to read all the relevant files.',
  parameters: z
    .object({
      path: z
        .preprocess((val) => {
          if (!val) return []
          const values = Array.isArray(val) ? val : [val]
          return values.flatMap((i) => (typeof i === 'string' ? i.split(',') : [])).filter((s) => s.length > 0)
        }, z.array(z.string()))
        .describe('The path of the file to read')
        .meta({ usageValue: 'Comma separated paths here' }),
      includeIgnored: z
        .preprocess((val) => {
          if (typeof val === 'string') {
            const lower = val.toLowerCase()
            if (lower === 'false') return false
            if (lower === 'true') return true
          }
          return val
        }, z.boolean().nullish().default(false))
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
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readFile) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to read file.',
      },
    }
  }

  const { path: paths, includeIgnored } = toolInfo.parameters.parse(args)

  const resp = []
  for (const path of paths) {
    const fileContent = await provider.readFile(path, includeIgnored ?? false)
    if (!fileContent) {
      resp.push(`<read_file_file_content path="${path}" file_not_found="true" />`)
    } else {
      const isEmpty = fileContent.trim().length === 0
      if (isEmpty) {
        resp.push(`<read_file_file_content path="${path}" is_empty="true" />`)
      } else {
        resp.push(`<read_file_file_content path="${path}">${fileContent}</read_file_file_content>`)
      }
    }
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
