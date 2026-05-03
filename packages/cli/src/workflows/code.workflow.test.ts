import { describe, expect, test } from 'bun:test'
import { createContext, type JsonResponseMessage, type WorkflowTools } from '@polka-codes/core'
import type { CliToolRegistry } from '../workflow-tools'
import { codeWorkflow } from './code.workflow'

function jsonResponse(object: unknown): JsonResponseMessage {
  return {
    role: 'assistant',
    content: `\`\`\`json
${JSON.stringify(object)}
\`\`\``,
  }
}

function textParts(input: unknown): string[] {
  if (!input || typeof input !== 'object' || !('messages' in input)) {
    return []
  }
  const messages = (input as { messages: { content: unknown }[] }).messages
  return messages.flatMap((message) => {
    if (typeof message.content === 'string') {
      return [message.content]
    }
    if (Array.isArray(message.content)) {
      return message.content.flatMap((part) => {
        if (part && typeof part === 'object' && 'type' in part && part.type === 'text' && 'text' in part) {
          return [String(part.text)]
        }
        return []
      })
    }
    return []
  })
}

function createHarness(responses: JsonResponseMessage[]) {
  const remainingResponses = [...responses]
  const generateTextInputs: unknown[] = []
  const toolCalls: string[] = []
  const infoMessages: string[] = []

  const tools = new Proxy({} as WorkflowTools<CliToolRegistry>, {
    get(_target, prop) {
      return async (input: unknown) => {
        const toolName = String(prop)
        toolCalls.push(toolName)

        switch (toolName) {
          case 'taskEvent':
            return undefined
          case 'getMemoryContext':
            return ''
          case 'generateText': {
            generateTextInputs.push(input)
            const response = remainingResponses.shift()
            if (!response) {
              throw new Error('No generateText response queued')
            }
            return [response]
          }
          case 'updateMemory':
            return undefined
          case 'readFile':
            return 'file content'
          case 'executeCommand':
            return { exitCode: 0, stdout: '', stderr: '' }
          default:
            throw new Error(`Unexpected tool call: ${toolName}`)
        }
      }
    },
  })

  const logger = {
    debug: () => {},
    info: (...args: unknown[]) => {
      infoMessages.push(args.map(String).join(' '))
    },
    warn: () => {},
    error: () => {},
  }

  return {
    context: createContext<CliToolRegistry>(tools, undefined, logger),
    generateTextInputs,
    infoMessages,
    toolCalls,
  }
}

describe('codeWorkflow', () => {
  test('direct mode calls the implementation agent without planning', async () => {
    const task = 'Replace the generated test scaffold.'
    const harness = createHarness([jsonResponse({ summary: 'Replaced scaffold.', bailReason: null })])

    const result = await codeWorkflow(
      {
        task,
        mode: 'direct',
        interactive: false,
        skipFix: true,
        additionalTools: {},
      },
      harness.context,
    )

    expect(result).toEqual({ success: true, summaries: ['Replaced scaffold.'] })
    expect(harness.generateTextInputs).toHaveLength(1)
    expect(textParts(harness.generateTextInputs[0]).join('\n')).toContain(task)
    expect(textParts(harness.generateTextInputs[0]).join('\n')).not.toContain('## Your Plan')
    expect(harness.infoMessages.join('\n')).not.toContain('Phase 1: Creating implementation plan')
  })

  test('direct mode preserves additionalInstructions in the implementation system prompt', async () => {
    const harness = createHarness([jsonResponse({ summary: 'Implemented direct task.', bailReason: null })])

    await codeWorkflow(
      {
        task: 'Implement the constrained edit.',
        mode: 'direct',
        interactive: false,
        skipFix: true,
        additionalInstructions: 'First edit must replace the scaffold.',
        additionalTools: {},
      },
      harness.context,
    )

    const firstInput = harness.generateTextInputs[0] as { messages: { role: string; content: string }[] }
    expect(firstInput.messages[0].role).toBe('system')
    expect(firstInput.messages[0].content).toContain('First edit must replace the scaffold.')
    expect(firstInput.messages[0].content).toContain('Implement the provided task directly')
    expect(firstInput.messages[0].content).not.toContain('approved in Phase 1')
  })

  test('skipFix prevents the post-implementation fix phase', async () => {
    const harness = createHarness([jsonResponse({ summary: 'Implemented without fix.', bailReason: null })])

    await codeWorkflow(
      {
        task: 'Implement without running checks.',
        mode: 'direct',
        interactive: false,
        skipFix: true,
        additionalTools: {},
      },
      harness.context,
    )

    expect(harness.infoMessages.join('\n')).not.toContain('Checking for errors')
    expect(harness.toolCalls).not.toContain('executeCommand')
  })

  test('default mode still enters the planning path', async () => {
    const harness = createHarness([
      jsonResponse({ plan: '1. Modify the target file.', files: [] }),
      jsonResponse({ summary: 'Implemented planned task.', bailReason: null }),
    ])

    const result = await codeWorkflow(
      {
        task: 'Implement through the normal planned workflow.',
        interactive: false,
        skipFix: true,
        additionalTools: {},
      },
      harness.context,
    )

    expect(result).toEqual({ success: true, summaries: ['Implemented planned task.'] })
    expect(harness.generateTextInputs).toHaveLength(2)
    expect(harness.infoMessages.join('\n')).toContain('Phase 1: Creating implementation plan')
    expect(textParts(harness.generateTextInputs[1]).join('\n')).toContain('## Your Plan')
  })
})
