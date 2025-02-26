import type { FullToolInfo, PermissionLevel } from './tool'
import { askFollowupQuestion, delegate, handOver } from './tools'

/**
 * Get the available tools based on the provider and agent availability
 * @param provider The provider to use
 * @param allTools All possible tools
 * @param hasAgent Whether the agent has agents
 * @param permissionLevel The permission level of the agent. Tool requires higher permission level will be disabled
 * @returns The available tools
 */
export const getAvailableTools = ({
  provider,
  allTools,
  hasAgent,
  permissionLevel,
  interactive,
}: { provider: any; allTools: FullToolInfo[]; hasAgent: boolean; permissionLevel: PermissionLevel; interactive: boolean }) => {
  const filteredTools = interactive ? allTools : allTools.filter((tool) => tool.name !== askFollowupQuestion.name)
  const tools: FullToolInfo[] = []
  for (const tool of filteredTools) {
    // disable agent tools if no agents available
    if (!hasAgent) {
      switch (tool.name) {
        case handOver.name:
        case delegate.name:
          continue
      }
    }
    if (tool.isAvailable(provider) && tool.permissionLevel <= permissionLevel) {
      tools.push(tool)
    }
  }
  return tools
}
