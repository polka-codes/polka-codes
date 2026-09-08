import { expect, test } from 'bun:test'
import { getProvider } from '@polka-codes/cli-shared'
import { type AgentToolRegistry, agentWorkflow, createContext, UsageMeter } from '@polka-codes/core'
import { z } from 'zod'
import { AiProvider, getModel } from './getModel'
import { getProviderOptions } from './getProviderOptions'
import { type ToolCallContext, toolCall } from './tool-implementations'
import { readMemory } from './tools'

const requestSchema = z.object({
  model: z.string(),
  reasoning: z.object({ max_tokens: z.number() }).optional(),
  messages: z.array(
    z.object({
      role: z.string(),
      content: z.unknown().optional(),
      reasoning_details: z.array(z.json()).optional(),
      tool_calls: z.array(z.json()).optional(),
      tool_call_id: z.string().optional(),
    }),
  ),
})

test.each(['signed and encrypted', 'encrypted only'])('preserves %s OpenRouter reasoning through a tool round trip', async (variant) => {
  const encryptedOnly = variant === 'encrypted only'
  const modelId = 'anthropic/claude-sonnet-4'
  const signedReasoning = {
    type: 'reasoning.text',
    text: 'Check memory.',
    signature: 'test-signature',
    format: 'anthropic-claude-v1',
    index: 0,
  }
  const encryptedReasoning = {
    type: 'reasoning.encrypted',
    data: 'opaque-test-data',
    format: 'anthropic-claude-v1',
    index: encryptedOnly ? 0 : 1,
  }
  const reasoningDetails = encryptedOnly ? [encryptedReasoning] : [signedReasoning, encryptedReasoning]
  const toolCallData = {
    id: 'call-memory',
    type: 'function',
    function: { name: 'readMemory', arguments: '{"topic":"test"}' },
  }
  const requests: z.infer<typeof requestSchema>[] = []
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      requests.push(requestSchema.parse(await request.json()))
      const firstRound = requests.length === 1
      const deltas = firstRound
        ? [
            ...(encryptedOnly
              ? []
              : [
                  { reasoning_details: [{ type: 'reasoning.text', text: 'Check ', format: 'anthropic-claude-v1', index: 0 }] },
                  { reasoning_details: [{ type: 'reasoning.text', text: 'memory.', index: 0 }] },
                  { reasoning_details: [{ type: 'reasoning.text', signature: 'test-signature', index: 0 }] },
                ]),
            { reasoning_details: [encryptedReasoning] },
            { tool_calls: [{ index: 0, ...toolCallData }] },
          ]
        : [{ content: 'Memory checked.' }]
      const chunks = [...deltas, {}].map((delta, index) => ({
        id: `response-${requests.length}`,
        object: 'chat.completion.chunk',
        created: 1,
        model: modelId,
        choices: [{ index: 0, delta, finish_reason: index === deltas.length ? (firstRound ? 'tool_calls' : 'stop') : null }],
      }))
      return new Response(`${chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join('')}data: [DONE]\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  try {
    const context: ToolCallContext = {
      model: getModel({ provider: AiProvider.OpenRouter, model: modelId, apiKey: 'test', baseUrl: server.url.href }),
      parameters: {
        retryCount: 0,
        usageMeter: new UsageMeter({}, { maxMessages: 2 }),
        providerOptions: getProviderOptions({
          provider: AiProvider.OpenRouter,
          modelId,
          parameters: { thinkingBudgetTokens: 8192 },
        }),
      },
      toolProvider: getProvider(),
      workflowContext: { logger: { debug() {}, info() {}, warn() {}, error() {} } },
    }
    await toolCall({ tool: 'updateMemory', input: { operation: 'replace', topic: 'test', content: 'Stored value.' } }, context)
    const result = await agentWorkflow(
      { messages: [], userMessage: [{ role: 'user', content: 'Read the test memory.' }], tools: [readMemory] },
      createContext<AgentToolRegistry>({
        generateText: async (input) => {
          const round = await toolCall({ tool: 'generateText', input }, context)
          if (!round || typeof round !== 'object' || !('responseMessages' in round)) {
            throw new Error('Expected a model round')
          }
          return {
            ...round,
            responseMessages: round.responseMessages.map((message) => {
              if (message.role !== 'assistant' && message.role !== 'tool') throw new Error('Expected a response message')
              return message
            }),
          }
        },
        invokeTool: async (input) => {
          const response = await toolCall({ tool: 'invokeTool', input }, context)
          return z.object({ success: z.literal(true), message: z.object({ type: z.literal('text'), value: z.string() }) }).parse(response)
        },
        taskEvent: async () => {},
      }),
    )

    expect(result).toMatchObject({ type: 'Exit', message: 'Memory checked.' })
    expect(requests).toHaveLength(2)
    expect(requests[1].messages.filter((message) => message.role === 'assistant')).toEqual([
      expect.objectContaining({ reasoning_details: reasoningDetails, tool_calls: [toolCallData] }),
    ])
    expect(requests[1].messages.filter((message) => message.role === 'tool')).toEqual([
      { role: 'tool', tool_call_id: 'call-memory', content: '<memory topic="test">\nStored value.\n</memory>' },
    ])
    for (const request of requests) {
      expect(request.model).toBe(modelId)
      expect(request.reasoning).toEqual({ max_tokens: 8192 })
    }
  } finally {
    server.stop(true)
  }
})
