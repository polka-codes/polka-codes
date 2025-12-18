import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'writeToFile',
  description:
    "Request to write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file. Ensure that the output content does not include incorrect escaped character patterns such as `&lt;`, `&gt;`, or `&amp;`. Also ensure there is no unwanted CDATA tags in the content.",
  parameters: z
    .object({
      path: z.string().describe('The path of the file to write to').meta({ usageValue: 'File path here' }),
      content: z
        .string()
        .describe(
          "The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified.",
        )
        .meta({ usageValue: 'Your file content here' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to write content to a file',
          input: {
            path: 'src/main.js',
            content: `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
}

export default App;
`,
          },
        },
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.writeFile) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to write file.',
      },
    }
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
  let { path, content } = parsed.data

  // Remove CDATA tags if present
  const trimmedContent = content.trim()
  if (trimmedContent.startsWith('<![CDATA[') && content.endsWith(']]>')) content = trimmedContent.slice(9, -3)

  // Create parent directories if they don't exist
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
