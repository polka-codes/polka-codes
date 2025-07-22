import type { LanguageModelV2 } from '@ai-sdk/provider'
import type { ModelMessage, UserContent } from '@ai-sdk/provider-utils'
import { streamText } from 'ai'

import type { UsageMeter } from '../UsageMeter'
import type { ToolFormat } from '../config'
import {
  type FullToolInfo,
  type ToolResponse,
  type ToolResponseDelegate,
  type ToolResponseExit,
  type ToolResponseHandOver,
  type ToolResponseInterrupted,
  ToolResponseType,
} from '../tool'
import type { ToolProvider } from '../tools'
import type { AgentPolicy, AgentPolicyInstance } from './AgentPolicy'
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
  agent: AgentBase
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
  userMessage: UserContent
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
export interface TaskEventTool extends TaskEventBase {
  kind:
    | TaskEventKind.ToolUse
    | TaskEventKind.ToolReply
    | TaskEventKind.ToolInvalid
    | TaskEventKind.ToolError
    | TaskEventKind.ToolInterrupted
  tool: string
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
  | TaskEventTool
  | TaskEventToolPause
  | TaskEventToolHandOverDelegate
  | TaskEventUsageExceeded
  | TaskEventEndTask

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type SharedAgentOptions = {
  ai: LanguageModelV2
  os: string
  provider: ToolProvider
  interactive: boolean
  additionalTools?: FullToolInfo[]
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
}

export type AgentBaseConfig = {
  systemPrompt: string
  tools: FullToolInfo[]
  toolNamePrefix: string
  provider: ToolProvider
  interactive: boolean
  agents?: Readonly<AgentInfo[]>
  scripts?: Record<string, string | { command: string; description: string }>
  callback?: TaskEventCallback
  policies: AgentPolicy[]
  retryCount?: number
  requestTimeoutSeconds?: number
  toolFormat: ToolFormat
  parameters: Record<string, any>
  usageMeter: UsageMeter
}

export type AgentInfo = {
  name: string
  responsibilities: string[]
}

export type ToolResponseOrToolPause =
  | { type: 'response'; tool: string; response: UserContent }
  | { type: 'pause'; tool: string; object: any }

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
  protected readonly handlers: Record<string, FullToolInfo>
  readonly #policies: Readonly<AgentPolicyInstance[]>

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

    const handlers: Record<string, FullToolInfo> = {}
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
    this.#callback({ kind: TaskEventKind.StartTask, agent: this, systemPrompt: this.config.systemPrompt })

    return await this.#processLoop(prompt)
  }

  async step(prompt: UserContent) {
    if (this.#messages.length === 0) {
      this.#callback({ kind: TaskEventKind.StartTask, agent: this, systemPrompt: this.config.systemPrompt })
    }

    return await this.#request(prompt)
  }

  async handleStepResponse(response: AssistantMessageContent[]) {
    return this.#handleResponse(response)
  }

  async #processLoop(userMessage: UserContent): Promise<ExitReason> {
    let nextRequest: UserContent | string = userMessage
    while (true) {
      if (this.#aborted) {
        return { type: 'Aborted' }
      }
      if (this.config.usageMeter.isLimitExceeded().result) {
        this.#callback({ kind: TaskEventKind.UsageExceeded, agent: this })
        return { type: 'UsageExceeded' }
      }
      const response = await this.#request(nextRequest)
      if (this.#aborted) {
        return { type: 'Aborted' }
      }
      const resp = await this.#handleResponse(response)
      if (resp.type === 'exit') {
        this.#callback({ kind: TaskEventKind.EndTask, agent: this, exitReason: resp.reason })
        return resp.reason
      }
      nextRequest = resp.message
    }
  }

  async continueTask(userMessage: UserContent): Promise<ExitReason> {
    return await this.#processLoop(userMessage)
  }

  async #request(userMessage: UserContent | string) {
    if (!userMessage) {
      throw new Error('userMessage is missing')
    }

    await this.#callback({ kind: TaskEventKind.StartRequest, agent: this, userMessage })

    this.#messages.push({
      role: 'user',
      content: userMessage,
    })

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

    let currentAssistantMessage = ''

    const retryCount = this.config.retryCount ?? 5
    const requestTimeoutSeconds = this.config.requestTimeoutSeconds ?? 10

    for (let i = 0; i < retryCount; i++) {
      currentAssistantMessage = ''
      let timeout: ReturnType<typeof setTimeout> | undefined

      const resetTimeout = () => {
        if (timeout) {
          clearTimeout(timeout)
        }
        if (requestTimeoutSeconds > 0) {
          timeout = setTimeout(() => {
            console.debug(`No data received for ${requestTimeoutSeconds} seconds. Aborting request.`)
            this.abort()
          }, requestTimeoutSeconds * 1000)
        }
      }

      // TODO: this is racy. we should block concurrent requests
      this.#abortController = new AbortController()

      try {
        const stream = streamText({
          model: this.ai,
          messages,
          onChunk: async ({ chunk }) => {
            resetTimeout()
            switch (chunk.type) {
              case 'text':
                currentAssistantMessage += chunk.text
                await this.#callback({ kind: TaskEventKind.Text, agent: this, newText: chunk.text })
                break
              case 'reasoning':
                await this.#callback({ kind: TaskEventKind.Reasoning, agent: this, newText: chunk.text })
                break
            }
          },
          onFinish: this.config.usageMeter.onFinishHandler(this.ai),
          onAbort: async () => {
            console.log('aborted')
          },
          onError: async () => {
            console.log('error')
          },
          abortSignal: this.#abortController.signal,
        })

        await stream.consumeStream()
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          break
        }
        console.error('Error in stream:', error)
      } finally {
        if (timeout) {
          clearTimeout(timeout)
        }
      }

      if (currentAssistantMessage) {
        break
      }

      if (this.#aborted) {
        break
      }

      console.debug(`Retrying request ${i + 1} of ${retryCount}`)
    }

    if (!currentAssistantMessage) {
      if (this.#aborted) {
        return []
      }
      // something went wrong
      throw new Error('No assistant message received')
    }

    console.log('Assistant message:', currentAssistantMessage)

    this.#messages.push({
      role: 'assistant',
      content: currentAssistantMessage,
    })

    const ret = parseAssistantMessage(currentAssistantMessage, this.config.tools, this.config.toolNamePrefix)

    await this.#callback({ kind: TaskEventKind.EndRequest, agent: this, message: currentAssistantMessage })

    return ret
  }

  async #handleResponse(
    response: AssistantMessageContent[],
  ): Promise<{ type: 'reply'; message: UserContent } | { type: 'exit'; reason: ExitReason }> {
    const toolResponses: ToolResponseOrToolPause[] = []
    let hasPause = false

    outer: for (const content of response) {
      switch (content.type) {
        case 'text':
          // no need to handle text content
          break
        case 'tool_use': {
          await this.#callback({ kind: TaskEventKind.ToolUse, agent: this, tool: content.name })
          const toolResp = await this.#invokeTool(content.name, content.params)
          switch (toolResp.type) {
            case ToolResponseType.Reply: {
              // reply to the tool use
              await this.#callback({ kind: TaskEventKind.ToolReply, agent: this, tool: content.name })
              toolResponses.push({ type: 'response', tool: content.name, response: toolResp.message })
              break
            }
            case ToolResponseType.Exit:
              if (toolResponses.length > 0) {
                // agent is trying run too many tools in a single request
                // stop the tool execution
                break outer
              }
              // task completed
              return { type: 'exit', reason: toolResp }
            case ToolResponseType.Invalid: {
              // tell AI about the invalid arguments
              await this.#callback({ kind: TaskEventKind.ToolInvalid, agent: this, tool: content.name })
              toolResponses.push({ type: 'response', tool: content.name, response: toolResp.message })
              break outer
            }
            case ToolResponseType.Error: {
              // tell AI about the error
              await this.#callback({ kind: TaskEventKind.ToolError, agent: this, tool: content.name })
              toolResponses.push({ type: 'response', tool: content.name, response: toolResp.message })
              break outer
            }
            case ToolResponseType.Interrupted:
              // the execution is killed
              await this.#callback({ kind: TaskEventKind.ToolInterrupted, agent: this, tool: content.name })
              return { type: 'exit', reason: toolResp }
            case ToolResponseType.HandOver: {
              if (toolResponses.length > 0) {
                // agent is trying run too many tools in a single request
                // stop the tool execution
                break outer
              }
              // hand over the task to another agent
              await this.#callback({
                kind: TaskEventKind.ToolHandOver,
                agent: this,
                tool: content.name,
                agentName: toolResp.agentName,
                task: toolResp.task,
                context: toolResp.context,
                files: toolResp.files,
              })
              return { type: 'exit', reason: toolResp }
            }
            case ToolResponseType.Delegate: {
              if (toolResponses.length > 0) {
                // agent is trying run too many tools in a single request
                // stop the tool execution
                break outer
              }
              // delegate the task to another agent
              await this.#callback({
                kind: TaskEventKind.ToolDelegate,
                agent: this,
                tool: content.name,
                agentName: toolResp.agentName,
                task: toolResp.task,
                context: toolResp.context,
                files: toolResp.files,
              })
              return { type: 'exit', reason: toolResp }
            }
            case ToolResponseType.Pause: {
              // pause the execution
              await this.#callback({ kind: TaskEventKind.ToolPause, agent: this, tool: content.name, object: toolResp.object })
              toolResponses.push({ type: 'pause', tool: content.name, object: toolResp.object })
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
      // always require a tool usage
      return { type: 'reply', message: responsePrompts.requireUseTool }
    }

    const finalResp = toolResponses
      .filter((resp): resp is { type: 'response'; tool: string; response: UserContent } => resp.type === 'response')
      .flatMap(({ tool, response }) => responsePrompts.toolResults(tool, response))

    return { type: 'reply', message: finalResp }
  }

  async #invokeTool(name: string, args: Record<string, string>): Promise<ToolResponse> {
    try {
      const handler = this.handlers[name]?.handler
      if (!handler) {
        return {
          type: ToolResponseType.Error,
          message: responsePrompts.errorInvokeTool(name, 'Tool not found'),
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
        message: responsePrompts.errorInvokeTool(name, error),
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
