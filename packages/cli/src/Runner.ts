import { readFile } from 'node:fs/promises'
import os from 'node:os'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { type Config, getProvider, listFiles, type ProviderOptions, printEvent } from '@polka-codes/cli-shared'
import {
  type AgentBase,
  type AgentInfo,
  type AgentNameType,
  type AgentPolicy,
  AnalyzerAgent,
  ArchitectAgent,
  allAgents,
  analyzerAgentInfo,
  architectAgentInfo,
  askFollowupQuestion,
  CodeFixerAgent,
  CoderAgent,
  codeFixerAgentInfo,
  coderAgentInfo,
  EnableCachePolicy,
  MultiAgent,
  Policies,
  TruncateContextPolicy,
  UsageMeter,
} from '@polka-codes/core'
import type { FilePart, ImagePart, TextPart } from 'ai'
import { merge } from 'lodash'
import type { ApiProviderConfig } from './ApiProviderConfig'
import { summarizeOutput } from './commandSummarizer'
import { getModel } from './getModel'
import { getProviderOptions } from './getProviderOptions'
import prices from './prices'

export type RunnerOptions = {
  providerConfig: ApiProviderConfig
  config: Config
  maxMessageCount: number
  budget: number
  interactive: boolean
  verbose: number
  availableAgents?: AgentInfo[] // empty to enable all agents
  silent?: boolean
  externalUsageMeter?: UsageMeter
}

/** Core orchestrator managing AI agents, service provisioning, and task execution lifecycle */
export class Runner {
  readonly #options: RunnerOptions
  readonly usageMeter: UsageMeter

  readonly multiAgent: MultiAgent

  /** Initialize core components including usage tracking and agent service provisioning */
  constructor(options: RunnerOptions) {
    this.#options = options

    this.usageMeter =
      options.externalUsageMeter ??
      new UsageMeter(merge(prices, options.config.prices ?? {}), {
        maxMessages: options.maxMessageCount ?? 0,
        maxCost: options.budget ?? 0,
      })

    let rules = options.config.rules
    if (typeof rules === 'string') {
      rules = [rules]
    }

    const toolProviderOptions: ProviderOptions = {
      command: this.#options.silent
        ? undefined
        : {
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
      summaryThreshold: options.config.summaryThreshold,
    }

    const platform = os.platform()

    const llms: Record<string, Record<string, LanguageModelV2>> = {}

    // Cache AI services by provider+model to reuse connections and track costs
    const getOrCreateLlm = (agentName: string) => {
      const config = this.#options.providerConfig.getConfigForAgent(agentName)
      if (!config) {
        // return any existing service if found
        const service = Object.values(Object.values(llms)[0] ?? {})[0]
        if (service) {
          return service
        }
        throw new Error(`No provider configured for agent: ${agentName}`)
      }
      const { provider, model } = config
      let service = llms[provider]?.[model]
      if (!service) {
        service = getModel(config, this.#options.verbose > 2)
        llms[provider] = { [model]: service }
      }
      return service
    }

    const callback = options.silent ? undefined : printEvent(options.verbose, this.usageMeter)

    const policies: AgentPolicy[] = [EnableCachePolicy]
    for (const policy of options.config.policies ?? []) {
      switch (policy.trim().toLowerCase()) {
        case Policies.TruncateContext:
          policies.push(TruncateContextPolicy)
          if (!options.silent) {
            console.log('TruncateContextPolicy enabled')
          }
          break
        case Policies.EnableCache:
          // Already added by default
          break
        default:
          if (!options.silent) {
            console.log('Unknown policy:', policy)
          }
          break
      }
    }

    this.multiAgent = new MultiAgent({
      createAgent: async (name: string): Promise<AgentBase> => {
        const agentName = name.trim().toLowerCase()
        const agentConfig = this.#options.config.agents?.[name as AgentNameType] ?? this.#options.config.agents?.default ?? {}
        const retryCount = agentConfig.retryCount ?? this.#options.config.retryCount
        const requestTimeoutSeconds = agentConfig.requestTimeoutSeconds ?? this.#options.config.requestTimeoutSeconds

        const ai = getOrCreateLlm(agentName)
        const config = this.#options.providerConfig.getConfigForAgent(agentName)

        const providerOptions = config
          ? getProviderOptions({ provider: config.provider, modelId: ai.modelId, parameters: config.parameters })
          : {}

        const additionalTools = []
        if (this.#options.interactive) {
          additionalTools.push(askFollowupQuestion)
        }

        const newToolProviderOptions: ProviderOptions = {
          ...toolProviderOptions,
          summarizeOutput: async (stdout: string, stderr: string) => {
            return await summarizeOutput(ai, stdout, stderr)
          },
        }

        const args = {
          ai,
          os: platform,
          customInstructions: rules,
          scripts: options.config.scripts,
          agents: this.#options.availableAgents ?? allAgents,
          callback,
          policies,
          retryCount,
          requestTimeoutSeconds,
          toolFormat: this.#options.config.toolFormat ?? config?.toolFormat ?? 'polka-codes',
          parameters: {
            ...config?.parameters,
            providerOptions,
          },
          usageMeter: this.usageMeter,
          additionalTools,
          provider: getProvider(newToolProviderOptions),
        }
        switch (agentName) {
          case coderAgentInfo.name:
            return new CoderAgent(args)
          case architectAgentInfo.name:
            return new ArchitectAgent(args)
          case analyzerAgentInfo.name:
            return new AnalyzerAgent(args)
          case codeFixerAgentInfo.name:
            return new CodeFixerAgent(args)
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
              if (options.verbose > 0) {
                console.log(`Failed to read file: ${file}`, error)
              }
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
  async startTask(task: string, agentName: string = architectAgentInfo.name, files?: (FilePart | ImagePart)[]) {
    const finalContext = await this.#defaultContext(agentName)
    const exitReason = await this.multiAgent.startTask({
      agentName,
      task,
      context: finalContext,
      files,
    })

    return exitReason
  }

  async continueTask(message: string, files?: (FilePart | ImagePart)[]) {
    if (!files || files.length === 0) {
      return await this.multiAgent.continueTask(message)
    }
    const userContent: Array<TextPart | ImagePart | FilePart> = [...files]
    userContent.push({
      type: 'text',
      text: message,
    })
    return await this.multiAgent.continueTask(userContent)
  }

  abort() {
    this.multiAgent.abort()
  }

  get hasActiveAgent() {
    return this.multiAgent.hasActiveAgent
  }

  get usage() {
    return this.usageMeter.usage
  }

  printUsage() {
    this.usageMeter.printUsage()
  }
}
