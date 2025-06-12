import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getString, replaceInFile } from './utils'

export const toolInfo = {
  name: 'replace_in_file',
  description:
    'Request to replace sections of content in an existing file using SEARCH/REPLACE blocks that define exact changes to specific parts of the file. This tool should be used when you need to make targeted changes to specific parts of a file.',
  parameters: [
    {
      name: 'path',
      description: 'The path of the file to modify',
      required: true,
      usageValue: 'File path here',
    },
    {
      name: 'diff',
      description: `One or more SEARCH/REPLACE blocks following this exact format:
\`\`\`
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`
Critical rules:
1. SEARCH content must match the associated file section to find EXACTLY:
    * Match character-for-character including whitespace, indentation, line endings
    * Include all comments, docstrings, etc.
2. SEARCH/REPLACE blocks will ONLY replace the first match occurrence.
    * Including multiple unique SEARCH/REPLACE blocks if you need to make multiple changes.
    * Include *just* enough lines in each SEARCH section to uniquely match each set of lines that need to change.
    * When using multiple SEARCH/REPLACE blocks, list them in the order they appear in the file.
3. Keep SEARCH/REPLACE blocks concise:
    * Break large SEARCH/REPLACE blocks into a series of smaller blocks that each change a small portion of the file.
    * Include just the changing lines, and a few surrounding lines if needed for uniqueness.
    * Do not include long runs of unchanging lines in SEARCH/REPLACE blocks.
    * Each line must be complete. Never truncate lines mid-way through as this can cause matching failures.
4. Special operations:
    * To move code: Use two SEARCH/REPLACE blocks (one to delete from original + one to insert at new location)
    * To delete code: Use empty REPLACE section`,
      required: true,
      usageValue: 'Search and replace blocks here',
    },
  ],
  examples: [
    {
      description: 'Request to replace sections of content in a file',
      parameters: [
        {
          name: 'path',
          value: 'src/main.js',
        },
        {
          name: 'diff',
          value: `
<<<<<<< SEARCH
import React from 'react';
=======
import React, { useState } from 'react';
>>>>>>> REPLACE

<<<<<<< SEARCH
function handleSubmit() {
  saveData();
  setLoading(false);
}

=======
>>>>>>> REPLACE

<<<<<<< SEARCH
return (
  <div>
=======
function handleSubmit() {
  saveData();
  setLoading(false);
}

return (
  <div>
>>>>>>> REPLACE
`,
        },
      ],
    },
    {
      description: 'Request to perform a simple, single-line replacement',
      parameters: [
        {
          name: 'path',
          value: 'src/config.js',
        },
        {
          name: 'diff',
          value: `
<<<<<<< SEARCH
const API_URL = 'https://api.example.com';
=======
const API_URL = 'https://api.staging.example.com';
>>>>>>> REPLACE
`,
        },
      ],
    },
    {
      description: 'Request to add a new function to a file',
      parameters: [
        {
          name: 'path',
          value: 'src/utils.js',
        },
        {
          name: 'diff',
          value: `
<<<<<<< SEARCH
function helperA() {
  // ...
}
=======
function helperA() {
  // ...
}

function newHelper() {
  // implementation
}
>>>>>>> REPLACE
`,
        },
      ],
    },
    {
      description: 'Request to delete a block of code from a file',
      parameters: [
        {
          name: 'path',
          value: 'src/app.js',
        },
        {
          name: 'diff',
          value: `
<<<<<<< SEARCH
function oldFeature() {
  // This is no longer needed
}

=======
>>>>>>> REPLACE
`,
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Write,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readFile || !provider.writeFile) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to replace in file. Abort.',
    }
  }

  const path = getString(args, 'path')
  const diff = getString(args, 'diff')

  const fileContent = await provider.readFile(path)

  if (fileContent == null) {
    return {
      type: ToolResponseType.Error,
      message: `<error><replace_in_file_path>${path}</replace_in_file_path><error_message>File not found</error_message></error>`,
    }
  }

  const result = await replaceInFile(fileContent, diff)

  await provider.writeFile(path, result)

  return {
    type: ToolResponseType.Reply,
    message: `<replace_in_file_path>${path}</replace_in_file_path>`,
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.readFile && !!provider.writeFile
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
