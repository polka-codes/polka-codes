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
    {
      name: 'read_file',
      description: 'Read file tool',
      parameters: [
        {
          name: 'path',
          description: 'File path',
          required: true,
          usageValue: 'path/to/file',
          allowMultiple: true,
        },
      ],
    },
    {
      name: 'nested_tool',
      description: 'Tool with nested parameters',
      parameters: [
        {
          name: 'config',
          description: 'Configuration object',
          required: true,
          usageValue: 'config',
          children: [
            { name: 'key1', description: 'Key 1', required: false, usageValue: 'value1' },
            { name: 'key2', description: 'Key 2', required: false, usageValue: 'value2' },
            {
              name: 'level1',
              description: 'Level 1',
              required: false,
              usageValue: 'level1',
              children: [
                {
                  name: 'level2',
                  description: 'Level 2',
                  required: false,
                  usageValue: 'level2',
                  children: [{ name: 'level3', description: 'Level 3', required: false, usageValue: 'level3' }],
                },
              ],
            },
          ],
        },
      ],
    },
    {
      name: 'combined_tool',
      description: 'Tool with both array and nested parameters',
      parameters: [
        {
          name: 'paths',
          description: 'File paths',
          required: true,
          usageValue: 'paths',
          allowMultiple: true,
        },
        {
          name: 'options',
          description: 'Options object',
          required: true,
          usageValue: 'options',
          children: [
            { name: 'recursive', description: 'Recursive flag', required: false, usageValue: 'true' },
            {
              name: 'filter',
              description: 'Filter options',
              required: false,
              usageValue: 'filter',
              children: [
                { name: 'include', description: 'Include pattern', required: false, usageValue: '*.ts' },
                { name: 'exclude', description: 'Exclude pattern', required: false, usageValue: 'node_modules' },
              ],
            },
          ],
        },
      ],
    },
  ]
  const toolPrefix = 'test_'

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
    const message = `<test_test_tool>
      <test_parameter_param1>value1</test_parameter_param1>
      <test_parameter_param2>value2</test_parameter_param2>
    </test_test_tool>`
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
    const message = `Before text <test_test_tool>
      <test_parameter_param1>value1</test_parameter_param1>
    </test_test_tool> After text`
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
    const message = `<test_test_tool>
      <test_parameter_param1>value1</test_parameter_param1>
    </test_test_tool>`
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
    const message = `<test_unknown>
      <test_parameter_param1>value1</test_parameter_param1>
    </test_unknown>`
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
    const message = '<test_test_tool>malformed params</test_test_tool>'
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
    const message = `<test_test_tool>
      <test_parameter_param1>
        multiline
        value
      </test_parameter_param1>
    </test_test_tool>`
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
    const message = `<test_test_tool>
      <test_parameter_param1>value with <some>xml</some> tags</test_parameter_param1>
      <test_parameter_param2>another <tag>nested</tag> value</test_parameter_param2>
    </test_test_tool>`
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
    const message = `<test_test_tool>
      <test_parameter_param1>value with <unclosed tag</test_parameter_param1>
      <test_parameter_param2>value with </>empty tag</> here</test_parameter_param2>
    </test_test_tool>`
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
    const message = `<test_test_tool>
      <test_parameter_param1>value with <test_test_tool2>nested tool</test_test_tool2> tags</test_parameter_param1>
    </test_test_tool>`
    const result = parseAssistantMessage(message, mockTools, toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'test_tool',
        params: {
          param1: 'value with <test_test_tool2>nested tool</test_test_tool2> tags',
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
      },
    ]

    const message = `Starting text
    <test_test_tool>
      <test_parameter_param1>value1</test_parameter_param1>
    </test_test_tool>
    Middle text
    <test_another_tool>
      <test_parameter_paramA>valueA</test_parameter_paramA>
    </test_another_tool>
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
    const message = `<test_read_file>
      <test_parameter_path>test.ts</test_parameter_path>
      <test_parameter_path>main.ts</test_parameter_path>
    </test_read_file>`
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
    const message = `<test_nested_tool>
      <test_parameter_config>
        <test_parameter_key1>value1</test_parameter_key1>
        <test_parameter_key2>value2</test_parameter_key2>
      </test_parameter_config>
    </test_nested_tool>`
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
    const message = `<test_nested_tool>
      <test_parameter_config>
        <test_parameter_level1>
          <test_parameter_level2>
            <test_parameter_level3>deep value</test_parameter_level3>
          </test_parameter_level2>
        </test_parameter_level1>
      </test_parameter_config>
    </test_nested_tool>`
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
    const message = `<test_combined_tool>
      <test_parameter_paths>path1.ts</test_parameter_paths>
      <test_parameter_paths>path2.ts</test_parameter_paths>
      <test_parameter_options>
        <test_parameter_recursive>true</test_parameter_recursive>
        <test_parameter_filter>
          <test_parameter_include>*.ts</test_parameter_include>
          <test_parameter_exclude>node_modules</test_parameter_exclude>
        </test_parameter_filter>
      </test_parameter_options>
    </test_combined_tool>`
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

  test('handle array of nested object', () => {
    const message = `<test_ask_followup_question>
<test_parameter_questions>
<test_parameter_prompt>What type of task does this issue represent?</test_parameter_prompt>
<test_parameter_options>Feature request</test_parameter_options>
<test_parameter_options>Bug fix</test_parameter_options>
<test_parameter_options>Test setup</test_parameter_options>
<test_parameter_options>Other (please specify)</test_parameter_options>
</test_parameter_questions>
</test_ask_followup_question>`

    const askFollowupQuestionV1: ToolInfo = {
      name: 'ask_followup_question',
      description: 'ask a question',
      parameters: [
        {
          name: 'questions',
          description: 'questions',
          required: true,
          allowMultiple: true,
          children: [
            { name: 'prompt', description: 'prompt', required: true },
            { name: 'options', description: 'options', required: false, allowMultiple: true },
          ],
        },
      ],
    }

    const result = parseAssistantMessage(message, [askFollowupQuestionV1], toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'ask_followup_question',
        params: {
          questions: [
            {
              prompt: 'What type of task does this issue represent?',
              options: ['Feature request', 'Bug fix', 'Test setup', 'Other (please specify)'],
            },
          ],
        },
      },
    ])
  })

  test('should handle multiple questions in askFollowupQuestion', () => {
    const message = `<test_ask_followup_question>
<test_parameter_questions>
<test_parameter_prompt>First question?</test_parameter_prompt>
<test_parameter_options>Option A</test_parameter_options>
<test_parameter_options>Option B</test_parameter_options>
</test_parameter_questions>
<test_parameter_questions>
<test_parameter_prompt>Second question?</test_parameter_prompt>
</test_parameter_questions>
</test_ask_followup_question>`

    const askFollowupQuestionV1: ToolInfo = {
      name: 'ask_followup_question',
      description: 'ask a question',
      parameters: [
        {
          name: 'questions',
          description: 'questions',
          required: true,
          allowMultiple: true,
          children: [
            { name: 'prompt', description: 'prompt', required: true },
            { name: 'options', description: 'options', required: false, allowMultiple: true },
          ],
        },
      ],
    }
    const result = parseAssistantMessage(message, [askFollowupQuestionV1], toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'ask_followup_question',
        params: {
          questions: [
            {
              prompt: 'First question?',
              options: ['Option A', 'Option B'],
            },
            {
              prompt: 'Second question?',
            },
          ],
        },
      },
    ])
  })

  test('should handle parameter that does not support arrays', () => {
    // Create a tool that doesn't support arrays
    const noArrayTool: ToolInfo = {
      name: 'no_array_tool',
      description: 'A tool that does not support arrays',
      parameters: [
        {
          name: 'param',
          description: 'Parameter',
          required: true,
          usageValue: 'value',
          // allowMultiple not set (defaults to false)
        },
      ],
    }

    const message = `<test_no_array_tool>
<test_parameter_param>value1</test_parameter_param>
<test_parameter_param>value2</test_parameter_param>
</test_no_array_tool>`

    const result = parseAssistantMessage(message, [noArrayTool], toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'no_array_tool',
        params: {
          param: 'value1', // Only the first occurrence should be used
        },
      },
    ])
  })

  test('should handle parameter that does not support nesting', () => {
    // Create a tool that doesn't support nesting
    const noNestTool: ToolInfo = {
      name: 'no_nest_tool',
      description: 'A tool that does not support nesting',
      parameters: [
        {
          name: 'param',
          description: 'Parameter',
          required: true,
          usageValue: 'value',
          // No children defined
        },
      ],
    }

    const message = `<test_no_nest_tool>
<test_parameter_param>
<test_parameter_nested>nested value</test_parameter_nested>
</test_parameter_param>
</test_no_nest_tool>`

    const result = parseAssistantMessage(message, [noNestTool], toolPrefix)

    expect(result).toEqual([
      {
        type: 'tool_use',
        name: 'no_nest_tool',
        params: {
          param: '<test_parameter_nested>nested value</test_parameter_nested>',
        },
      },
    ])
  })
})
