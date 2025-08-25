import type { FullToolInfo, FullToolInfoV2 } from './tool'
import { askFollowupQuestion, delegate, handOver } from './tools'

/**
 * Get the available tools based on the provider and agent availability
 * @param provider The provider to use.
 * @param allTools All possible tools.
 * @param hasAgent Whether the agent has agents.
 * @param interactive Determines whether the `askFollowupQuestion` tool is available.
 * @returns The available tools
 */
export const getAvailableTools = <T extends FullToolInfoV2 | FullToolInfo>({
  provider,
  allTools,
  hasAgent,
  interactive,
}: {
  provider: any
  allTools: T[]
  hasAgent: boolean
  interactive: boolean
}) => {
  const filteredTools = interactive ? allTools : allTools.filter((tool) => tool.name !== askFollowupQuestion.name)
  const tools: T[] = []
  for (const tool of filteredTools) {
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
