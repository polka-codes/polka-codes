import type { FullToolInfo, FullToolInfoV2 } from './tool'
import { delegate, handOver } from './tools'

/**
 * Get the available tools based on the provider and agent availability
 * @param provider The provider to use.
 * @param allTools All possible tools.
 * @param hasAgent Whether the agent has agents.
 * @returns The available tools
 */
export const getAvailableTools = <T extends FullToolInfoV2 | FullToolInfo>({
  provider,
  allTools,
  hasAgent,
}: {
  provider: any
  allTools: T[]
  hasAgent: boolean
}) => {
  const tools: T[] = []
  for (const tool of allTools) {
    // disable agent tools if no agents available
    if (!hasAgent) {
      switch (tool.name) {
        case handOver.name:
        case delegate.name:
          continue
      }
    }
    if (tool.isAvailable(provider)) {
      tools.push(tool)
    }
  }
  return tools
}
