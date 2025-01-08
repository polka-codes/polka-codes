import { describe, expect, it } from 'bun:test'
import type { Anthropic } from '@anthropic-ai/sdk'
import type OpenAI from 'openai'

import { convertToAnthropicMessage, convertToOpenAiMessages } from './utils'

describe('convertToOpenAiMessages', () => {
  it('should convert simple text messages', () => {
    const anthropicMessages: Anthropic.Messages.MessageParam[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]

    const result = convertToOpenAiMessages(anthropicMessages)

    expect(result).toEqual([
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ])
  })

  it('should handle user messages with images', () => {
    const anthropicMessages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image:' },
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: 'base64data',
            },
          },
        ],
      },
    ]

    const result = convertToOpenAiMessages(anthropicMessages)

    expect(result).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: 'Check this image:' },
          {
            type: 'image_url',
            image_url: {
              url: 'data:image/jpeg;base64,base64data',
            },
          },
        ],
      },
    ])
  })

  it('should handle assistant messages with tool calls', () => {
    const anthropicMessages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Let me help you with that.' },
          {
            type: 'tool_use',
            id: 'tool123',
            name: 'search',
            input: { query: 'test' },
          },
        ],
      },
    ]

    const result = convertToOpenAiMessages(anthropicMessages)

    expect(result).toEqual([
      {
        role: 'assistant',
        content: 'Let me help you with that.',
        tool_calls: [
          {
            id: 'tool123',
            type: 'function',
            function: {
              name: 'search',
              arguments: '{"query":"test"}',
            },
          },
        ],
      },
    ])
  })

  it('should handle tool results', () => {
    const anthropicMessages: Anthropic.Messages.MessageParam[] = [
      {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: 'tool123',
            content: 'Search results found',
          },
        ],
      },
    ]

    const result = convertToOpenAiMessages(anthropicMessages)

    expect(result).toEqual([
      {
        role: 'tool',
        tool_call_id: 'tool123',
        content: 'Search results found',
      },
    ])
  })
})

describe('convertToAnthropicMessage', () => {
  it('should convert simple text completion', () => {
    const openAiCompletion: OpenAI.Chat.Completions.ChatCompletion = {
      id: 'cmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Hello there!',
            refusal: null,
          },
          finish_reason: 'stop',
          index: 0,
          logprobs: null,
        },
      ],
      created: 1234567890,
      model: 'gpt-4',
      object: 'chat.completion',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    }

    const result = convertToAnthropicMessage(openAiCompletion)

    expect(result).toEqual({
      id: 'cmpl-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Hello there!',
        },
      ],
      model: 'gpt-4',
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    })
  })

  it('should handle tool calls in completion', () => {
    const openAiCompletion: OpenAI.Chat.Completions.ChatCompletion = {
      id: 'cmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Let me search that for you.',
            refusal: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'search',
                  arguments: '{"query":"test"}',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
          index: 0,
          logprobs: null,
        },
      ],
      created: 1234567890,
      model: 'gpt-4',
      object: 'chat.completion',
      usage: {
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      },
    }

    const result = convertToAnthropicMessage(openAiCompletion)

    expect(result).toEqual({
      id: 'cmpl-123',
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'text',
          text: 'Let me search that for you.',
        },
        {
          type: 'tool_use',
          id: 'call_123',
          name: 'search',
          input: { query: 'test' },
        },
      ],
      model: 'gpt-4',
      stop_reason: 'tool_use',
      stop_sequence: null,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_creation_input_tokens: null,
        cache_read_input_tokens: null,
      },
    })
  })

  it('should handle invalid tool call arguments', () => {
    const openAiCompletion: OpenAI.Chat.Completions.ChatCompletion = {
      id: 'cmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Testing invalid arguments',
            refusal: null,
            tool_calls: [
              {
                id: 'call_123',
                type: 'function',
                function: {
                  name: 'test',
                  arguments: 'invalid json',
                },
              },
            ],
          },
          finish_reason: 'tool_calls',
          index: 0,
          logprobs: null,
        },
      ],
      created: 1234567890,
      model: 'gpt-4',
      object: 'chat.completion',
    }

    const result = convertToAnthropicMessage(openAiCompletion)

    expect(result.content).toHaveLength(2)
    expect(result.content[1]).toEqual({
      type: 'tool_use',
      id: 'call_123',
      name: 'test',
      input: {},
    })
  })

  it('should handle different finish reasons', () => {
    const createCompletion = (finish_reason: 'stop' | 'length' | 'tool_calls'): OpenAI.Chat.Completions.ChatCompletion => ({
      id: 'cmpl-123',
      choices: [
        {
          message: {
            role: 'assistant',
            content: 'Test',
            refusal: null,
          },
          finish_reason: finish_reason,
          index: 0,
          logprobs: null,
        },
      ],
      created: 1234567890,
      model: 'gpt-4',
      object: 'chat.completion',
    })

    expect(convertToAnthropicMessage(createCompletion('stop')).stop_reason).toBe('end_turn')
    expect(convertToAnthropicMessage(createCompletion('length')).stop_reason).toBe('max_tokens')
    expect(convertToAnthropicMessage(createCompletion('tool_calls')).stop_reason).toBe('tool_use')
  })
})
