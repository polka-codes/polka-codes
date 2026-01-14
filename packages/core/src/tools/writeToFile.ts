import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'
import { createProviderError } from './utils'
import { hasBeenRead } from './utils/fileReadTracker'

export const toolInfo = {
  name: 'writeToFile',
  description: `Request to write content to a file at the specified path.

IMPORTANT: You MUST use readFile at least once before using writeToFile
on an existing file. The system enforces this requirement.

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
- Must provide complete file content (no truncation)

IMPORTANT CONSTRAINTS:
- If file exists, you MUST read it first (enforced by system)
- Always provide COMPLETE intended content (no omissions)
- Ensure no incorrect escape sequences (&lt;, &gt;, &amp;)
- Ensure no unwanted CDATA tags in content
- Use replaceInFile for modifications to existing files

ERROR HANDLING:
- If you attempt to write to a file without reading it first, the tool will
  return an error requiring you to read the file first
- This prevents accidental overwrites and ensures informed changes`,
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

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args, context) => {
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
  let { path, content } = parsed.data
  const readSet = context?.readSet

  // Check if file exists and has been read
  // Use optional chaining for fileExists method
  const fileExists = provider.fileExists ? await provider.fileExists(path) : true
  if (fileExists && readSet && !hasBeenRead(readSet, path)) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `ERROR: You must read the file "${path}" first before writing to it.

This safety requirement ensures you understand the current file state before
making changes, preventing accidental overwrites and data loss.

To fix this:
1. Use readFile('${path}') to read the file first
2. Then proceed with writeToFile('${path}', content)

If you intentionally want to create a new file, use a different filename or
delete the existing file first.

File: ${path}
Error: Must read file before writing to existing file`,
      },
    }
  }

  const trimmedContent = content.trim()
  if (trimmedContent.startsWith('<![CDATA[') && trimmedContent.endsWith(']]>')) {
    content = trimmedContent.slice(9, -3)
  }

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
