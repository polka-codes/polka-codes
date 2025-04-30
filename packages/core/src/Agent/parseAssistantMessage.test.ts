import { describe, expect, test } from 'bun:test'
import { PermissionLevel, type ToolInfo } from '../tool'
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
      permissionLevel: PermissionLevel.None,
    },
    {
      name: 'read_file',
      description: 'Read file tool',
      parameters: [{ name: 'path', description: 'File path', required: true, usageValue: 'path/to/file' }],
      permissionLevel: PermissionLevel.Read,
    },
    {
      name: 'nested_tool',
      description: 'Tool with nested parameters',
      parameters: [{ name: 'config', description: 'Configuration object', required: true, usageValue: 'config' }],
      permissionLevel: PermissionLevel.None,
    },
    {
      name: 'combined_tool',
      description: 'Tool with both array and nested parameters',
      parameters: [
        { name: 'paths', description: 'File paths', required: true, usageValue: 'paths' },
        { name: 'options', description: 'Options object', required: true, usageValue: 'options' },
      ],
      permissionLevel: PermissionLevel.None,
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
      <tool_parameter_param1>value with <tool_test_tool2>nested tool</tool_test_tool2> tags</tool_parameter_param1>
    </tool_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value with <tool_test_tool2>nested tool</tool_test_tool2> tags',
        },
      },
    ])
  })

  test('should parse message with multiple tool uses', () => {
    const mockTools2 = [
      ...mockTools,
      {
        name: 'another_tool',
        description: 'Another test tool',
        parameters: [{ name: 'paramA', description: 'Parameter A', required: true, usageValue: 'valueA' }],
        permissionLevel: PermissionLevel.None,
      },
    ]

    const message = `Starting text
    <tool_test_tool>
      <tool_parameter_param1>value1</tool_parameter_param1>
    </tool_test_tool>
    Middle text
    <tool_another_tool>
      <tool_parameter_paramA>valueA</tool_parameter_paramA>
    </tool_another_tool>
    Ending text`

    const result = parseAssistantMessage(message, mockTools2, toolPrefix)

    expect(result).toEqual([
      {
        type: 'text',
        content: 'Starting text',
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
        content: 'Middle text',
      },
      {
        type: 'tool_use',
        name: 'another_tool',
        params: {
          paramA: 'valueA',
        },
      },
      {
        type: 'text',
        content: 'Ending text',
      },
    ])
  })

  // New tests for array mode
  test('should handle array mode with multiple occurrences of the same parameter', () => {
    const message = `<tool_read_file>
      <tool_parameter_path>test.ts</tool_parameter_path>
      <tool_parameter_path>main.ts</tool_parameter_path>
    </tool_read_file>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'read_file',
        params: {
          path: ['test.ts', 'main.ts'],
        },
      },
    ])
  })

  // New tests for nested objects
  test('should handle nested objects in parameters', () => {
    const message = `<tool_nested_tool>
      <tool_parameter_config>
        <tool_parameter_key1>value1</tool_parameter_key1>
        <tool_parameter_key2>value2</tool_parameter_key2>
      </tool_parameter_config>
    </tool_nested_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'nested_tool',
        params: {
          config: {
            key1: 'value1',
            key2: 'value2',
          },
        },
      },
    ])
  })

  // Test for deeply nested objects
  test('should handle deeply nested objects in parameters', () => {
    const message = `<tool_nested_tool>
      <tool_parameter_config>
        <tool_parameter_level1>
          <tool_parameter_level2>
            <tool_parameter_level3>deep value</tool_parameter_level3>
          </tool_parameter_level2>
        </tool_parameter_level1>
      </tool_parameter_config>
    </tool_nested_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'nested_tool',
        params: {
          config: {
            level1: {
              level2: {
                level3: 'deep value',
              },
            },
          },
        },
      },
    ])
  })

  // Test for combined array mode and nested objects
  test('should handle both array mode and nested objects together', () => {
    const message = `<tool_combined_tool>
      <tool_parameter_paths>path1.ts</tool_parameter_paths>
      <tool_parameter_paths>path2.ts</tool_parameter_paths>
      <tool_parameter_options>
        <tool_parameter_recursive>true</tool_parameter_recursive>
        <tool_parameter_filter>
          <tool_parameter_include>*.ts</tool_parameter_include>
          <tool_parameter_exclude>node_modules</tool_parameter_exclude>
        </tool_parameter_filter>
      </tool_parameter_options>
    </tool_combined_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'combined_tool',
        params: {
          paths: ['path1.ts', 'path2.ts'],
          options: {
            recursive: 'true',
            filter: {
              include: '*.ts',
              exclude: 'node_modules',
            },
          },
        },
      },
    ])
  })
})
