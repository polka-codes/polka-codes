import { describe, expect, test } from 'bun:test'
import { getApiKeyEnvironmentVariable, isAiProvider } from './configPrompt'
import { AiProvider } from './getModel'

describe('provider prompt helpers', () => {
  test('uses environment variables read by the CLI', () => {
    expect(getApiKeyEnvironmentVariable(AiProvider.OpenAI)).toBe('OPENAI_API_KEY')
    expect(getApiKeyEnvironmentVariable(AiProvider.OpenAICompatible)).toBe('POLKA_API_KEY')
    expect(getApiKeyEnvironmentVariable(AiProvider.GoogleVertex)).toBeUndefined()
  })

  test('narrows configured provider names', () => {
    expect(isAiProvider('anthropic')).toBe(true)
    expect(isAiProvider('custom-provider')).toBe(false)
    expect(isAiProvider(undefined)).toBe(false)
  })
})
