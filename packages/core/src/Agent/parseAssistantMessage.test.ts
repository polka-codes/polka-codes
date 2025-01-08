import { describe, expect, test } from 'bun:test'
import type { ToolInfo } from '../tool'
import { parseAssistantMessage } from './parseAssistantMessage'

describe('parseAssistantMessage', () => {
  const mockTools: ToolInfo[] = [
    {
      name: 'test_tool',
      description: 'A test tool',
      parameters: [
        { name: 'param1', description: 'First parameter', required: true, usageValue: 'value1' },
        { name: 'param2', description: 'Second parameter', required: false, usageValue: 'value2' },
      ],
    },
  ]
  const toolPrefix = 'tool_'

  test('should parse plain text message', () => {
    const message = 'This is a plain text message'
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'text',
        content: message,
      },
    ])
  })

  test('should parse message with tool use and XML-like parameters', () => {
    const message = `<tool_test_tool>
      <tool_parameter_param1>value1</tool_parameter_param1>
      <tool_parameter_param2>value2</tool_parameter_param2>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value1',
          param2: 'value2',
        },
      },
    ])
  })

  test('should parse message with text before and after tool use', () => {
    const message = `Before text <tool_test_tool>
      <tool_parameter_param1>value1</tool_parameter_param1>
    </tool_test_tool> After text`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'text',
        content: 'Before text',
      },
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value1',
        },
      },
      {
        type: 'text',
        content: 'After text',
      },
    ])
  })

  test('should handle tool with missing optional parameter', () => {
    const message = `<tool_test_tool>
      <tool_parameter_param1>value1</tool_parameter_param1>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value1',
        },
      },
    ])
  })

  test('should handle message with unknown tool', () => {
    const message = `<tool_unknown>
      <tool_parameter_param1>value1</tool_parameter_param1>
    </tool_unknown>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    // Should treat the entire message as text since tool is unknown
    expect(result).toEqual([
      {
        type: 'text',
        content: message,
      },
    ])
  })

  test('should handle message with malformed parameter tags', () => {
    const message = '<tool_test_tool>malformed params</tool_test_tool>'
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {}, // No params should be parsed
      },
    ])
  })

  test('should handle multiline parameter values', () => {
    const message = `<tool_test_tool>
      <tool_parameter_param1>
        multiline
        value
      </tool_parameter_param1>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'multiline\n        value',
        },
      },
    ])
  })

  test('should handle parameter values containing XML-like tags', () => {
    const message = `<tool_test_tool>
      <tool_parameter_param1>value with <some>xml</some> tags</tool_parameter_param1>
      <tool_parameter_param2>another <tag>nested</tag> value</tool_parameter_param2>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value with <some>xml</some> tags',
          param2: 'another <tag>nested</tag> value',
        },
      },
    ])
  })

  test('should handle parameter values containing incomplete/malformed XML tags', () => {
    const message = `<tool_test_tool>
      <tool_parameter_param1>value with <unclosed tag</tool_parameter_param1>
      <tool_parameter_param2>value with </>empty tag</> here</tool_parameter_param2>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value with <unclosed tag',
          param2: 'value with </>empty tag</> here',
        },
      },
    ])
  })

  test('should handle parameter values containing tool-like tags', () => {
    const message = `<tool_test_tool>
      <tool_parameter_param1>value with <tool_test_tool>nested tool</tool_test_tool> tags</tool_parameter_param1>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value with <tool_test_tool>nested tool</tool_test_tool> tags',
        },
      },
    ])
  })
})
