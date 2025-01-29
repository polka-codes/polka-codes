import type { AgentBase, ExitReason, TaskEvent, TaskEventCallback, TaskInfo } from './AgentBase'

export type MultiAgentConfig = {
  createAgent: (name: string) => Promise<AgentBase>
  getContext: (name: string, context?: string, files?: string[]) => Promise<string>
}

export class MultiAgent {
  readonly #config: MultiAgentConfig

  #activeAgent: AgentBase | null = null

  constructor(config: MultiAgentConfig) {
    this.#config = config
  }

  get model() {
    return this.#activeAgent?.model
  }

  async #startTask(
    agentName: string,
    task: string,
    context: string | undefined,
    maxIterations: number,
    callback?: TaskEventCallback,
  ): Promise<[ExitReason, TaskInfo]> {
    this.#activeAgent = await this.#config.createAgent(agentName)
    const [exitReason, info] = await this.#activeAgent.startTask({
      task,
      context,
      maxIterations,
      callback,
    })
    if (typeof exitReason === 'string') {
      return [exitReason, info]
    }
    if (exitReason.type === 'HandOver') {
      const remainIteration = maxIterations - Math.floor(info.messages.length / 2)

      if (remainIteration < 1) {
        return ['MaxIterations', info]
      }

      const context = await this.#config.getContext(agentName, exitReason.context, exitReason.files)
      const [exitReason2, info2] = await this.#startTask(exitReason.agentName, exitReason.task, context, remainIteration, callback)
      info2.inputTokens += info.inputTokens
      info2.outputTokens += info.outputTokens
      info2.cacheWriteTokens += info.cacheWriteTokens
      info2.cacheReadTokens += info.cacheReadTokens
      info2.totalCost = (info.totalCost ?? 0) + (info2.totalCost ?? 0)
      return [exitReason2, info2]
    }
    return [exitReason, info]
  }

  async startTask(options: {
    agentName: string
    task: string
    context?: string
    maxIterations?: number
    callback?: (event: TaskEvent) => void | Promise<void>
  }): Promise<[ExitReason, TaskInfo]> {
    if (this.#activeAgent) {
      throw new Error('An active agent already exists')
    }
    const maxIterations = options.maxIterations ?? 50
    return this.#startTask(options.agentName, options.task, options.context, maxIterations, options.callback)
  }

  async continueTask(userMessage: string, taskInfo: TaskInfo, callback: TaskEventCallback = () => {}): Promise<[ExitReason, TaskInfo]> {
    if (!this.#activeAgent) {
      throw new Error('No active agent')
    }
    return this.#activeAgent.continueTask(userMessage, taskInfo, callback)
  }
}
