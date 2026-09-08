import { describe, expect, test } from 'bun:test'
import { type AgentToolRegistry, createContext, type FullToolInfo } from '@polka-codes/core'
import { z } from 'zod'
import { taskWorkflow } from './task.workflow'

describe('taskWorkflow tool permissions', () => {
  test.each([true, false])('enforces the advertised tool set at dispatch with readonly=%s', async (readonly) => {
    const externalNames = ['fixture/delete_file', 'fixture/unknown']
    const mcpTools: FullToolInfo[] = externalNames.map((name) => ({
      name,
      description: name,
      parameters: z.object({}),
      handler: async () => ({ success: true, message: { type: 'text', value: name } }),
    }))
    const advertised: string[][] = []
    const dispatched: string[] = []
    const context = createContext<AgentToolRegistry>({
      taskEvent: async () => {},
      generateText: async (input) => {
        advertised.push(Object.keys(input.tools))
        return {
          requestMessages: input.messages,
          responseMessages: [
            {
              role: 'assistant',
              content:
                advertised.length === 1
                  ? externalNames.map((toolName, index) => ({ type: 'tool-call' as const, toolCallId: String(index), toolName, input: {} }))
                  : 'Done',
            },
          ],
        }
      },
      invokeTool: async ({ toolName }) => {
        dispatched.push(toolName)
        return { success: true, message: { type: 'text', value: toolName } }
      },
    })

    const result = await taskWorkflow(
      { task: 'Inspect the project.', readonly, interactive: false, additionalTools: { mcpTools } },
      context,
    )

    expect(result.type).toBe('Exit')
    expect(advertised).toHaveLength(2)
    for (const names of advertised) {
      expect(names).toContain('readFile')
      expect(names).toContain('searchFiles')
      for (const name of [...externalNames, 'writeToFile', 'executeCommand']) {
        expect(names.includes(name)).toBe(!readonly)
      }
    }
    expect(dispatched).toEqual(readonly ? [] : externalNames)
  })
})
