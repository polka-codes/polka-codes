/**
 * Tests for Agent prompts
 * Generated by polka.codes
 */

import { describe, expect, test } from 'bun:test'
import type { ToolInfo } from '../tool'
import type { AgentInfo } from './AgentBase'
import { agentsPrompt, responsePrompts, toolUsePrompt } from './prompts'

describe('Agent prompts', () => {
  describe('toolUsePrompt', () => {
    test('should generate tool use documentation with tools', () => {
      const tools: ToolInfo[] = [
        {
          name: 'test_tool',
          description: 'A test tool',
          parameters: [
            {
              name: 'param1',
              description: 'First parameter',
              required: true,
              usageValue: 'value1',
            },
            {
              name: 'param2',
              description: 'Second parameter',
              required: false,
              usageValue: 'value2',
            },
          ],
          examples: [
            {
              description: 'Example usage',
              parameters: [
                { name: 'param1', value: 'test1' },
                { name: 'param2', value: 'test2' },
              ],
            },
          ],
        },
      ]

      const prompt = toolUsePrompt(tools, 'tool_')
      expect(prompt).toMatchSnapshot()
    })

    test('should return empty string when no tools provided', () => {
      const prompt = toolUsePrompt([], 'tool_')
      expect(prompt).toBe('')
    })
  })

  describe('agentsPrompt', () => {
    test('should generate agents documentation', () => {
      const agents: AgentInfo[] = [
        {
          name: 'TestAgent',
          responsibilities: ['Test responsibility 1', 'Test responsibility 2'],
        },
        {
          name: 'AnotherAgent',
          responsibilities: ['Another responsibility'],
        },
      ]

      const prompt = agentsPrompt(agents, 'CurrentAgent')
      expect(prompt).toMatchSnapshot()
    })

    test('should include current agent name', () => {
      const agents: AgentInfo[] = [
        {
          name: 'TestAgent',
          responsibilities: ['Test responsibility'],
        },
      ]

      const prompt = agentsPrompt(agents, 'CurrentAgent')
      expect(prompt).toContain('CurrentAgent')
      expect(prompt).toMatchSnapshot()
    })
  })

  describe('responsePrompts', () => {
    test('errorInvokeTool should format error message', () => {
      const message = responsePrompts.errorInvokeTool('test_tool', 'Test error')
      expect(message).toContain('test_tool')
      expect(message).toContain('Test error')
      expect(message).toMatchSnapshot()
    })

    test('requireUseTool should return error message', () => {
      expect(responsePrompts.requireUseTool).toMatchSnapshot()
    })

    test('toolResults should format tool results', () => {
      const results = responsePrompts.toolResults('test_tool', 'Test result')
      expect(results).toContain('test_tool')
      expect(results).toContain('Test result')
      expect(results).toMatchSnapshot()
    })
  })
})
