import { ToolResponseType } from '../tool'
import type { AgentBase, ExitReason } from './AgentBase'

export type MultiAgentConfig = {
  createAgent: (name: string) => Promise<AgentBase>
  getContext?: (name: string, context?: string, files?: string[]) => Promise<string>
}

export class MultiAgent {
  readonly #config: MultiAgentConfig
  readonly #agents: AgentBase[] = []

  constructor(config: MultiAgentConfig) {
    this.#config = config
  }

  async #startTask(agentName: string, task: string, context: string | undefined): Promise<ExitReason> {
    const newAgent = await this.#config.createAgent(agentName)

    this.#agents.push(newAgent)

    const exitReason = await newAgent.startTask({
      task,
      context,
    })

    switch (exitReason.type) {
      case ToolResponseType.HandOver: {
        // remove the current agent
        this.#agents.pop()

        const newContext = await this.#config.getContext?.(agentName, exitReason.context, exitReason.files)
        return await this.#startTask(exitReason.agentName, exitReason.task, newContext)
      }
      case ToolResponseType.Delegate: {
        const newContext = await this.#config.getContext?.(agentName, exitReason.context, exitReason.files)
        const delegateResult = await this.#startTask(exitReason.agentName, exitReason.task, newContext)
        switch (delegateResult.type) {
          case ToolResponseType.HandOver:
          case ToolResponseType.Delegate:
            console.warn('Unexpected exit reason', delegateResult)
            break
          case ToolResponseType.Interrupted:
            return delegateResult
          case ToolResponseType.Exit:
            this.continueTask(delegateResult.message)
        }
        return delegateResult
      }
      case ToolResponseType.Interrupted:
      case ToolResponseType.Exit:
        // execution is finished
        this.#agents.pop()
        return exitReason
      default:
        return exitReason
    }
  }

  async startTask(options: {
    agentName: string
    task: string
    context?: string
  }): Promise<ExitReason> {
    if (this.#agents.length > 0) {
      throw new Error('An active agent already exists')
    }
    return this.#startTask(options.agentName, options.task, options.context)
  }

  async continueTask(userMessage: string): Promise<ExitReason> {
    if (!this.#agents.length) {
      throw new Error('No active agent')
    }
    return this.#agents[this.#agents.length - 1].continueTask(userMessage)
  }
}
