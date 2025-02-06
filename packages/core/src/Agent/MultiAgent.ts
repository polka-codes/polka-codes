import { ToolResponseType } from '../tool'
import type { AgentBase, ExitReason, TaskEventCallback } from './AgentBase'

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

  async #startTask(agentName: string, task: string, context: string | undefined): Promise<ExitReason> {
    this.#activeAgent = await this.#config.createAgent(agentName)
    const exitReason = await this.#activeAgent.startTask({
      task,
      context,
    })
    if (exitReason.type === ToolResponseType.HandOver) {
      const context = await this.#config.getContext?.(agentName, exitReason.context, exitReason.files)
      return await this.#startTask(exitReason.agentName, exitReason.task, context)
    }
    return exitReason
  }

  async startTask(options: {
    agentName: string
    task: string
    context?: string
    callback?: TaskEventCallback
  }): Promise<ExitReason> {
    if (this.#activeAgent) {
      throw new Error('An active agent already exists')
    }
    return this.#startTask(options.agentName, options.task, options.context)
  }

  async continueTask(userMessage: string): Promise<ExitReason> {
    if (!this.#activeAgent) {
      throw new Error('No active agent')
    }
    return this.#activeAgent.continueTask(userMessage)
  }
}
