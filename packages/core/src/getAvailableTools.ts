import type { FullToolInfo } from './tool'
import { delegate, handOver } from './tools'

export const getAvailableTools = (provider: any, allTools: FullToolInfo[], hasAgent: boolean) => {
  const tools: FullToolInfo[] = []
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
