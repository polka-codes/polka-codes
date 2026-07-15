import { describe, expect, mock, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  AuthenticationError,
  ConfigurationError,
  ModelAccessError,
  ProviderUnavailableError,
  QuotaExceededError,
  ToolExecutionError,
} from './errors'
import { McpToolError } from './mcp/errors'
import { runWorkflow, toStructuredWorkflowFailure } from './runWorkflow'
import type { WorkflowProgressEvent } from './workflow-events'

function createTestLogger() {
  return {
    debug: mock(() => {}),
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  }
}

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
    const logger = createTestLogger()

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
    const logger = createTestLogger()

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

  test('marks workflow lifecycle as failed for failed ExitReason results', async () => {
    const events: WorkflowProgressEvent[] = []
    const logger = createTestLogger()

    const result = await runWorkflow(
      async () => {
        return { type: 'UsageExceeded' as const, messages: [] }
      },
      {},
      {
        commandName: 'task',
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

    expect(result).toEqual({ type: 'UsageExceeded', messages: [] })
    expect(events).toContainEqual({ kind: 'workflow-finished', success: false })
  })

  test('does not classify unrelated type fields as failed ExitReason results', async () => {
    const events: WorkflowProgressEvent[] = []
    const logger = createTestLogger()

    const result = await runWorkflow(
      async () => {
        return { type: 'summary', value: 'ok' }
      },
      {},
      {
        commandName: 'task',
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

    expect(result).toEqual({ type: 'summary', value: 'ok' })
    expect(events).toContainEqual({ kind: 'workflow-finished', success: true })
  })

  test('does not let usage meter observer failures alter workflow results', async () => {
    const logger = createTestLogger()

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

describe('runWorkflow terminal error results', () => {
  test('returns configuration failures raised before workflow execution', async () => {
    const logger = createTestLogger()
    let workflowExecuted = false
    const testDir = await mkdtemp(join(tmpdir(), 'polka-run-workflow-'))
    const configPath = join(testDir, '.polkacodes.yml')
    await writeFile(
      configPath,
      `commands:
  task-contract-test:
    provider: unsupported
    model: test-model
`,
    )

    try {
      const result = await runWorkflow(
        async () => {
          workflowExecuted = true
          return { type: 'Exit' as const, message: 'done', messages: [] }
        },
        {},
        {
          commandName: 'task-contract-test',
          context: { config: configPath, silent: true },
          logger,
          errorResult: 'exitReason',
        },
      )

      expect(workflowExecuted).toBe(false)
      expect(result).toMatchObject({
        type: 'Error',
        error: { message: 'Unsupported AI provider: unsupported' },
        messages: [],
      })
    } finally {
      await rm(testDir, { recursive: true, force: true })
    }
  })

  const errorCases: Array<[string, () => Error]> = [
    ['configuration', () => new ConfigurationError('Invalid config')],
    ['quota', () => new QuotaExceededError('openai', 'gpt-test', 2, 1)],
    ['authentication', () => new AuthenticationError('openai', 'gpt-test')],
    ['model access', () => new ModelAccessError('openai', 'gpt-test', 403)],
    ['provider', () => new ProviderUnavailableError('openai', 'gpt-test', 503)],
    ['MCP', () => new McpToolError('rust-tools', 'generateTest', 'provider crashed')],
    ['tool', () => new ToolExecutionError('getMemoryContext', new Error('memory unavailable'))],
    ['generic workflow', () => new Error('unexpected workflow failure')],
  ]

  for (const [errorType, createError] of errorCases) {
    test(`returns ${errorType} failures as Error exit reasons without an event callback`, async () => {
      const logger = createTestLogger()
      const error = createError()

      const result = await runWorkflow(
        async () => {
          throw error
        },
        {},
        {
          commandName: 'task',
          context: {
            apiProvider: 'deepseek',
            model: 'deepseek-chat',
            apiKey: 'test-key',
            silent: true,
          },
          logger,
          errorResult: 'exitReason',
        },
      )

      expect(result).toEqual({
        type: 'Error',
        error: {
          message: error.message,
          stack: error.stack,
        },
        messages: [],
      })
    })
  }
})
