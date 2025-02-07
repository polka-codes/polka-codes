import { ToolResponseType } from '../tool'
import type { AgentBase, ExitReason } from './AgentBase'

export type MultiAgentConfig = {
  createAgent: (name: string) => Promise<AgentBase>
  getContext?: (name: string, context?: string, files?: string[]) => Promise<string>
}

export class MultiAgent {
  readonly #config: MultiAgentConfig

  #activeAgent: AgentBase | null = null
  #agentStack: AgentBase[] = []

  constructor(config: MultiAgentConfig) {
    this.#config = config
  }

  get model() {
    return this.#activeAgent?.model
  }

  async #startTask(agentName: string, task: string, context: string | undefined): Promise<ExitReason> {
    const newAgent = await this.#config.createAgent(agentName)
    this.#activeAgent = newAgent
    const exitReason = await newAgent.startTask({
      task,
      context,
    })

    if (exitReason.type === ToolResponseType.HandOver) {
      const newContext = await this.#config.getContext?.(agentName, exitReason.context, exitReason.files)
      return await this.#startTask(exitReason.agentName, exitReason.task, newContext)
    }

    if (exitReason.type === ToolResponseType.Delegate) {
      // Save current agent to stack before delegation
      if (this.#activeAgent) {
        this.#agentStack.push(this.#activeAgent)
      }

      const newContext = await this.#config.getContext?.(agentName, exitReason.context, exitReason.files)
      const delegateResult = await this.#startTask(exitReason.agentName, exitReason.task, newContext)

      // Restore previous agent after delegation completes
      this.#activeAgent = this.#agentStack.pop() || null

      // Return the original agent's result
      return delegateResult
    }

    return exitReason
  }

  async startTask(options: {
    agentName: string
    task: string
    context?: string
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
