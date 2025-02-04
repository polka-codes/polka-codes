import type { AgentBase, ExitReason, TaskEventCallback, TaskInfo } from './AgentBase'

export type MultiAgentConfig = {
  createAgent: (name: string) => Promise<AgentBase>
  getContext?: (name: string, context?: string, files?: string[]) => Promise<string>
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
    callback?: TaskEventCallback,
  ): Promise<[ExitReason, TaskInfo]> {
    this.#activeAgent = await this.#config.createAgent(agentName)
    const [exitReason, info] = await this.#activeAgent.startTask({
      task,
      context,
      callback,
    })
    if (typeof exitReason === 'string') {
      return [exitReason, info]
    }
    if (exitReason.type === 'HandOver') {
      const context = await this.#config.getContext?.(agentName, exitReason.context, exitReason.files)
      return await this.#startTask(exitReason.agentName, exitReason.task, context, callback)
    }
    return [exitReason, info]
  }

  async startTask(options: {
    agentName: string
    task: string
    context?: string
    callback?: TaskEventCallback
  }): Promise<[ExitReason, TaskInfo]> {
    if (this.#activeAgent) {
      throw new Error('An active agent already exists')
    }
    return this.#startTask(options.agentName, options.task, options.context, options.callback)
  }

  async continueTask(userMessage: string, taskInfo: TaskInfo, callback: TaskEventCallback = () => {}): Promise<[ExitReason, TaskInfo]> {
    if (!this.#activeAgent) {
      throw new Error('No active agent')
    }
    return this.#activeAgent.continueTask(userMessage, taskInfo, callback)
  }
}
