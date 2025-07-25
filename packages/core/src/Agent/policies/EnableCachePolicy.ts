import type { ModelMessage } from 'ai'
import { Policies } from '../../config'
import type { AgentBase } from '../AgentBase'
import type { AgentPolicy } from '../AgentPolicy'

const CACHEABLE_MODELS = ['sonnet', 'opus', 'haiku', 'gemini']

function isCacheableModel(modelId: string): boolean {
  return CACHEABLE_MODELS.some((model) => modelId.includes(model))
}

function getProviderKey(provider: string) {
  if (provider === 'openrouter') {
    return 'openrouter'
  }
  if (provider.includes('anthropic')) {
    return 'anthropic'
  }
  return undefined
}

export const EnableCachePolicy: AgentPolicy = () => {
  return {
    name: Policies.EnableCache,
    async prepareMessages(agent: AgentBase, messages: ModelMessage[]): Promise<ModelMessage[]> {
      const providerKey = getProviderKey(agent.ai.provider)

      if (!providerKey || !isCacheableModel(agent.ai.modelId)) {
        return messages
      }

      const providerOptions = { [providerKey]: { cacheControl: { type: 'ephemeral' } } }

      const newMessages = messages.slice()
      let userMessagesToUpdate = 2

      // Iterate backwards to find the system message and the last two user messages
      for (let i = newMessages.length - 1; i >= 0; i--) {
        const message = newMessages[i]
        if (message.role === 'user' && userMessagesToUpdate > 0) {
          newMessages[i] = {
            ...message,
            providerOptions: {
              ...providerOptions,
              ...(message.providerOptions ?? {}),
            },
          }
          userMessagesToUpdate--
        } else if (message.role === 'system') {
          newMessages[i] = {
            ...message,
            providerOptions: {
              ...providerOptions,
              ...(message.providerOptions ?? {}),
            },
          }

          break // Stop after updating the last system message
        }
      }

      return newMessages
    },
  }
}
