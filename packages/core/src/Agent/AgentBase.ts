import type { AiServiceBase, ApiUsage, MessageParam } from '../AiService'
import {
  type FullToolInfo,
  type ToolResponse,
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
  MaxIterationsReached = 'MaxIterationsReached',
  EndTask = 'EndTask',
}

/**
 * Base interface for all task events
 */
export interface TaskEventBase {
  kind: TaskEventKind
  info: TaskInfo
}

/**
 * Event for request start/end
 */
export interface TaskEventRequest extends TaskEventBase {
  kind: TaskEventKind.StartRequest | TaskEventKind.EndRequest
  userMessage?: string
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
export interface TaskEventToolHandOver extends TaskEventBase {
  kind: TaskEventKind.ToolHandOver
  tool: string
  agentName: string
  task: string
}

/**
 * Event for task completion states
 */
export interface TaskEventCompletion extends TaskEventBase {
  kind: TaskEventKind.MaxIterationsReached | TaskEventKind.EndTask
}

/**
 * Union type of all possible task events
 */
export type TaskEvent = TaskEventRequest | TaskEventUsage | TaskEventText | TaskEventTool | TaskEventToolHandOver | TaskEventCompletion

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type TaskInfo = {
  options: {
    maxIterations: number
  }
  messages: MessageParam[]
} & ApiUsage

export type AgentBaseConfig = {
  systemPrompt: string
  tools: FullToolInfo[]
  toolNamePrefix: string
  provider: ToolProvider
  interactive: boolean
  agents?: AgentInfo[]
}

export type AgentInfo = {
  name: string
  responsibilities: string[]
}

export type ExitReason = 'MaxIterations' | 'WaitForUserInput' | ToolResponseExit | ToolResponseInterrupted | ToolResponseHandOver

export abstract class AgentBase {
  protected readonly ai: AiServiceBase
  protected readonly config: Readonly<AgentBaseConfig>
  protected readonly handlers: Record<string, FullToolInfo>

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

  async startTask({
    task,
    context,
    maxIterations = 50,
    callback = () => {},
  }: { task: string; context?: string; maxIterations?: number; callback?: TaskEventCallback }): Promise<[ExitReason, TaskInfo]> {
    const taskInfo: TaskInfo = {
      options: {
        maxIterations,
      },
      messages: [],
      inputTokens: 0,
      outputTokens: 0,
      cacheWriteTokens: 0,
      cacheReadTokens: 0,
      totalCost: 0,
    }

    let text = `<task>${task}</task>`

    if (context) {
      text += `\n<context>${context}</context>`
    }

    return await this.#processLoop(text, taskInfo, callback)
  }

  async #processLoop(userMessage: string, taskInfo: TaskInfo, callback: TaskEventCallback): Promise<[ExitReason, TaskInfo]> {
    let nextRequest: string | undefined = userMessage
    while (nextRequest) {
      if (taskInfo.messages.length > taskInfo.options.maxIterations * 2) {
        callback({ kind: TaskEventKind.MaxIterationsReached, info: taskInfo })
        return ['MaxIterations', taskInfo]
      }
      const response = await this.#request(taskInfo, nextRequest, callback)
      const [newMessage, exitReason] = await this.#handleResponse(taskInfo, response, callback)
      if (exitReason) {
        callback({ kind: TaskEventKind.EndTask, info: taskInfo })
        return [exitReason, taskInfo]
      }
      nextRequest = newMessage
    }

    callback({ kind: TaskEventKind.EndTask, info: taskInfo })
    return [{ type: ToolResponseType.Exit, message: 'Task completed successfully' }, taskInfo]
  }

  async continueTask(userMessage: string, taskInfo: TaskInfo, callback: TaskEventCallback = () => {}): Promise<[ExitReason, TaskInfo]> {
    return await this.#processLoop(userMessage, taskInfo, callback)
  }

  async #request(info: TaskInfo, userMessage: string, callback: TaskEventCallback) {
    await callback({ kind: TaskEventKind.StartRequest, info, userMessage })

    info.messages.push({
      role: 'user',
      content: userMessage,
    })

    // TODO: use a truncated messages if needed to avoid exceeding the token limit
    const stream = this.ai.send(this.config.systemPrompt, info.messages)
    let currentAssistantMessage = ''

    for await (const chunk of stream) {
      switch (chunk.type) {
        case 'usage':
          info.inputTokens = chunk.inputTokens ?? 0
          info.outputTokens = chunk.outputTokens ?? 0
          info.cacheWriteTokens = chunk.cacheWriteTokens ?? 0
          info.cacheReadTokens = chunk.cacheReadTokens ?? 0
          info.totalCost = chunk.totalCost
          await callback({ kind: TaskEventKind.Usage, info })
          break
        case 'text':
          currentAssistantMessage += chunk.text
          await callback({ kind: TaskEventKind.Text, info, newText: chunk.text })
          break
        case 'reasoning':
          await callback({ kind: TaskEventKind.Reasoning, info, newText: chunk.text })
          break
      }
    }

    // TODO: error handling

    if (!currentAssistantMessage) {
      throw new Error('No assistant message received')
    }

    info.messages.push({
      role: 'assistant',
      content: currentAssistantMessage,
    })

    const ret = parseAssistantMessage(currentAssistantMessage, this.config.tools, this.config.toolNamePrefix)

    await callback({ kind: TaskEventKind.EndRequest, info })

    return ret
  }

  async #handleResponse(
    info: TaskInfo,
    response: AssistantMessageContent[],
    callback: TaskEventCallback,
  ): Promise<[string | undefined, ExitReason | undefined]> {
    const toolReponses: { tool: string; response: string }[] = []
    outer: for (const content of response) {
      switch (content.type) {
        case 'text':
          // no need to handle text content
          break
        case 'tool_use': {
          await callback({ kind: TaskEventKind.ToolUse, info, tool: content.name })
          const toolResp = await this.#invokeTool(content.name, content.params)
          switch (toolResp.type) {
            case ToolResponseType.Reply:
              // reply to the tool use
              await callback({ kind: TaskEventKind.ToolReply, info, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break
            case ToolResponseType.Exit:
              // task completed
              return [undefined, toolResp]
            case ToolResponseType.Invalid:
              // tell AI about the invalid arguments
              await callback({ kind: TaskEventKind.ToolInvalid, info, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break outer
            case ToolResponseType.Error:
              // tell AI about the error
              await callback({ kind: TaskEventKind.ToolError, info, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break outer
            case ToolResponseType.Interrupted:
              // the execution is killed
              await callback({ kind: TaskEventKind.ToolInterrupted, info, tool: content.name })
              return [undefined, toolResp]
            case ToolResponseType.HandOver:
              // hand over the task to another agent
              await callback({
                kind: TaskEventKind.ToolHandOver,
                info,
                tool: content.name,
                agentName: toolResp.agentName,
                task: toolResp.task,
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
      return await handler(this.config.provider, args)
    } catch (error) {
      return {
        type: ToolResponseType.Error,
        message: responsePrompts.errorInvokeTool(name, error),
        canRetry: false,
      }
    }
  }

  get model() {
    return this.ai.model
  }
}
