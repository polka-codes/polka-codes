import type { AiServiceBase, MessageParam } from '../AiService'
import {
  type FullToolInfo,
  type ToolResponse,
  type ToolResponseDelegate,
  type ToolResponseExit,
  type ToolResponseHandOver,
  type ToolResponseInterrupted,
  ToolResponseType,
} from '../tool'
import type { ToolProvider } from './../tools'
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
  userMessage: string
}

/**
 * Event for request end
 */
export interface TaskEventEndRequest extends TaskEventBase {
  kind: TaskEventKind.EndRequest
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
 * Event for task completion states
 */
export interface TaskEventCompletion extends TaskEventBase {
  kind: TaskEventKind.UsageExceeded | TaskEventKind.EndTask
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
  | TaskEventToolHandOverDelegate
  | TaskEventCompletion

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type SharedAgentOptions = {
  ai: AiServiceBase
  os: string
  provider: ToolProvider
  interactive: boolean
  additionalTools?: FullToolInfo[]
  customInstructions?: string[]
  scripts?: Record<string, string | { command: string; description: string }>
  agents?: AgentInfo[]
}

export type AgentBaseConfig = {
  systemPrompt: string
  tools: FullToolInfo[]
  toolNamePrefix: string
  provider: ToolProvider
  interactive: boolean
  agents?: AgentInfo[]
  scripts?: Record<string, string | { command: string; description: string }>
  callback?: TaskEventCallback
}

export type AgentInfo = {
  name: string
  responsibilities: string[]
}

export type ExitReason =
  | { type: 'UsageExceeded' }
  | { type: 'WaitForUserInput' }
  | ToolResponseExit
  | ToolResponseInterrupted
  | ToolResponseHandOver
  | ToolResponseDelegate

export abstract class AgentBase {
  protected readonly ai: AiServiceBase
  protected readonly config: Readonly<AgentBaseConfig>
  protected readonly handlers: Record<string, FullToolInfo>
  protected readonly messages: MessageParam[] = []

  constructor(name: string, ai: AiServiceBase, config: AgentBaseConfig) {
    this.ai = ai

    // If agents are provided, add them to the system prompt
    if (config.agents && Object.keys(config.agents).length > 0) {
      const agents = agentsPrompt(config.agents, name)
      config.systemPrompt += `\n${agents}`
    }

    this.config = config

    const handlers: Record<string, FullToolInfo> = {}
    for (const tool of config.tools) {
      handlers[tool.name] = tool
    }
    this.handlers = handlers
  }

  async #callback(event: TaskEvent) {
    await this.config.callback?.(event)
  }

  async startTask({ task, context }: { task: string; context?: string }): Promise<ExitReason> {
    let text = `<task>${task}</task>`

    if (context) {
      text += `\n<context>${context}</context>`
    }

    this.#callback({ kind: TaskEventKind.StartTask, agent: this, systemPrompt: this.config.systemPrompt })

    return await this.#processLoop(text)
  }

  async #processLoop(userMessage: string): Promise<ExitReason> {
    let nextRequest: string | undefined = userMessage
    while (nextRequest) {
      if (this.ai.usageMeter.isLimitExceeded().result) {
        this.#callback({ kind: TaskEventKind.UsageExceeded, agent: this })
        return { type: 'UsageExceeded' }
      }
      const response = await this.#request(nextRequest)
      const [newMessage, exitReason] = await this.#handleResponse(response)
      if (exitReason) {
        this.#callback({ kind: TaskEventKind.EndTask, agent: this })
        return exitReason
      }
      nextRequest = newMessage
    }

    this.#callback({ kind: TaskEventKind.EndTask, agent: this })
    return { type: ToolResponseType.Exit, message: 'Task completed successfully' }
  }

  async continueTask(userMessage: string): Promise<ExitReason> {
    return await this.#processLoop(userMessage)
  }

  async #request(userMessage: string) {
    await this.#callback({ kind: TaskEventKind.StartRequest, agent: this, userMessage })

    this.messages.push({
      role: 'user',
      content: userMessage,
    })

    // TODO: use a truncated messages if needed to avoid exceeding the token limit
    const stream = this.ai.send(this.config.systemPrompt, this.messages)
    let currentAssistantMessage = ''

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'usage':
          await this.#callback({ kind: TaskEventKind.Usage, agent: this })
          break
        case 'text':
          currentAssistantMessage += chunk.text
          await this.#callback({ kind: TaskEventKind.Text, agent: this, newText: chunk.text })
          break
        case 'reasoning':
          await this.#callback({ kind: TaskEventKind.Reasoning, agent: this, newText: chunk.text })
          break
      }
    }

    // TODO: error handling

    if (!currentAssistantMessage) {
      throw new Error('No assistant message received')
    }

    this.messages.push({
      role: 'assistant',
      content: currentAssistantMessage,
    })

    const ret = parseAssistantMessage(currentAssistantMessage, this.config.tools, this.config.toolNamePrefix)

    await this.#callback({ kind: TaskEventKind.EndRequest, agent: this })

    return ret
  }

  async #handleResponse(response: AssistantMessageContent[]): Promise<[string | undefined, ExitReason | undefined]> {
    const toolReponses: { tool: string; response: string }[] = []
    outer: for (const content of response) {
      switch (content.type) {
        case 'text':
          // no need to handle text content
          break
        case 'tool_use': {
          await this.#callback({ kind: TaskEventKind.ToolUse, agent: this, tool: content.name })
          const toolResp = await this.#invokeTool(content.name, content.params)
          switch (toolResp.type) {
            case ToolResponseType.Reply:
              // reply to the tool use
              await this.#callback({ kind: TaskEventKind.ToolReply, agent: this, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break
            case ToolResponseType.Exit:
              // task completed
              return [undefined, toolResp]
            case ToolResponseType.Invalid:
              // tell AI about the invalid arguments
              await this.#callback({ kind: TaskEventKind.ToolInvalid, agent: this, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break outer
            case ToolResponseType.Error:
              // tell AI about the error
              await this.#callback({ kind: TaskEventKind.ToolError, agent: this, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break outer
            case ToolResponseType.Interrupted:
              // the execution is killed
              await this.#callback({ kind: TaskEventKind.ToolInterrupted, agent: this, tool: content.name })
              return [undefined, toolResp]
            case ToolResponseType.HandOver:
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
              return [undefined, toolResp]
            case ToolResponseType.Delegate:
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
              return [undefined, toolResp]
          }
          break
        }
      }
    }

    if (toolReponses.length === 0 && !this.config.interactive) {
      // always require a tool usage in non-interactive mode
      return [responsePrompts.requireUseTool, undefined]
    }

    const finalResp = toolReponses.map(({ tool, response }) => responsePrompts.toolResults(tool, response)).join('\n\n')
    return [finalResp, undefined]
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
      const resp = await this.onBeforeInvokeTool(name, args)
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
    return this.ai.model
  }

  get usage() {
    return this.ai.usageMeter.usage
  }
}
