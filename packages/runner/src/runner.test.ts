import { describe, expect, test } from 'bun:test'
import { Runner } from './runner'
import type { WsOutgoingMessage } from './types'

function createRunnerWithToolResponse(message: unknown) {
  const runner = new Runner(
    {
      taskId: 'task-1',
      sessionToken: 'session-token',
      githubToken: 'github-token',
      api: 'ws://localhost:1234',
    },
    undefined,
  )

  const sentMessages: WsOutgoingMessage[] = []

  ;(
    runner as unknown as {
      wsManager: { sendMessage: (message: WsOutgoingMessage) => void }
      availableTools: Record<string, { handler: () => Promise<unknown> }>
    }
  ).wsManager = {
    sendMessage(message: WsOutgoingMessage) {
      sentMessages.push(message)
    },
  }

  ;(
    runner as unknown as {
      availableTools: Record<string, { handler: () => Promise<unknown> }>
    }
  ).availableTools = {
    readBinaryFile: {
      handler: async () => ({
        success: true,
        message,
      }),
    },
  }

  return { runner, sentMessages }
}

describe('Runner tool response normalization', () => {
  test('preserves image-data content as structured image output', async () => {
    const { runner, sentMessages } = createRunnerWithToolResponse({
      type: 'content',
      value: [
        {
          type: 'image-data',
          data: 'aGVsbG8=',
          mediaType: 'image/png',
        },
      ],
    })

    await (
      runner as unknown as {
        handlePendingTools: (message: {
          type: 'pending_tools'
          step: number
          requests: Array<{ index: number; tool: string; params: Record<string, never> }>
        }) => Promise<void>
      }
    ).handlePendingTools({
      type: 'pending_tools',
      step: 3,
      requests: [{ index: 0, tool: 'readBinaryFile', params: {} }],
    })

    expect(sentMessages).toEqual([
      {
        type: 'pending_tools_response',
        step: 3,
        responses: [
          {
            index: 0,
            tool: 'readBinaryFile',
            response: [
              {
                type: 'text',
                text: '<tool_response name=readBinaryFile>',
              },
              {
                type: 'image',
                mediaType: 'image/png',
                source: {
                  type: 'base64',
                  data: 'aGVsbG8=',
                },
              },
              {
                type: 'text',
                text: '</tool_response>',
              },
            ],
          },
        ],
      },
    ])
  })

  test('preserves file-data content as structured file output', async () => {
    const { runner, sentMessages } = createRunnerWithToolResponse({
      type: 'content',
      value: [
        {
          type: 'file-data',
          data: 'ZmlsZQ==',
          mediaType: 'application/pdf',
        },
      ],
    })

    await (
      runner as unknown as {
        handlePendingTools: (message: {
          type: 'pending_tools'
          step: number
          requests: Array<{ index: number; tool: string; params: Record<string, never> }>
        }) => Promise<void>
      }
    ).handlePendingTools({
      type: 'pending_tools',
      step: 4,
      requests: [{ index: 1, tool: 'readBinaryFile', params: {} }],
    })

    expect(sentMessages).toEqual([
      {
        type: 'pending_tools_response',
        step: 4,
        responses: [
          {
            index: 1,
            tool: 'readBinaryFile',
            response: [
              {
                type: 'text',
                text: '<tool_response name=readBinaryFile>',
              },
              {
                type: 'file',
                mediaType: 'application/pdf',
                source: {
                  type: 'base64',
                  data: 'ZmlsZQ==',
                },
              },
              {
                type: 'text',
                text: '</tool_response>',
              },
            ],
          },
        ],
      },
    ])
  })

  test('keeps image-url and file-url normalization as text placeholders', async () => {
    const { runner, sentMessages } = createRunnerWithToolResponse({
      type: 'content',
      value: [
        {
          type: 'image-url',
          url: 'https://example.com/image.png',
        },
        {
          type: 'file-url',
          url: 'https://example.com/file.pdf',
        },
      ],
    })

    await (
      runner as unknown as {
        handlePendingTools: (message: {
          type: 'pending_tools'
          step: number
          requests: Array<{ index: number; tool: string; params: Record<string, never> }>
        }) => Promise<void>
      }
    ).handlePendingTools({
      type: 'pending_tools',
      step: 5,
      requests: [{ index: 2, tool: 'readBinaryFile', params: {} }],
    })

    expect(sentMessages).toEqual([
      {
        type: 'pending_tools_response',
        step: 5,
        responses: [
          {
            index: 2,
            tool: 'readBinaryFile',
            response: [
              {
                type: 'text',
                text: '<tool_response name=readBinaryFile>',
              },
              {
                type: 'text',
                text: '<media url="https://example.com/image.png" />',
              },
              {
                type: 'text',
                text: '<media url="https://example.com/file.pdf" />',
              },
              {
                type: 'text',
                text: '</tool_response>',
              },
            ],
          },
        ],
      },
    ])
  })
})
