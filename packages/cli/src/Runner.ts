import { readFile } from 'node:fs/promises'
import os from 'node:os'
import {
  type AgentBase,
  type AgentInfo,
  type AgentNameType,
  type AiServiceBase,
  AnalyzerAgent,
  ArchitectAgent,
  CodeFixerAgent,
  CoderAgent,
  MultiAgent,
  UsageMeter,
  allAgents,
  analyzerAgentInfo,
  architectAgentInfo,
  codeFixerAgentInfo,
  coderAgentInfo,
  createService,
} from '@polka-codes/core'

import { type Config, type ProviderOptions, getProvider, listFiles, printEvent } from '@polka-codes/cli-shared'
import type { ApiProviderConfig } from './ApiProviderConfig'

export type RunnerOptions = {
  providerConfig: ApiProviderConfig
  config: Config
  maxMessageCount: number
  budget: number
  interactive: boolean
  verbose: number
  enableCache: boolean
  availableAgents?: AgentInfo[] // empty to enable all agents
}

/** Core orchestrator managing AI agents, service provisioning, and task execution lifecycle */
export class Runner {
  readonly #options: RunnerOptions
  readonly #usageMeter: UsageMeter

  readonly multiAgent: MultiAgent

  /** Initialize core components including usage tracking and agent service provisioning */
  constructor(options: RunnerOptions) {
    this.#options = options
    this.#usageMeter = new UsageMeter({
      prices: options.config.prices,
      maxCost: options.budget,
      maxMessageCount: options.maxMessageCount,
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
      interactive: options.interactive,
    }

    const platform = os.platform()

    const services: Record<string, Record<string, AiServiceBase>> = {}

    // Cache AI services by provider+model to reuse connections and track costs
    const getOrCreateService = (agentName: string) => {
      const config = this.#options.providerConfig.getConfigForAgent(agentName)
      if (!config) {
        // return any existing service if found
        const service = Object.values(Object.values(services)[0] ?? {})[0]
        if (service) {
          return service
        }
        throw new Error(`No provider configured for agent: ${agentName}`)
      }
      const { provider, model, apiKey, parameters } = config
      let service = services[provider]?.[model]
      if (!service) {
        service = createService(provider, {
          apiKey,
          model,
          parameters,
          usageMeter: this.#usageMeter,
          enableCache: options.enableCache,
        })
        services[provider] = { [model]: service }
      }
      return service
    }

    const callback = printEvent(options.verbose, this.#usageMeter)

    this.multiAgent = new MultiAgent({
      createAgent: async (name: string): Promise<AgentBase> => {
        const agentName = name.trim().toLowerCase()
        const args = {
          ai: getOrCreateService(agentName),
          os: platform,
          customInstructions: rules,
          scripts: options.config.scripts,
          interactive: options.interactive,
          agents: this.#options.availableAgents ?? allAgents,
          callback,
        }
        switch (agentName) {
          case coderAgentInfo.name:
            return new CoderAgent({
              ...args,
              interactive: false,
              provider: getProvider(agentName, options.config, providerOptions),
            })
          case architectAgentInfo.name:
            return new ArchitectAgent({
              ...args,
              provider: getProvider(agentName, options.config, providerOptions),
            })
          case analyzerAgentInfo.name:
            return new AnalyzerAgent({
              ...args,
              interactive: false,
              provider: getProvider(agentName, options.config, providerOptions),
            })
          case codeFixerAgentInfo.name:
            return new CodeFixerAgent({
              ...args,
              provider: getProvider(agentName, options.config, providerOptions),
            })
          default:
            throw new Error(`Unknown agent: ${name}`)
        }
      },
      getPrompt: async (name, task, context, files, originalTask) => {
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
        if (originalTask) {
          ret += `\n\n<original_user_prompt>${originalTask}</original_user_prompt>`
        }
        return `<task>${task}</task>\n<context>${ret}</context>`
      },
    })
  }

  // Generate initial context with project structure and agent-specific exclusions
  async #defaultContext(name: string) {
    const cwd = process.cwd()
    const agentConfig = this.#options.config.agents?.[name as AgentNameType] ?? this.#options.config.agents?.default ?? {}
    const maxFileCount = agentConfig.initialContext?.maxFileCount ?? 200
    const excludes = agentConfig.initialContext?.excludes ?? []
    const finalExcludes = excludes.concat(this.#options.config.excludeFiles ?? [])
    const [fileList] = await listFiles(cwd, true, maxFileCount, cwd, finalExcludes)
    const fileContext = `<files>\n${fileList.join('\n')}\n</files>`
    return `<now_date>${new Date().toISOString()}</now_date>${fileContext}`
  }

  /** Execute a task through the agent system, initializing context if not provided */
  async startTask(task: string, agentName: string = architectAgentInfo.name, context?: string) {
    const finalContext = context ?? (await this.#defaultContext(agentName))
    const exitReason = await this.multiAgent.startTask({
      agentName: agentName,
      task: `<task>${task}</task>\n<context>${finalContext}</context>`,
    })

    return exitReason
  }

  async continueTask(message: string) {
    return await this.multiAgent.continueTask(message)
  }

  get hasActiveAgent() {
    return this.multiAgent.hasActiveAgent
  }

  get usage() {
    return this.#usageMeter.usage
  }

  printUsage() {
    this.#usageMeter.printUsage()
  }
}
