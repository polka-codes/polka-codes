import { ToolResponseType } from '../tool'
import type { AgentBase, ExitReason } from './AgentBase'

export type MultiAgentConfig = {
  createAgent: (name: string) => Promise<AgentBase>
  getPrompt?: (name: string, task: string, context?: string, files?: string[]) => Promise<string>
}

export class MultiAgent {
  readonly #config: MultiAgentConfig
  readonly #agents: AgentBase[] = []

  constructor(config: MultiAgentConfig) {
    this.#config = config
  }

  async #handleTaskResult(exitReason: ExitReason) {
    switch (exitReason.type) {
      case ToolResponseType.HandOver: {
        // remove the current agent
        this.#agents.pop()

        const prompt =
          (await this.#config.getPrompt?.(exitReason.agentName, exitReason.task, exitReason.context, exitReason.files)) ?? exitReason.task
        return await this.#startTask(exitReason.agentName, prompt)
      }
      case ToolResponseType.Delegate: {
        const prompt =
          (await this.#config.getPrompt?.(exitReason.agentName, exitReason.task, exitReason.context, exitReason.files)) ?? exitReason.task
        const delegateResult = await this.#startTask(exitReason.agentName, prompt)
        switch (delegateResult.type) {
          case ToolResponseType.HandOver:
          case ToolResponseType.Delegate:
            console.warn('Unexpected exit reason', delegateResult)
            break
          case ToolResponseType.Interrupted:
            return delegateResult
          case ToolResponseType.Exit:
            return this.continueTask(delegateResult.message)
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

  async #startTask(agentName: string, task: string): Promise<ExitReason> {
    const newAgent = await this.#config.createAgent(agentName)

    this.#agents.push(newAgent)

    const exitReason = await newAgent.start(task)

    return await this.#handleTaskResult(exitReason)
  }

  async startTask(options: {
    agentName: string
    task: string
  }): Promise<ExitReason> {
    if (this.#agents.length > 0) {
      throw new Error('An active agent already exists')
    }
    return this.#startTask(options.agentName, options.task)
  }

  async continueTask(userMessage: string): Promise<ExitReason> {
    if (!this.#agents.length) {
      throw new Error('No active agent')
    }
    const exitReason = await this.#agents[this.#agents.length - 1].continueTask(userMessage)
    return await this.#handleTaskResult(exitReason)
  }

  get hasActiveAgent(): boolean {
    return this.#agents.length > 0
  }
}
