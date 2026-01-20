import { describe, expect, test } from 'bun:test'
import type { ModelMessage } from 'ai'
import { applyCacheControl } from './cacheControl'

describe('applyCacheControl', () => {
  const baseMessages: ModelMessage[] = [
    { role: 'system', content: 'System message' },
    { role: 'user', content: 'User message 1' },
    { role: 'assistant', content: 'Assistant message 1' },
    { role: 'user', content: 'User message 2' },
    { role: 'assistant', content: 'Assistant message 2' },
    { role: 'user', content: 'User message 3' },
  ]

  test('should not apply cache control for non-cacheable models', () => {
    const messages = applyCacheControl(baseMessages, 'anthropic', 'claude-2')
    expect(messages).toEqual(baseMessages)
  })

  test('should not apply cache control for unsupported providers', () => {
    const messages = applyCacheControl(baseMessages, 'openai', 'sonnet')
    expect(messages).toEqual(baseMessages)
  })

  test('should apply cache control for anthropic provider with a supported model', () => {
    const messages = applyCacheControl(baseMessages, 'anthropic', 'claude-3-sonnet-20240229')
    expect(messages).not.toEqual(baseMessages)

    // System message should have cache control
    expect(messages[0].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })

    // Last two user messages should have cache control
    expect(messages[3].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
    expect(messages[5].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })

    // Other messages should not have cache control
    expect(messages[1].providerOptions).toBeUndefined()
    expect(messages[2].providerOptions).toBeUndefined()
    expect(messages[4].providerOptions).toBeUndefined()
  })

  test('should apply cache control for openrouter provider with a supported model', () => {
    const messages = applyCacheControl(baseMessages, 'openrouter', 'anthropic/claude-3-opus')
    expect(messages).not.toEqual(baseMessages)

    // System message should have cache control
    expect(messages[0].providerOptions?.openrouter).toEqual({
      cacheControl: { type: 'ephemeral' },
    })

    // Last two user messages should have cache control
    expect(messages[3].providerOptions?.openrouter).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
    expect(messages[5].providerOptions?.openrouter).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
  })

  test('should apply cache control for gemini models', () => {
    const messages = applyCacheControl(baseMessages, 'openrouter', 'google/gemini-pro')
    expect(messages).not.toEqual(baseMessages)

    // System message should have cache control
    expect(messages[0].providerOptions?.openrouter).toEqual({
      cacheControl: { type: 'ephemeral' },
    })

    // Last two user messages should have cache control
    expect(messages[3].providerOptions?.openrouter).toBeDefined()
    expect(messages[5].providerOptions?.openrouter).toBeDefined()
  })

  test('should handle fewer than two user messages', () => {
    const shortMessages: ModelMessage[] = [
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'User message 1' },
    ]
    const messages = applyCacheControl(shortMessages, 'anthropic', 'claude-3-sonnet-20240229')
    expect(messages).not.toEqual(shortMessages)

    // System message should have cache control
    expect(messages[0].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })

    // Only user message should have cache control
    expect(messages[1].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
  })

  test('should work correctly without a system message', () => {
    const noSystemMessages: ModelMessage[] = [
      { role: 'user', content: 'User message 1' },
      { role: 'assistant', content: 'Assistant message 1' },
      { role: 'user', content: 'User message 2' },
      { role: 'user', content: 'User message 3' },
    ]
    const messages = applyCacheControl(noSystemMessages, 'anthropic', 'claude-3-sonnet-20240229')
    expect(messages).not.toEqual(noSystemMessages)

    // Last two user messages should have cache control
    expect(messages[2].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })
    expect(messages[3].providerOptions?.anthropic).toEqual({
      cacheControl: { type: 'ephemeral' },
    })

    // First user message should not have cache control
    expect(messages[0].providerOptions).toBeUndefined()
  })

  test('should merge with existing providerOptions', () => {
    const messagesWithProviderOptions: ModelMessage[] = [
      { role: 'system', content: 'System message' },
      { role: 'user', content: 'User message 1' },
      { role: 'assistant', content: 'Assistant message 1' },
      {
        role: 'user',
        content: 'User message 2',
        providerOptions: { anthropic: { someOtherOption: 'value' } },
      },
      { role: 'user', content: 'User message 3' },
    ]
    const messages = applyCacheControl(messagesWithProviderOptions, 'anthropic', 'claude-3-sonnet-20240229')
    expect(messages).not.toEqual(messagesWithProviderOptions)

    // Should preserve existing option and add cache control
    expect(messages[3].providerOptions?.anthropic).toEqual({
      someOtherOption: 'value',
      cacheControl: { type: 'ephemeral' },
    })

    // System message should have cache control
    expect(messages[0].providerOptions?.anthropic).toHaveProperty('cacheControl')
  })

  test('should not modify original messages array', () => {
    const originalMessages = [...baseMessages]
    applyCacheControl(baseMessages, 'anthropic', 'claude-3-sonnet-20240229')
    expect(baseMessages).toEqual(originalMessages)
  })
})
