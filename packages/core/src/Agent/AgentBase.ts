import type { LanguageModelV2, LanguageModelV2ToolResultOutput } from '@ai-sdk/provider'
import type {
  AssistantModelMessage,
  ModelMessage,
  ToolModelMessage,
  ToolResultPart,
  UserContent,
  UserModelMessage,
} from '@ai-sdk/provider-utils'
import { jsonSchema, type LanguageModelUsage, streamText, type ToolSet } from 'ai'
import { camelCase } from 'lodash-es'
import { toJSONSchema } from 'zod'
import type { ToolFormat } from '../config'
import {
  type FullToolInfoV2,
  type ToolResponse,
  type ToolResponseDelegate,
  type ToolResponseError,
  type ToolResponseExit,
  type ToolResponseHandOver,
  type ToolResponseInterrupted,
  type ToolResponseResult,
  type ToolResponseResultMedia,
  ToolResponseType,
} from '../tool'
import { toToolInfoV1 } from '../tool-v1-compat'
import type { ToolProvider } from '../tools'
import type { UsageMeter } from '../UsageMeter'
import type { AgentPolicy, AgentPolicyInstance } from './AgentPolicy'
import { computeRateLimitBackoffSeconds } from './backoff'
import { type AssistantMessageContent, parseAssistantMessage } from './parseAssistantMessage'
import { agentsPrompt, responsePrompts } from './prompts'

/**
 * Enum representing different kinds of task events
 */
export enum TaskEventKind {
  StartTask = 'StartTask',
  StartRequest = 'StartRequest',
  EndRequest = 'EndRequest',
  Usage = 'Usage',
  Text = 'Text',
  Reasoning = 'Reasoning',
  ToolUse = 'ToolUse',
  ToolReply = 'ToolReply',
  ToolInvalid = 'ToolInvalid',
  ToolError = 'ToolError',
  ToolInterrupted = 'ToolInterrupted',
  ToolHandOver = 'ToolHandOver',
  ToolDelegate = 'ToolDelegate',
  ToolPause = 'ToolPause',
  UsageExceeded = 'UsageExceeded',
  EndTask = 'EndTask',
}

/**
 * Base interface for all task events
 */
export interface TaskEventBase {
  kind: TaskEventKind
}

/**
 * Event for task start
 */
export interface TaskEventStartTask extends TaskEventBase {
  kind: TaskEventKind.StartTask
  systemPrompt: string
}

/**
 * Event for request start
 */
export interface TaskEventStartRequest extends TaskEventBase {
  kind: TaskEventKind.StartRequest
  userMessage: ModelMessage[]
}

/**
 * Event for request end
 */
export interface TaskEventEndRequest extends TaskEventBase {
  kind: TaskEventKind.EndRequest
  message: string
}

/**
 * Event for API usage updates
 */
export interface TaskEventUsage extends TaskEventBase {
  kind: TaskEventKind.Usage
  usage: LanguageModelUsage
}

/**
 * Event for text/reasoning updates
 */
export interface TaskEventText extends TaskEventBase {
  kind: TaskEventKind.Text | TaskEventKind.Reasoning
  newText: string
}

/**
 * Event for tool-related updates
 */
export interface TaskEventToolUse extends TaskEventBase {
  kind: TaskEventKind.ToolUse
  tool: string
  params: Record<string, any>
}

export interface TaskEventToolResult extends TaskEventBase {
  kind: TaskEventKind.ToolReply | TaskEventKind.ToolInvalid | TaskEventKind.ToolInterrupted
  tool: string
  content: ToolResponseResult
}

export interface TaskEventToolError extends TaskEventBase {
  kind: TaskEventKind.ToolError
  tool: string
  error: ToolResponseError | ToolResponseResult
}

export interface TaskEventToolPause extends TaskEventBase {
  kind: TaskEventKind.ToolPause
  tool: string
  object: any
}

/**
 * Event for tool handover
 */
export interface TaskEventToolHandOverDelegate extends TaskEventBase {
  kind: TaskEventKind.ToolHandOver | TaskEventKind.ToolDelegate
  tool: string
  agentName: string
  task: string
  context?: string
  files?: string[]
}

/**
 * Event for task usage exceeded
 */
export interface TaskEventUsageExceeded extends TaskEventBase {
  kind: TaskEventKind.UsageExceeded
}

/**
 * Event for task end
 */
export interface TaskEventEndTask extends TaskEventBase {
  kind: TaskEventKind.EndTask
  exitReason: ExitReason
}

/**
 * Union type of all possible task events
 */
export type TaskEvent =
  | TaskEventStartTask
  | TaskEventStartRequest
  | TaskEventEndRequest
  | TaskEventUsage
  | TaskEventText
  | TaskEventToolUse
  | TaskEventToolResult
  | TaskEventToolError
  | TaskEventToolPause
  | TaskEventToolHandOverDelegate
  | TaskEventUsageExceeded
  | TaskEventEndTask

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type SharedAgentOptions = {
  ai: LanguageModelV2
  os: string
  provider: ToolProvider
  additionalTools?: FullToolInfoV2[]
  customInstructions?: string[]
  scripts?: Record<string, string | { command: string; description: string }>
  agents?: Readonly<AgentInfo[]>
  callback?: TaskEventCallback
  policies: AgentPolicy[]
  retryCount?: number
  requestTimeoutSeconds?: number
  toolFormat: ToolFormat
  parameters?: Record<string, any>
  usageMeter?: UsageMeter
  requireToolUse?: boolean
}

export type AgentBaseConfig = {
  systemPrompt: string
  tools: FullToolInfoV2[]
  toolNamePrefix: string
  provider: ToolProvider
  agents?: Readonly<AgentInfo[]>
  scripts?: Record<string, string | { command: string; description: string }>
  callback?: TaskEventCallback
  policies: AgentPolicy[]
  retryCount?: number
  requestTimeoutSeconds?: number
  toolFormat: ToolFormat
  parameters: Record<string, any>
  usageMeter: UsageMeter
  requireToolUse: boolean
}

export type AgentInfo = {
  name: string
  responsibilities: string[]
}

export type ToolResponseOrToolPause =
  | { type: 'response'; tool: string; response: LanguageModelV2ToolResultOutput; id?: string }
  | { type: 'pause'; tool: string; object: any; id?: string }

export type ExitReason =
  | { type: 'UsageExceeded' }
  | { type: 'WaitForUserInput' }
  | { type: 'Aborted' }
  | ToolResponseExit
  | ToolResponseInterrupted
  | ToolResponseHandOver
  | ToolResponseDelegate
  | {
      type: 'Pause'
      responses: ToolResponseOrToolPause[]
    }

export abstract class AgentBase {
  readonly ai: LanguageModelV2
  protected readonly config: Readonly<AgentBaseConfig>
  protected readonly handlers: Record<string, FullToolInfoV2>
  readonly #policies: Readonly<AgentPolicyInstance[]>
  readonly #toolSet: Readonly<ToolSet>

  #messages: ModelMessage[] = []
  #aborted = false
  #abortController: AbortController | undefined

  constructor(name: string, ai: LanguageModelV2, config: AgentBaseConfig) {
    this.ai = ai

    // If agents are provided, add them to the system prompt
    if (config.agents && config.agents.length > 0) {
      const agents = agentsPrompt(config.agents, name)
      config.systemPrompt += `\n${agents}`
    }

    const handlers: Record<string, FullToolInfoV2> = {}
    for (const tool of config.tools) {
      handlers[tool.name] = tool
    }

    const policies: AgentPolicyInstance[] = []

    for (const policy of config.policies) {
      const instance = policy(handlers, config.parameters)
      if (instance) {
        policies.push(instance)

        if (instance.prompt) {
          config.systemPrompt += `\n${instance.prompt}`
        }
        if (instance.tools) {
          for (const tool of instance.tools) {
            handlers[tool.name] = tool
          }
        }
      }
    }

    this.handlers = handlers

    this.config = config
    this.#policies = policies

    this.#messages.push({
      role: 'system',
      content: this.config.systemPrompt,
    })

    if (this.config.toolFormat === 'native') {
      const tools: ToolSet = {}
      for (const tool of Object.values(this.handlers)) {
        const toolName = camelCase(tool.name)
        tools[toolName] = {
          description: tool.description,
          inputSchema: jsonSchema(toJSONSchema(tool.parameters)),
        }
        this.handlers[toolName] = tool
      }
      this.#toolSet = tools
    } else {
      this.#toolSet = {}
    }
  }

  abort() {
    this.#aborted = true
    if (this.#abortController) {
      this.#abortController.abort()
    }
  }

  get parameters(): Readonly<Record<string, any>> {
    return this.config.parameters
  }

  get messages(): Readonly<ModelMessage[]> {
    return this.#messages
  }

  setMessages(messages: Readonly<ModelMessage[]>) {
    this.#messages = [...messages]
  }

  async #callback(event: TaskEvent) {
    await this.config.callback?.(event)
  }

  async start(prompt: UserContent): Promise<ExitReason> {
    this.#callback({ kind: TaskEventKind.StartTask, systemPrompt: this.config.systemPrompt })

    return await this.#processLoop(prompt)
  }

  async step(message: (UserModelMessage | ToolModelMessage)[]) {
    if (this.#messages.length === 0) {
      this.#callback({ kind: TaskEventKind.StartTask, systemPrompt: this.config.systemPrompt })
    }

    return await this.#request(message)
  }

  async handleStepResponse(response: AssistantMessageContent[]) {
    return this.#handleResponse(response)
  }

  async #processLoop(userMessage: UserContent): Promise<ExitReason> {
    let nextRequest: (UserModelMessage | ToolModelMessage)[] = [
      {
        role: 'user',
        content: userMessage,
      },
    ]
    while (true) {
      if (this.#aborted) {
        return { type: 'Aborted' }
      }
      if (this.config.usageMeter.isLimitExceeded().result) {
        this.#callback({ kind: TaskEventKind.UsageExceeded })
        return { type: 'UsageExceeded' }
      }
      const response = await this.#request(nextRequest)
      if (this.#aborted) {
        return { type: 'Aborted' }
      }
      const resp = await this.#handleResponse(response)
      if (resp.type === 'exit') {
        this.#callback({ kind: TaskEventKind.EndTask, exitReason: resp.reason })
        return resp.reason
      }
      nextRequest = resp.message
    }
  }

  async continueTask(userMessage: UserContent): Promise<ExitReason> {
    return await this.#processLoop(userMessage)
  }

  async #request(userMessage: (UserModelMessage | ToolModelMessage)[]): Promise<AssistantMessageContent[]> {
    if (!userMessage) {
      throw new Error('userMessage is missing')
    }

    await this.#callback({ kind: TaskEventKind.StartRequest, userMessage })

    this.#messages.push(...userMessage)

    // Call onBeforeRequest hooks from policies
    for (const instance of this.#policies) {
      if (instance.onBeforeRequest) {
        await instance.onBeforeRequest(this)
      }
    }

    let messages = this.#messages
    for (const instance of this.#policies) {
      if (instance.prepareMessages) {
        messages = await instance.prepareMessages(this, messages)
      }
    }

    const retryCount = this.config.retryCount ?? 5
    const requestTimeoutSeconds = this.config.requestTimeoutSeconds ?? 90

    let respMessages: (AssistantModelMessage | ToolModelMessage)[] = []
    let rateLimitErrorCount = 0

    for (let i = 0; i < retryCount; i++) {
      // Check for user abort before each retry attempt
      if (this.#aborted) {
        break
      }

      respMessages = []
      let timeout: ReturnType<typeof setTimeout> | undefined
      let requestAbortController: AbortController | undefined

      // Create a fresh AbortController for each retry attempt
      requestAbortController = new AbortController()
      this.#abortController = requestAbortController

      const resetTimeout = () => {
        if (timeout) {
          clearTimeout(timeout)
        }
        if (requestTimeoutSeconds > 0 && requestAbortController) {
          timeout = setTimeout(() => {
            console.error(
              `\nRequest timeout after ${requestTimeoutSeconds} seconds. Canceling current request attempt ${i + 1}/${retryCount}.`,
            )
            // Only abort the current request, not the entire agent
            requestAbortController?.abort()
          }, requestTimeoutSeconds * 1000)
        }
      }

      try {
        resetTimeout()

        const usageMeterOnFinishHandler = this.config.usageMeter.onFinishHandler(this.ai)

        const streamTextOptions: Parameters<typeof streamText>[0] = {
          model: this.ai,
          temperature: 0,
          messages,
          providerOptions: this.config.parameters?.providerOptions,
          onChunk: async ({ chunk }) => {
            resetTimeout()
            switch (chunk.type) {
              case 'text-delta':
                await this.#callback({ kind: TaskEventKind.Text, newText: chunk.text })
                break
              case 'reasoning-delta':
                await this.#callback({ kind: TaskEventKind.Reasoning, newText: chunk.text })
                break
              case 'tool-call':
                break
            }
          },
          onFinish: (evt) => {
            usageMeterOnFinishHandler(evt)
            this.#callback({ kind: TaskEventKind.Usage, usage: evt.totalUsage })
          },
          onError: async (error) => {
            console.error('Error in stream:', error)
          },
          abortSignal: requestAbortController.signal,
        }

        if (this.config.toolFormat === 'native') {
          streamTextOptions.tools = this.#toolSet
        }

        const stream = streamText(streamTextOptions)

        await stream.consumeStream({
          onError: (error) => {
            console.error('Error in stream:', error)
          },
        })

        const resp = await stream.response
        respMessages = resp.messages
        rateLimitErrorCount = 0

        // Clear timeout on successful completion
        if (timeout) {
          clearTimeout(timeout)
          timeout = undefined
        }
      } catch (error: any) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Check if this was a user abort or just a request timeout
          if (this.#aborted) {
            // User aborted the entire agent - break out of retry loop
            break
          }
          // Otherwise, this was just a request timeout - continue to next retry
          console.error(`Request attempt ${i + 1} timed out, will retry`)
        } else if (
          error?.error?.error?.code === 'rate_limit_exceeded' ||
          error?.error?.code === 'rate_limit_exceeded' ||
          error?.code === 'rate_limit_exceeded' ||
          error?.status === 429 ||
          error?.error?.status === 429
        ) {
          rateLimitErrorCount++
          const waitSeconds = computeRateLimitBackoffSeconds(rateLimitErrorCount)
          console.error(`Rate limit exceeded. Waiting ${waitSeconds}s before retrying...`)
          if (timeout) {
            clearTimeout(timeout)
            timeout = undefined
          }
          await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
          console.error('Retrying request...')
        } else {
          rateLimitErrorCount = 0
          console.error('Error in stream:', error)
        }
      } finally {
        if (timeout) {
          clearTimeout(timeout)
        }
      }

      if (this.config.toolFormat === 'native') {
        if (
          respMessages.some((m) => {
            if (m.role === 'tool') {
              return true
            }
            if (typeof m.content === 'string') {
              return true
            }
            return m.content.some((part) => part.type === 'tool-call' || part.type === 'tool-result' || part.type === 'text')
          })
        ) {
          break
        }
      } else {
        if (respMessages.length > 0) {
          break
        }
      }

      // Only break on user abort, not on request timeout
      if (this.#aborted) {
        break
      }

      if (i < retryCount - 1) {
        console.error(`\nRetrying request ${i + 2} of ${retryCount}`)
      }
    }

    if (respMessages.length === 0) {
      if (this.#aborted) {
        return []
      }
      // All retry attempts failed
      throw new Error('No assistant message received after all retry attempts')
    }

    this.#messages.push(...respMessages)

    if (this.config.toolFormat === 'native') {
      // Notify listeners that the request finished (was previously skipped for native format)
      const assistantText = respMessages
        .map((msg) => {
          if (typeof msg.content === 'string') {
            return msg.content
          }
          return msg.content.map((part) => (part.type === 'text' || part.type === 'reasoning' ? part.text : '')).join('')
        })
        .join('\n')
      await this.#callback({ kind: TaskEventKind.EndRequest, message: assistantText })

      return respMessages.flatMap((msg): AssistantMessageContent[] => {
        if (msg.role === 'assistant') {
          const content = msg.content
          if (typeof content === 'string') {
            return [{ type: 'text', content }]
          }
          return content.flatMap((part): AssistantMessageContent[] => {
            if (part.type === 'text' || part.type === 'reasoning') {
              return [{ type: 'text', content: part.text }]
            }
            if (part.type === 'tool-call') {
              return [{ type: 'tool_use', id: part.toolCallId, name: part.toolName, params: part.input as any }]
            }
            return []
          })
        }
        return []
      })
    }

    const currentAssistantMessage = respMessages
      .map((msg) => {
        if (typeof msg.content === 'string') {
          return msg.content
        }
        return msg.content.map((part) => {
          if (part.type === 'text') {
            return part.text
          }
          return ''
        })
      })
      .join('\n')

    const ret = parseAssistantMessage(currentAssistantMessage, this.config.tools.map(toToolInfoV1), this.config.toolNamePrefix)

    await this.#callback({ kind: TaskEventKind.EndRequest, message: currentAssistantMessage })

    return ret
  }

  async #handleResponse(
    response: AssistantMessageContent[],
  ): Promise<{ type: 'reply'; message: (UserModelMessage | ToolModelMessage)[] } | { type: 'exit'; reason: ExitReason }> {
    const toolResponses: ToolResponseOrToolPause[] = []

    // gemini and gpt-5 don't support non JSON tool response
    // so we need to remove them from tool response and have a user message to provide the files
    const medias: ToolResponseResultMedia[] = []

    const processResponse = (resp: ToolResponseResult): LanguageModelV2ToolResultOutput => {
      if (resp.type === 'content') {
        return {
          type: 'content',
          value: resp.value.map((part) => {
            if (part.type === 'media') {
              medias.push(part)
              return {
                type: 'text',
                text: `<media url="${part.url}" media-type="${part.mediaType}" />`,
              } as const
            }
            return part
          }),
        }
      }
      return resp
    }

    let hasPause = false
    const toolUseContents = response.filter((c) => c.type === 'tool_use')
    outer: for (const content of response) {
      switch (content.type) {
        case 'text':
          break
        case 'tool_use': {
          await this.#callback({ kind: TaskEventKind.ToolUse, tool: content.name, params: content.params })
          const toolResp = await this.#invokeTool(content.name, content.params)
          switch (toolResp.type) {
            case ToolResponseType.Reply: {
              // reply to the tool use
              await this.#callback({ kind: TaskEventKind.ToolReply, tool: content.name, content: toolResp.message })
              toolResponses.push({ type: 'response', tool: content.name, response: processResponse(toolResp.message), id: content.id })
              break
            }
            case ToolResponseType.Exit:
            case ToolResponseType.HandOver:
            case ToolResponseType.Delegate: {
              if (this.config.toolFormat === 'native' && toolUseContents.length > 1) {
                const message: ToolResponseError = {
                  type: ToolResponseType.Error,
                  message: {
                    type: 'error-text',
                    value: `Error: The tool '${content.name}' must be called alone, but it was called with other tools.`,
                  },
                  canRetry: false,
                }
                await this.#callback({ kind: TaskEventKind.ToolError, tool: content.name, error: message })
                toolResponses.push({
                  type: 'response',
                  tool: content.name,
                  response: processResponse(message.message),
                  id: content.id,
                })
                break
              }

              if (toolResponses.length > 0) {
                // agent is trying run too many tools in a single request
                // stop the tool execution
                break outer
              }

              if (toolResp.type === ToolResponseType.Exit) {
                // task completed
                return { type: 'exit', reason: toolResp }
              }

              if (toolResp.type === ToolResponseType.HandOver) {
                // hand over the task to another agent
                await this.#callback({
                  kind: TaskEventKind.ToolHandOver,
                  tool: content.name,
                  agentName: toolResp.agentName,
                  task: toolResp.task,
                  context: toolResp.context,
                  files: toolResp.files,
                })
                return { type: 'exit', reason: toolResp }
              }

              if (toolResp.type === ToolResponseType.Delegate) {
                // delegate the task to another agent
                await this.#callback({
                  kind: TaskEventKind.ToolDelegate,
                  tool: content.name,
                  agentName: toolResp.agentName,
                  task: toolResp.task,
                  context: toolResp.context,
                  files: toolResp.files,
                })
                return { type: 'exit', reason: toolResp }
              }
              break
            }
            case ToolResponseType.Invalid: {
              // tell AI about the invalid arguments
              await this.#callback({ kind: TaskEventKind.ToolInvalid, tool: content.name, content: toolResp.message })
              toolResponses.push({ type: 'response', tool: content.name, response: processResponse(toolResp.message), id: content.id })
              if (this.config.toolFormat !== 'native') {
                break outer
              }
              break
            }
            case ToolResponseType.Error: {
              // tell AI about the error
              await this.#callback({ kind: TaskEventKind.ToolError, tool: content.name, error: toolResp.message })
              toolResponses.push({ type: 'response', tool: content.name, response: processResponse(toolResp.message), id: content.id })
              if (this.config.toolFormat !== 'native') {
                break outer
              }
              break
            }
            case ToolResponseType.Pause: {
              // pause the execution
              await this.#callback({ kind: TaskEventKind.ToolPause, tool: content.name, object: toolResp.object })
              toolResponses.push({ type: 'pause', tool: content.name, object: toolResp.object, id: content.id })
              hasPause = true
            }
          }
          break
        }
      }
    }

    if (hasPause) {
      return { type: 'exit', reason: { type: 'Pause', responses: toolResponses } }
    }

    if (toolResponses.length === 0) {
      if (this.config.requireToolUse) {
        return {
          type: 'reply',
          message: [
            {
              role: 'user',
              content: responsePrompts.requireUseToolNative,
            },
          ],
        }
      }
      return {
        type: 'exit',
        reason: {
          type: ToolResponseType.Exit,
          message: response
            .filter((c) => c.type === 'text')
            .map((c) => c.content)
            .join(''),
        },
      }
    }

    const mediaUserMessage: UserModelMessage[] =
      medias.length > 0
        ? [
            {
              role: 'user',
              content: medias.map((m) => {
                if (m.mediaType.startsWith('image/')) {
                  return {
                    type: 'image',
                    image: m.base64Data,
                    mediaType: m.mediaType,
                  }
                }
                return {
                  type: 'file',
                  data: m.base64Data,
                  mediaType: m.mediaType,
                  filename: m.url.split('/').pop(),
                }
              }),
            },
          ]
        : []

    if (this.config.toolFormat === 'native') {
      const toolResults = toolResponses
        .filter((resp) => resp.type === 'response')
        .map(
          (resp) =>
            ({
              type: 'tool-result',
              toolCallId: resp.id as string,
              toolName: resp.tool,
              output: resp.response,
            }) satisfies ToolResultPart,
        )
      return {
        type: 'reply',
        message: [
          {
            role: 'tool',
            content: toolResults,
          },
          ...mediaUserMessage,
        ],
      }
    }

    if (toolResponses.length === 0) {
      if (this.config.requireToolUse) {
        return {
          type: 'reply',
          message: [
            {
              role: 'user',
              content: responsePrompts.requireUseTool,
            },
          ],
        }
      }
      return {
        type: 'exit',
        reason: {
          type: ToolResponseType.Exit,
          message: response
            .filter((c) => c.type === 'text')
            .map((c) => c.content)
            .join(''),
        },
      }
    }

    const finalResp = toolResponses
      .filter((resp) => resp.type === 'response')
      .flatMap(({ tool, response }) => responsePrompts.toolResults(tool, response))

    return {
      type: 'reply',
      message: [
        {
          role: 'user',
          content: finalResp,
        },
        ...mediaUserMessage,
      ],
    }
  }

  async #invokeTool(name: string, args: Record<string, string>): Promise<ToolResponse> {
    try {
      const handler = this.handlers[name]?.handler
      if (!handler) {
        return {
          type: ToolResponseType.Error,
          message: {
            type: 'error-text',
            value: responsePrompts.errorInvokeTool(name, 'Tool not found'),
          },
          canRetry: false,
        }
      }
      for (const instance of this.#policies) {
        if (instance.onBeforeInvokeTool) {
          const resp = await instance.onBeforeInvokeTool(name, args)
          if (resp) {
            return resp
          }
        }
      }
      const resp = await this.onBeforeInvokeTool(this.handlers[name].name, args)
      if (resp) {
        return resp
      }
      return await handler(this.config.provider, args)
    } catch (error) {
      return {
        type: ToolResponseType.Error,
        message: {
          type: 'error-text',
          value: responsePrompts.errorInvokeTool(name, error),
        },
        canRetry: false,
      }
    }
  }

  protected abstract onBeforeInvokeTool(name: string, args: Record<string, string>): Promise<ToolResponse | undefined>

  get model() {
    return `${this.ai.provider}:${this.ai.modelId}`
  }

  get usage() {
    return this.config.usageMeter.usage
  }
}
