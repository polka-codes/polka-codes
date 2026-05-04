import { describe, expect, test } from 'bun:test'
import { AuthenticationError, ConfigurationError, QuotaExceededError, ToolExecutionError } from './errors'
import { McpToolError } from './mcp/errors'
import { toStructuredWorkflowFailure } from './runWorkflow'

describe('toStructuredWorkflowFailure', () => {
  test('preserves provider error messages', () => {
    const failure = toStructuredWorkflowFailure(new AuthenticationError('openai', 'gpt-test'))

    expect(failure.success).toBe(false)
    expect(failure.errorType).toBe('authentication')
    expect(failure.reason).toContain('openai authentication failed')
  })

  test('classifies quota failures separately', () => {
    const failure = toStructuredWorkflowFailure(new QuotaExceededError('openai', 'gpt-test', 2, 1))

    expect(failure).toMatchObject({
      success: false,
      summaries: [],
      errorType: 'quota',
    })
    expect(failure.reason).toContain('quota exceeded')
  })

  test('classifies configuration failures separately', () => {
    const failure = toStructuredWorkflowFailure(new ConfigurationError('Invalid config'))

    expect(failure).toEqual({
      success: false,
      reason: 'Invalid config',
      summaries: [],
      errorType: 'configuration',
    })
  })

  test('preserves tool failure root causes', () => {
    const failure = toStructuredWorkflowFailure(new ToolExecutionError('getMemoryContext', new Error('memory unavailable')))

    expect(failure).toEqual({
      success: false,
      reason: "Tool 'getMemoryContext' failed: memory unavailable",
      summaries: [],
      errorType: 'tool',
    })
  })

  test('classifies MCP tool failures', () => {
    const failure = toStructuredWorkflowFailure(new McpToolError('rust-tools', 'generateTest', 'provider crashed'))

    expect(failure.errorType).toBe('mcp')
    expect(failure.reason).toContain("Tool 'generateTest' on server 'rust-tools' failed")
  })

  test('falls back to workflow failures for generic errors', () => {
    const failure = toStructuredWorkflowFailure(new Error('unexpected workflow failure'))

    expect(failure).toEqual({
      success: false,
      reason: 'unexpected workflow failure',
      summaries: [],
      errorType: 'workflow',
    })
  })
})
