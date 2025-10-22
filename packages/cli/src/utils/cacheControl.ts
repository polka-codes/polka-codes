import type { ModelMessage } from 'ai'

// Cache control configuration
const CACHEABLE_MODELS = ['sonnet', 'opus', 'haiku', 'gemini']

/**
 * Checks if a model supports caching based on model ID
 */
function isCacheableModel(modelId: string): boolean {
  return CACHEABLE_MODELS.some((model) => modelId.includes(model))
}

/**
 * Determines the provider key for cache control based on provider string
 */
function getProviderKey(provider: string): 'anthropic' | 'openrouter' | undefined {
  if (provider === 'openrouter') {
    return 'openrouter'
  }
  if (provider.includes('anthropic')) {
    return 'anthropic'
  }
  return undefined
}

/**
 * Applies cache control to messages for Anthropic and OpenRouter providers.
 * Adds ephemeral cache control to the last 2 user messages and system message.
 */
export function applyCacheControl(messages: ModelMessage[], provider: string, modelId: string): ModelMessage[] {
  const providerKey = getProviderKey(provider)

  if (!providerKey || !isCacheableModel(modelId)) {
    return messages
  }

  const providerOptions = { [providerKey]: { cacheControl: { type: 'ephemeral' } } }

  const newMessages = messages.slice()
  let userMessagesToUpdate = 2

  // Iterate backwards to find the system message and the last two user messages
  for (let i = newMessages.length - 1; i >= 0; i--) {
    const message = newMessages[i]
    const isUser = message.role === 'user'
    const isSystem = message.role === 'system'

    if ((isUser && userMessagesToUpdate > 0) || isSystem) {
      newMessages[i] = {
        ...message,
        providerOptions: {
          ...message.providerOptions,
          [providerKey]: {
            ...((message.providerOptions?.[providerKey] as Record<string, any>) ?? {}),
            ...providerOptions[providerKey],
          },
        },
      }

      if (isUser) {
        userMessagesToUpdate--
      } else if (isSystem) {
        break // Stop after updating the last system message
      }
    }
  }

  return newMessages
}
