import os from 'node:os'
import {
  type AgentBase,
  type AiServiceProvider,
  ArchitectAgent,
  CoderAgent,
  MultiAgent,
  type TaskEventCallback,
  TaskEventKind,
  type TaskInfo,
  createService,
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

export class Runner {
  readonly #options: RunnerOptions
  readonly #multiAgent: MultiAgent
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
      model: options.model,
    })

    let rules = options.config.rules
    if (typeof rules === 'string') {
      rules = [rules]
    }

    const provider = getProvider({
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
      excludeFiles: options.config.excludeFiles,
    })

    const platform = os.platform()

    this.#multiAgent = new MultiAgent({
      createAgent: async (name: string): Promise<AgentBase> => {
        switch (name) {
          case 'coder':
            return new CoderAgent({
              ai: service,
              os: platform,
              customInstructions: rules,
              scripts: options.config.scripts,
              provider,
              interactive: options.interactive,
            })
          case 'architect':
            return new ArchitectAgent({
              ai: service,
              os: platform,
              customInstructions: rules,
              provider,
              interactive: options.interactive,
            })
          default:
            throw new Error(`Unknown agent: ${name}`)
        }
      },
    })
  }

  async startTask(task: string) {
    const cwd = process.cwd()
    const [fileList, limited] = await listFiles(cwd, true, 100, cwd, this.#options.config.excludeFiles)
    const fileContext = `<files>
${fileList.join('\n')}${limited ? '\n<files_truncated>true</files_truncated>' : ''}
</files>`

    const [exitReason, usage] = await this.#multiAgent.startTask({
      agentName: 'coder', // Default to coder agent
      task,
      context: `<now_date>${new Date().toISOString()}</now_date>${fileContext}`,
      callback: this.#taskEventCallback,
    })

    return [exitReason, usage] as const
  }

  #taskEventCallback: TaskEventCallback = (event) => {
    if (event.kind === TaskEventKind.Usage) {
      this.#usage.inputTokens += event.info.inputTokens
      this.#usage.outputTokens += event.info.outputTokens
      this.#usage.cacheWriteTokens += event.info.cacheWriteTokens ?? 0
      this.#usage.cacheReadTokens += event.info.cacheReadTokens ?? 0
      this.#usage.totalCost += event.info.totalCost ?? 0
    }
    this.#options.eventCallback(event)
  }

  async continueTask(message: string, taskInfo: TaskInfo) {
    return await this.#multiAgent.continueTask(message, taskInfo, this.#taskEventCallback)
  }

  get usage() {
    return this.#usage
  }

  printUsage() {
    if (!this.#usage.totalCost) {
      // Skip printing if no usage recorded
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
