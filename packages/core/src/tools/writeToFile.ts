import { type FullToolInfo, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getString } from './utils'

export const toolInfo = {
  name: 'write_to_file',
  description:
    "Request to write content to a file at the specified path. If the file exists, it will be overwritten with the provided content. If the file doesn't exist, it will be created. This tool will automatically create any directories needed to write the file.",
  parameters: [
    {
      name: 'path',
      description: 'The path of the file to write to',
      required: true,
      usageValue: 'File path here',
    },
    {
      name: 'content',
      description:
        "The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified.",
      required: true,
      usageValue: 'Your file content here',
    },
  ],
  examples: [
    {
      description: 'Request to write content to a file',
      parameters: [
        {
          name: 'path',
          value: 'src/main.js',
        },
        {
          name: 'content',
          value: `import React from 'react';

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
      ],
    },
  ],
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.writeFile) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to write file. Abort.',
    }
  }

  const path = getString(args, 'path')
  const content = getString(args, 'content')

  // Create parent directories if they don't exist
  await provider.writeFile(path, content)

  return {
    type: ToolResponseType.Reply,
    message: `<write_file_path>${path}</write_file_path><status>Success</status>`,
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.writeFile
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
