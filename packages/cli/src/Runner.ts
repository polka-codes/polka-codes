import os from 'node:os'
import {
  type AgentBase,
  type AiServiceProvider,
  CoderAgent,
  type TaskEventCallback,
  type TaskInfo,
  createService,
  createServiceLogger,
} from '@polka-codes/core'
import type { Config } from './config'
import { getProvider } from './provider'
import { listFiles } from './utils/listFiles'

export type RunnerOptions = {
  provider: AiServiceProvider
  model: string
  apiKey?: string
  config: Config
  maxIterations: number
  interactive: boolean
  eventCallback: TaskEventCallback
}

const logger = createServiceLogger('cli/runner')

export class Runner {
  readonly #options: RunnerOptions
  readonly #agent: AgentBase
  #usage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheWriteTokens: 0,
    cacheReadTokens: 0,
    totalCost: 0,
  }

  constructor(options: RunnerOptions) {
    this.#options = options

    const service = createService(options.provider, {
      apiKey: options.apiKey,
      modelId: options.model,
    })

    let rules = options.config.rules
    if (typeof rules === 'string') {
      rules = [rules]
    }

    this.#agent = new CoderAgent({
      ai: service,
      os: os.platform(),
      customInstructions: rules,
      commands: options.config.commands,
      provider: getProvider({
        command: {
          onStarted(command) {
            console.log(`$ >>>> $ ${command}`)
          },
          onStdout(data) {
            process.stdout.write(data)
          },
          onStderr(data) {
            process.stderr.write(data)
          },
          onExit(code) {
            console.log(`$ <<<< $ Command exited with code: ${code}`)
          },
          onError(error) {
            console.log(`$ <<<< $ Command error: ${error}`)
          },
        },
      }),
      interactive: options.interactive,
    })
  }

  async startTask(task: string) {
    logger.trace(
      {
        provider: this.#options.provider,
        model: this.#options.model,
        task,
      },
      'Starting task',
    )

    const cwd = process.cwd()
    const [fileList, limited] = await listFiles(cwd, true, 100, cwd)
    const fileContext = `<files>
    ${fileList.join('\n')}${limited ? '\n<files_truncated>true</files_truncated>' : ''}
</files>`

    return await this.#agent.startTask({
      task,
      context: `<now_date>${new Date().toISOString()}</now_date>${fileContext}`,
      maxIterations: this.#options.maxIterations,
      callback: this.#taskEventCallback,
    })
  }

  #taskEventCallback: TaskEventCallback = (event) => {
    if (event.kind === 'usage') {
      this.#usage.inputTokens += event.info.inputTokens
      this.#usage.outputTokens += event.info.outputTokens
      this.#usage.cacheWriteTokens += event.info.cacheWriteTokens ?? 0
      this.#usage.cacheReadTokens += event.info.cacheReadTokens ?? 0
      this.#usage.totalCost += event.info.totalCost ?? 0
    }
    this.#options.eventCallback(event)
  }

  async continueTask(message: string, taskInfo: TaskInfo) {
    return await this.#agent.continueTask(message, taskInfo, this.#taskEventCallback)
  }

  get usage() {
    return this.#usage
  }

  printUsage() {
    if (!this.#usage.totalCost) {
      // we need to calculate the total cost
      const modelInfo = this.#agent.model.info
      const inputCost = (modelInfo.inputPrice ?? 0) * this.#usage.inputTokens
      const outputCost = (modelInfo.outputPrice ?? 0) * this.#usage.outputTokens
      const cacheReadCost = (modelInfo.cacheReadsPrice ?? 0) * this.#usage.cacheReadTokens
      const cacheWriteCost = (modelInfo.cacheWritesPrice ?? 0) * this.#usage.cacheWriteTokens
      this.#usage.totalCost = (inputCost + outputCost + cacheReadCost + cacheWriteCost) / 1_000_000
    }

    if (this.#usage.totalCost === 0) {
      // nothing to print
      return
    }

    console.log('Usages:')
    console.log(`Input tokens: ${this.#usage.inputTokens}`)
    console.log(`Output tokens: ${this.#usage.outputTokens}`)
    console.log(`Cache read tokens: ${this.#usage.cacheReadTokens}`)
    console.log(`Cache write tokens: ${this.#usage.cacheWriteTokens}`)
    console.log(`Total cost: ${this.#usage.totalCost}`)
  }
}
