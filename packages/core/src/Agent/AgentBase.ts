import type { AiServiceBase, MessageParam } from '../AiService'
import { type FullToolInfo, type ToolResponse, ToolResponseType } from '../tool'
import type { ToolProvider } from './../tools'
import { type AssistantMessageContent, parseAssistantMessage } from './parseAssistantMessage'
import { responsePrompts } from './prompts'

export type TaskEvent = {
  kind: string
  info: TaskInfo
  newText?: string
  tool?: string
  userMessage?: string
}

export type TaskEventCallback = (event: TaskEvent) => void | Promise<void>

export type TaskInfo = {
  options: {
    maxIterations: number
  }
  messages: MessageParam[]
  inputTokens: number
  outputTokens: number
  cacheWriteTokens: number
  cacheReadTokens: number
  totalCost: number | undefined
}

export type AgentBaseConfig = {
  systemPrompt: string
  tools: FullToolInfo[]
  toolNamePrefix: string
  provider: ToolProvider
  interactive: boolean
}

export enum ExitReason {
  Completed = 'Completed',
  MaxIterations = 'MaxIterations',
  WaitForUserInput = 'WaitForUserInput',
  Interrupted = 'Interrupted',
}

export abstract class AgentBase {
  protected readonly ai: AiServiceBase
  protected readonly config: Readonly<AgentBaseConfig>
  protected readonly handlers: Record<string, FullToolInfo>

  constructor(ai: AiServiceBase, config: AgentBaseConfig) {
    this.ai = ai
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
  }: { task: string; context?: string; maxIterations: number; callback: TaskEventCallback }): Promise<[ExitReason, TaskInfo]> {
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
        callback({ kind: 'max_iterations_reached', info: taskInfo })
        return [ExitReason.MaxIterations, taskInfo]
      }
      const response = await this.#request(taskInfo, nextRequest, callback)
      const [newMessage, exitReason] = await this.#handleResponse(taskInfo, response, callback)
      if (exitReason) {
        return [exitReason, taskInfo]
      }
      nextRequest = newMessage
    }

    callback({ kind: 'end_task', info: taskInfo })
    return [ExitReason.Completed, taskInfo]
  }

  async continueTask(userMessage: string, taskInfo: TaskInfo, callback: TaskEventCallback): Promise<[ExitReason, TaskInfo]> {
    return await this.#processLoop(userMessage, taskInfo, callback)
  }

  async #request(info: TaskInfo, userMessage: string, callback: TaskEventCallback) {
    await callback({ kind: 'start_request', info, userMessage })

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
          info.inputTokens = chunk.inputTokens
          info.outputTokens = chunk.outputTokens
          info.cacheWriteTokens = chunk.cacheWriteTokens ?? 0
          info.cacheReadTokens = chunk.cacheReadTokens ?? 0
          info.totalCost = chunk.totalCost
          await callback({ kind: 'usage', info })
          break
        case 'text':
          currentAssistantMessage += chunk.text
          await callback({ kind: 'text', info, newText: chunk.text })
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

    await callback({ kind: 'end_request', info })

    return ret
  }

  async #handleResponse(
    info: TaskInfo,
    response: AssistantMessageContent[],
    callback: TaskEventCallback,
  ): Promise<[string | undefined, ExitReason | undefined]> {
    const toolReponses: { tool: string; response: string }[] = []
    for (const content of response) {
      switch (content.type) {
        case 'text':
          // no need to handle text content
          break
        case 'tool_use': {
          await callback({ kind: 'tool_use', info, tool: content.name })
          const toolResp = await this.#invokeTool(content.name, content.params)
          switch (toolResp.type) {
            case ToolResponseType.Reply:
              // reply to the tool use
              await callback({ kind: 'tool_reply', info, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break
            case ToolResponseType.Exit:
              // task completed
              return [undefined, ExitReason.Completed]
            case ToolResponseType.Invalid:
              // tell AI about the invalid arguments
              await callback({ kind: 'tool_invalid', info, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break
            case ToolResponseType.Error:
              // tell AI about the error
              await callback({ kind: 'tool_error', info, tool: content.name })
              toolReponses.push({ tool: content.name, response: toolResp.message })
              break
            case ToolResponseType.Interrupted:
              // the execution is killed
              await callback({ kind: 'tool_interrupted', info, tool: content.name })
              return [undefined, ExitReason.Interrupted]
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
