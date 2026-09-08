import { expect, test } from 'bun:test'
import { z } from 'zod'
import type { AgentToolRegistry } from './agent.workflow'
import { createDynamicWorkflow } from './dynamic'
import type { JsonResponseMessage } from './json-ai-types'
import { createContext } from './workflow'

const toolResponse: JsonResponseMessage = {
  role: 'assistant',
  content: [{ type: 'tool-call', toolCallId: 'late', toolName: 'effect', input: {} }],
}
const effect = {
  name: 'effect',
  description: 'Record an effect',
  parameters: z.object({}),
  handler: async () => ({ success: true as const, message: { type: 'text' as const, value: 'ok' } }),
}

function workflow(recover = false) {
  const step = { id: 'slow', task: 'Wait', timeout: 10 }
  return createDynamicWorkflow<AgentToolRegistry>(
    {
      workflows: {
        main: {
          task: 'Timeout',
          steps: recover ? [{ id: 'recover', try: { trySteps: [step], catchSteps: [{ id: 'fallback', task: 'Recover' }] } }] : [step],
        },
      },
    },
    { toolInfo: [effect] },
  )
}

test('late model responses cannot invoke tools or begin another round after recovery', async () => {
  const late = Promise.withResolvers<JsonResponseMessage>()
  let requests = 0
  let effects = 0
  let expiredSignal: AbortSignal | undefined
  const context = createContext<AgentToolRegistry>({
    generateText: async ({ messages, signal }) => {
      requests++
      if (requests === 1) {
        expiredSignal = signal
        return { requestMessages: messages, responseMessages: [await late.promise] }
      }
      expect(expiredSignal?.aborted).toBe(true)
      expect(signal?.aborted).not.toBe(true)
      return { requestMessages: messages, responseMessages: [{ role: 'assistant', content: 'Recovered' }] }
    },
    invokeTool: async () => {
      effects++
      return effect.handler()
    },
    taskEvent: async () => {},
  })
  await workflow(true)('main', {}, context)
  late.resolve(toolResponse)
  await Bun.sleep(10)
  expect(requests).toBe(2)
  expect(effects).toBe(0)
})

test('running tools receive cancellation and cannot trigger another request', async () => {
  let requests = 0
  let cancelled = false
  const context = createContext<AgentToolRegistry>({
    generateText: async ({ messages }) => {
      requests++
      return { requestMessages: messages, responseMessages: [toolResponse] }
    },
    invokeTool: async ({ signal }) => {
      if (!signal) throw new Error('Missing cancellation signal')
      return new Promise((_, reject) =>
        signal.addEventListener(
          'abort',
          () => {
            cancelled = true
            reject(signal.reason)
          },
          { once: true },
        ),
      )
    },
    taskEvent: async () => {},
  })
  await expect(workflow()('main', {}, context)).rejects.toThrow('timed out')
  expect(cancelled).toBe(true)
  expect(requests).toBe(1)
})

test('successful steps dispose their timeout', async () => {
  let completedSignal: AbortSignal | undefined
  const context = createContext<AgentToolRegistry>({
    generateText: async ({ messages, signal }) => {
      completedSignal = signal
      return { requestMessages: messages, responseMessages: [{ role: 'assistant', content: 'Done' }] }
    },
    invokeTool: async () => effect.handler(),
    taskEvent: async () => {},
  })
  await workflow()('main', {}, context)
  await Bun.sleep(20)
  expect(completedSignal?.aborted).toBe(false)
})
