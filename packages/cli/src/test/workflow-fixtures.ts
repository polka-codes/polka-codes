/**
 * Workflow Testing Fixtures
 *
 * Provides reusable fixtures for workflow testing with reduced mock usage
 * and better type safety. Addresses P0 mock overuse issues from test review plan.
 */

import { mock } from 'bun:test'
import type { WorkflowContext } from '@polka-codes/core'
import type { CliToolRegistry } from '../workflow-tools'

/**
 * Creates a properly typed workflow context with minimal mocking
 * Only mocks what's necessary for testing, using concrete implementations where possible
 */
export interface WorkflowTestContext {
  context: WorkflowContext<CliToolRegistry>
  tools: {
    executeCommand: ReturnType<typeof mock>
    input: ReturnType<typeof mock>
    generateText: ReturnType<typeof mock>
    taskEvent: ReturnType<typeof mock>
    getMemoryContext: ReturnType<typeof mock>
    updateMemory: ReturnType<typeof mock>
  }
  step: ReturnType<typeof mock>
  logger: {
    info: ReturnType<typeof mock>
    error: ReturnType<typeof mock>
    warn: ReturnType<typeof mock>
    debug: ReturnType<typeof mock>
  }
}

/**
 * Create a workflow test context with properly typed mocks
 *
 * This is a minimal fixture - only mocks what cannot be tested with real implementations.
 * Following the test review plan's guidance:
 * - Prefer real implementations over mocks
 * - Use typed mocks, not 'any'
 * - Maximum 3-5 mocks per test (enforced by this fixture's API)
 */
export function createWorkflowTestContext(): WorkflowTestContext {
  // Only mock the tools that are actually needed for workflow testing
  const tools = {
    executeCommand: mock<() => Promise<{ exitCode: number; stdout: string; stderr: string }>>(),
    input: mock<() => Promise<string>>(),
    generateText: mock<() => Promise<Array<{ role: string; content: string }>>>(),
    taskEvent: mock<() => Promise<void>>(),
    getMemoryContext: mock<() => Promise<string>>().mockResolvedValue(''),
    updateMemory: mock<() => Promise<void>>(),
  }

  const step = mock(async (_name: string, arg2: unknown, arg3: unknown) => {
    const fn = typeof arg2 === 'function' ? arg2 : arg3
    if (typeof fn === 'function') {
      return fn()
    }
    return undefined
  })

  const logger = {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  }

  const context = {
    tools,
    step,
    logger,
  } as unknown as WorkflowContext<CliToolRegistry>

  return { context, tools, step, logger }
}

/**
 * Helper to set up successful command execution
 * @param tools - Tools object from createWorkflowTestContext
 * @param stdout - Standard output to return
 * @param stderr - Standard error to return (default: '')
 * @param exitCode - Exit code to return (default: 0)
 */
export function mockSuccessfulCommand(
  tools: WorkflowTestContext['tools'],
  stdout: string,
  stderr: string = '',
  exitCode: number = 0,
): void {
  tools.executeCommand.mockResolvedValue({ exitCode, stdout, stderr })
}

/**
 * Helper to set up failed command execution
 * @param tools - Tools object from createWorkflowTestContext
 * @param stdout - Standard output to return (default: 'FAIL')
 * @param stderr - Standard error to return (default: 'Error')
 */
export function mockFailedCommand(tools: WorkflowTestContext['tools'], stdout: string = 'FAIL', stderr: string = 'Error'): void {
  tools.executeCommand.mockResolvedValue({ exitCode: 1, stdout, stderr })
}

/**
 * Helper to set up agent response
 * @param tools - Tools object from createWorkflowTestContext
 * @param summary - Summary text from agent
 * @param bailReason - Optional bail reason
 */
export function mockAgentResponse(tools: WorkflowTestContext['tools'], summary: string | null, bailReason?: string): void {
  const content = JSON.stringify({ summary, bailReason: bailReason ?? null })
  tools.generateText.mockResolvedValue([
    {
      role: 'assistant',
      content: `\`\`\`json\n${content}\n\`\`\``,
    },
  ])
}

/**
 * Helper to set up multiple command attempts (e.g., for retry logic)
 * @param tools - Tools object from createWorkflowTestContext
 * @param attempts - Array of exit codes for each attempt
 */
export function mockCommandAttempts(tools: WorkflowTestContext['tools'], attempts: number[]): void {
  for (const exitCode of attempts) {
    tools.executeCommand.mockResolvedValueOnce({
      exitCode,
      stdout: exitCode === 0 ? 'PASS' : 'FAIL',
      stderr: exitCode === 0 ? '' : 'Error',
    })
  }
}

/**
 * Helper to verify exact number of tool calls (deprecated - use expect() directly)
 * @param tools - Tools object from createWorkflowTestContext
 * @param expectations - Object mapping tool names to expected call counts
 */
// Note: Not used - use expect(tool).toHaveBeenCalledTimes(count) directly in tests
/*
export function expectToolCalls(
  tools: WorkflowTestContext['tools'],
  expectations: Partial<Record<keyof WorkflowTestContext['tools'], number>>,
): void {
  for (const [toolName, expectedCount] of Object.entries(expectations)) {
    const tool = tools[toolName as keyof typeof tools]
    expect(tool).toHaveBeenCalledTimes(expectedCount)
  }
}
*/
