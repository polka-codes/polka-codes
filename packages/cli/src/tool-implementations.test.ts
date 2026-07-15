import { describe, expect, test } from 'bun:test'
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider'
import { UsageMeter } from '@polka-codes/core'
import { MaxRetriesExceededError, ProviderTimeoutError } from './errors'
import { prepareGenerateTextRequest, toolCall } from './tool-implementations'

class TimeoutLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4'
  readonly provider = 'timeout-test-provider'
  readonly modelId = 'timeout-test-model'
  readonly supportedUrls = {}
  readonly abortReasons: unknown[] = []
  attempts = 0

  async doGenerate(_options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    throw new Error('TimeoutLanguageModel only supports streaming')
  }

  async doStream(options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    this.attempts++

    return {
      stream: new ReadableStream({
        start: (controller) => {
          const abortSignal = options.abortSignal
          if (!abortSignal) {
            controller.error(new Error('Expected an abort signal'))
            return
          }

          const handleAbort = () => {
            this.abortReasons.push(abortSignal.reason)
            controller.error(abortSignal.reason)
          }

          if (abortSignal.aborted) {
            handleAbort()
          } else {
            abortSignal.addEventListener('abort', handleAbort, { once: true })
          }
        },
      }),
    }
  }
}

describe('prepareGenerateTextRequest', () => {
  test('moves system messages into the dedicated system prompt', () => {
    const request = prepareGenerateTextRequest(
      {
        systemPrompt: 'Primary system prompt.',
        messages: [
          { role: 'system', content: 'Continuation system prompt.' },
          { role: 'user', content: 'User request.' },
          { role: 'assistant', content: 'Assistant reply.' },
        ],
      },
      'openai',
      'gpt-5-mini',
    )

    expect(request.system).toBe('Primary system prompt.\n\nContinuation system prompt.')
    expect(request.messages).toEqual([
      { role: 'user', content: 'User request.' },
      { role: 'assistant', content: 'Assistant reply.' },
    ])
  })
})

describe('generateText', () => {
  test('retries timed-out requests without leaking a DOMException', async () => {
    const model = new TimeoutLanguageModel()
    const request = toolCall(
      {
        tool: 'generateText',
        input: {
          messages: [{ role: 'user', content: 'Wait forever.' }],
          tools: {},
        },
      },
      {
        model,
        parameters: {
          retryCount: 2,
          requestTimeoutSeconds: 0.01,
          usageMeter: new UsageMeter(),
        },
        toolProvider: {},
        workflowContext: {
          logger: {
            debug() {},
            error() {},
            info() {},
            warn() {},
          },
        },
      },
    )

    await expect(request).rejects.toMatchObject({
      name: MaxRetriesExceededError.name,
      attempts: 2,
      lastError: {
        name: ProviderTimeoutError.name,
        timeoutSeconds: 0.01,
      },
    })
    expect(model.attempts).toBe(2)
    expect(model.abortReasons).toHaveLength(2)
    for (const reason of model.abortReasons) {
      expect(reason).toBeInstanceOf(ProviderTimeoutError)
    }
  })
})
