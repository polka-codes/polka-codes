import { describe, expect, test } from 'bun:test'
import { fileURLToPath } from 'node:url'
import type {
  LanguageModelV4,
  LanguageModelV4CallOptions,
  LanguageModelV4GenerateResult,
  LanguageModelV4StreamResult,
} from '@ai-sdk/provider'
import { APICallError } from '@ai-sdk/provider'
import { UsageMeter } from '@polka-codes/core'
import { AuthenticationError, MaxRetriesExceededError, MessageLimitExceededError, ProviderTimeoutError } from './errors'
import { prepareGenerateTextRequest, toolCall } from './tool-implementations'

const stdinEofFixturePath = fileURLToPath(new URL('../../cli-shared/src/test-fixtures/read-stdin-until-eof.mjs', import.meta.url))

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

class ApiErrorLanguageModel implements LanguageModelV4 {
  readonly specificationVersion = 'v4'
  readonly provider = 'api-error-test-provider'
  readonly modelId = 'api-error-test-model'
  readonly supportedUrls = {}
  attempts = 0

  async doGenerate(_options: LanguageModelV4CallOptions): Promise<LanguageModelV4GenerateResult> {
    throw new Error('ApiErrorLanguageModel only supports streaming')
  }

  async doStream(_options: LanguageModelV4CallOptions): Promise<LanguageModelV4StreamResult> {
    this.attempts++
    throw new APICallError({
      message: 'Unauthorized',
      url: 'https://example.com/v1/messages',
      requestBodyValues: {},
      statusCode: 401,
    })
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

describe('executeCommand', () => {
  test('closes stdin for shell and direct commands while preserving results', async () => {
    const model = new TimeoutLanguageModel()
    const context = {
      model,
      parameters: {
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
    }
    const expected = { exitCode: 7, stdout: 'out', stderr: 'err' }

    await expect(
      toolCall(
        {
          tool: 'executeCommand',
          input: {
            command: process.execPath,
            args: [stdinEofFixturePath],
          },
        },
        context,
      ),
    ).resolves.toEqual(expected)

    await expect(
      toolCall(
        {
          tool: 'executeCommand',
          input: {
            command: `${JSON.stringify(process.execPath)} ${JSON.stringify(stdinEofFixturePath)}`,
            shell: true,
          },
        },
        context,
      ),
    ).resolves.toEqual(expected)
  })
})

describe('generateText', () => {
  test('classifies AI SDK HTTP errors without retrying authentication failures', async () => {
    const model = new ApiErrorLanguageModel()
    const request = toolCall(
      {
        tool: 'generateText',
        input: {
          messages: [{ role: 'user', content: 'Fail authentication.' }],
          tools: {},
        },
      },
      {
        model,
        parameters: {
          retryCount: 3,
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

    await expect(request).rejects.toBeInstanceOf(AuthenticationError)
    expect(model.attempts).toBe(1)
  })

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
      attempts: 3,
      lastError: {
        name: ProviderTimeoutError.name,
        timeoutSeconds: 0.01,
      },
    })
    expect(model.attempts).toBe(3)
    expect(model.abortReasons).toHaveLength(3)
    for (const reason of model.abortReasons) {
      expect(reason).toBeInstanceOf(ProviderTimeoutError)
    }
  })

  test('makes one provider attempt when retries are disabled', async () => {
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
          retryCount: 0,
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
      attempts: 1,
    })
    expect(model.attempts).toBe(1)
  })

  test('does not start more provider requests than max-messages allows', async () => {
    const model = new TimeoutLanguageModel()
    const usageMeter = new UsageMeter({}, { maxMessages: 2 })
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
          retryCount: 5,
          requestTimeoutSeconds: 0.01,
          usageMeter,
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
      name: MessageLimitExceededError.name,
      message: expect.stringContaining('Message count: 2/2'),
    })
    expect(model.attempts).toBe(2)
    expect(usageMeter.usage.messageCount).toBe(2)
  })
})
