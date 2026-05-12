import { describe, expect, mock, test } from 'bun:test'
import { AuthenticationError, ConfigurationError, QuotaExceededError, ToolExecutionError } from './errors'
import { McpToolError } from './mcp/errors'
import { runWorkflow, toStructuredWorkflowFailure } from './runWorkflow'
import type { WorkflowProgressEvent } from './workflow-events'

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

describe('runWorkflow progress events', () => {
  test('emits workflow lifecycle events for successful object results', async () => {
    const events: WorkflowProgressEvent[] = []
    const logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }

    const result = await runWorkflow(
      async () => {
        return { success: true, summaries: [] }
      },
      {},
      {
        commandName: 'code',
        context: {
          apiProvider: 'deepseek',
          model: 'deepseek-chat',
          apiKey: 'test-key',
          silent: true,
        },
        logger,
        onEvent: (event) => {
          events.push(event)
        },
      },
    )

    expect(result).toEqual({ success: true, summaries: [] })
    expect(events).toContainEqual({ kind: 'workflow-started' })
    expect(events).toContainEqual({ kind: 'workflow-finished', success: true })
  })

  test('marks workflow lifecycle as failed for unsuccessful object results', async () => {
    const events: WorkflowProgressEvent[] = []
    const logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }

    const result = await runWorkflow(
      async () => {
        return { success: false, reason: 'no changes', summaries: [] }
      },
      {},
      {
        commandName: 'code',
        context: {
          apiProvider: 'deepseek',
          model: 'deepseek-chat',
          apiKey: 'test-key',
          silent: true,
        },
        logger,
        onEvent: (event) => {
          events.push(event)
        },
      },
    )

    expect(result).toEqual({ success: false, reason: 'no changes', summaries: [] })
    expect(events).toContainEqual({ kind: 'workflow-finished', success: false })
  })

  test('does not let usage meter observer failures alter workflow results', async () => {
    const logger = {
      debug: mock(() => {}),
      info: mock(() => {}),
      warn: mock(() => {}),
      error: mock(() => {}),
    }

    const result = await runWorkflow(
      async () => {
        return { success: true, summaries: [] }
      },
      {},
      {
        commandName: 'code',
        context: {
          apiProvider: 'deepseek',
          model: 'deepseek-chat',
          apiKey: 'test-key',
          silent: true,
        },
        logger,
        onUsageMeterCreated: () => {
          throw new Error('observer failed')
        },
      },
    )

    expect(result).toEqual({ success: true, summaries: [] })
    expect(logger.warn).toHaveBeenCalledWith('Usage meter callback failed: observer failed')
  })
})
