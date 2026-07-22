import { describe, expect, test } from 'bun:test'
import { AiProvider } from './getModel'
import { getProviderOptions } from './getProviderOptions'

describe('getProviderOptions', () => {
  test('configures reasoning effort for OpenAI-compatible providers', () => {
    expect(
      getProviderOptions({
        provider: AiProvider.OpenAICompatible,
        modelId: 'gpt-5.6-sol',
        parameters: { reasoningEffort: 'high' },
      }),
    ).toEqual({
      openaiCompatible: { reasoningEffort: 'high' },
    })
  })

  test('preserves the none reasoning effort', () => {
    expect(
      getProviderOptions({
        provider: AiProvider.OpenAICompatible,
        modelId: 'gpt-5.6-sol',
        parameters: { reasoningEffort: 'none' },
      }),
    ).toEqual({
      openaiCompatible: { reasoningEffort: 'none' },
    })
  })

  test('does not apply reasoning effort to other providers', () => {
    expect(
      getProviderOptions({
        provider: AiProvider.Anthropic,
        modelId: 'claude-sonnet-4-5-20250929',
        parameters: { reasoningEffort: 'high' },
      }),
    ).toEqual({})
  })

  test('continues to configure token-budget thinking', () => {
    expect(
      getProviderOptions({
        provider: AiProvider.Anthropic,
        modelId: 'claude-sonnet-4-5-20250929',
        parameters: { thinkingBudgetTokens: 8192 },
        supportThinking: true,
      }),
    ).toEqual({
      anthropic: {
        thinking: { type: 'enabled', budgetTokens: 8192 },
      },
    })
  })
})
