import { readFile } from 'node:fs/promises'
import os from 'node:os'
import {
  type AgentBase,
  type AgentNameType,
  type AiServiceProvider,
  AnalyzerAgent,
  ArchitectAgent,
  CoderAgent,
  MultiAgent,
  type TaskEventCallback,
  type TaskInfo,
  analyzerAgentInfo,
  architectAgentInfo,
  coderAgentInfo,
  createService,
} from '@polka-codes/core'
import type { Config } from './config'
import { type ProviderOptions, getProvider } from './provider'
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

    const providerOptions: ProviderOptions = {
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
    }

    const platform = os.platform()
    const agents = [coderAgentInfo, architectAgentInfo]

    this.#multiAgent = new MultiAgent({
      createAgent: async (name: string): Promise<AgentBase> => {
        const agentName = name.trim().toLowerCase()
        switch (agentName) {
          case coderAgentInfo.name:
            return new CoderAgent({
              ai: service,
              os: platform,
              customInstructions: rules,
              scripts: options.config.scripts,
              provider: getProvider('coder', options.config, providerOptions),
              interactive: options.interactive,
              agents,
            })
          case architectAgentInfo.name:
            return new ArchitectAgent({
              ai: service,
              os: platform,
              customInstructions: rules,
              scripts: options.config.scripts,
              provider: getProvider('architect', options.config, providerOptions),
              interactive: options.interactive,
              agents,
            })
          case analyzerAgentInfo.name:
            return new AnalyzerAgent({
              ai: service,
              os: platform,
              customInstructions: rules,
              scripts: options.config.scripts,
              provider: getProvider('analyzer', options.config, providerOptions),
              interactive: options.interactive,
              agents,
            })
          default:
            throw new Error(`Unknown agent: ${name}`)
        }
      },
      getContext: async (name, context, files) => {
        let ret = await this.#defaultContext(name)
        const unreadableFiles: string[] = []

        if (files) {
          for (const file of files) {
            try {
              const fileContent = await readFile(file, 'utf8')
              ret += `\n<file_content path="${file}">${fileContent}</file_content>`
            } catch (error) {
              console.warn(`Failed to read file: ${file}`, error)
              unreadableFiles.push(file)
            }
          }

          if (unreadableFiles.length > 0) {
            ret += '\n<unreadable_files>\n'
            for (const file of unreadableFiles) {
              ret += `${file}\n`
            }
            ret += '</unreadable_files>'
          }
        }

        if (context) {
          ret += `\n\n${context}`
        }
        return ret
      },
    })
  }

  async #defaultContext(name: string) {
    const cwd = process.cwd()
    const agentConfig = this.#options.config.agents?.[name as AgentNameType] ?? this.#options.config.agents?.default ?? {}
    const maxFileCount = agentConfig.initialContext?.maxFileCount ?? 200
    const excludes = agentConfig.initialContext?.excludes ?? []
    const finalExcludes = excludes.concat(this.#options.config.excludeFiles ?? [])
    const [fileList, limited] = await listFiles(cwd, true, maxFileCount, cwd, finalExcludes)
    const fileContext = `<files>
${fileList.join('\n')}${limited ? '\n<files_truncated>true</files_truncated>' : ''}
</files>`
    return `<now_date>${new Date().toISOString()}</now_date>${fileContext}`
  }

  async startTask(task: string) {
    const agentName = architectAgentInfo.name
    const [exitReason, info] = await this.#multiAgent.startTask({
      agentName: agentName,
      task,
      context: await this.#defaultContext(agentName),
      callback: this.#options.eventCallback,
    })

    return [exitReason, info] as const
  }

  async continueTask(message: string, taskInfo: TaskInfo) {
    return await this.#multiAgent.continueTask(message, taskInfo, this.#options.eventCallback)
  }

  get usage() {
    return this.#multiAgent.usage
  }

  printUsage() {
    this.#multiAgent.printUsage()
  }
}
