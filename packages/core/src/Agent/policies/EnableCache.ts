import { Policies } from '../../config'
import type { AgentBase } from '../AgentBase'
import type { AgentPolicy } from '../AgentPolicy'

const CACHEABLE_MODELS = ['sonnet-3.5', 'opus', 'haiku']

function isCacheableModel(modelId: string): boolean {
  return CACHEABLE_MODELS.some((model) => modelId.includes(model))
}

export const EnableCachePolicy: AgentPolicy = () => {
  return {
    name: Policies.EnableCache,
    async onBeforeRequest(agent: AgentBase): Promise<void> {
      if (!isCacheableModel(agent.ai.modelId)) {
        return
      }

      const messages = agent.messages.slice()
      let modified = false
      let userMessagesToUpdate = 2

      // Iterate backwards to find the system message and the last two user messages
      for (let i = messages.length - 1; i >= 0; i--) {
        const message = messages[i]
        if (message.role === 'user' && userMessagesToUpdate > 0) {
          messages[i] = {
            ...message,
            providerOptions: { cache_control: { type: 'ephemeral' } },
          }
          userMessagesToUpdate--
          modified = true
        } else if (message.role === 'system') {
          messages[i] = {
            ...message,
            providerOptions: { cache_control: { type: 'ephemeral' } },
          }
          modified = true
        }
      }

      if (modified) {
        agent.setMessages(messages)
      }
    },
  }
}
