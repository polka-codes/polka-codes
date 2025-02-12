import { type FullToolInfo, PermissionLevel, type ToolHandler, type ToolInfo, ToolResponseType } from '../tool'
import type { FilesystemProvider } from './provider'
import { getString } from './utils'

export const toolInfo = {
  name: 'list_code_definition_names',
  description:
    'Request to list definition names (classes, functions, methods, etc.) used for all files in a directory. This tool provides insights into the codebase structure and important constructs, encapsulating high-level concepts and relationships that are crucial for understanding the overall architecture.',
  parameters: [
    {
      name: 'path',
      description: 'The path of a code file to list top level source code definitions for.',
      required: true,
      usageValue: 'Directory path here',
    },
  ],
  examples: [
    {
      description: 'Request to list code definition names in a directory',
      parameters: [
        {
          name: 'path',
          value: 'src/utils',
        },
      ],
    },
  ],
  permissionLevel: PermissionLevel.Read,
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.listCodeDefinitionNames) {
    return {
      type: ToolResponseType.Error,
      message: 'Not possible to list code definition names. Abort.',
    }
  }

  const path = getString(args, 'path')

  const result = await provider.listCodeDefinitionNames(path)

  return {
    type: ToolResponseType.Reply,
    message: `<list_code_definition_names_path>${path}</list_code_definition_names_path>
<list_code_definition_names_result>
${result}
</list_code_definition_names_result>`,
  }
}

export const isAvailable = (provider: FilesystemProvider): boolean => {
  return !!provider.listCodeDefinitionNames
}

export default {
  ...toolInfo,
  handler,
  isAvailable,
} satisfies FullToolInfo
