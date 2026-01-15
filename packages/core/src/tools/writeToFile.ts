import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'
import { createProviderError } from './utils'

export const toolInfo = {
  name: 'writeToFile',
  description: `Request to write content to a file at the specified path.

When to use:
- Creating new files
- Completely replacing file contents
- When you have the complete intended content

When NOT to use:
- For modifying existing files: Use replaceInFile instead
- For appending content: Use executeCommand with echo >> instead
- For targeted edits: Use replaceInFile instead

Features:
- Automatically creates any directories needed
- Overwrites existing files completely
- Must provide complete file content (no truncation)`,
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
