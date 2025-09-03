import { getAvailableTools } from '../../getAvailableTools'
import {
  askFollowupQuestion,
  attemptCompletion,
  delegate,
  fetchUrl,
  handOver,
  listFiles,
  readBinaryFile,
  readFile,
  searchFiles,
} from '../../tools'
import { UsageMeter } from '../../UsageMeter'
import { AgentBase, type AgentInfo, type SharedAgentOptions } from '../AgentBase'
import { fullSystemPrompt } from './prompts'

export type ArchitectAgentOptions = SharedAgentOptions

const agentTools = [askFollowupQuestion, attemptCompletion, delegate, fetchUrl, handOver, listFiles, readBinaryFile, readFile, searchFiles]

export class ArchitectAgent extends AgentBase {
  constructor(options: ArchitectAgentOptions) {
    const combinedTools = [...(options.additionalTools ?? []), ...agentTools]
    const tools = getAvailableTools({
      provider: options.provider,
      allTools: combinedTools,
      hasAgent: (options.agents?.length ?? 0) > 0,
    })
    const toolNamePrefix = options.toolFormat === 'native' ? '' : 'tool_'
    const systemPrompt = fullSystemPrompt(
      {
        os: options.os,
      },
      tools,
      toolNamePrefix,
      options.customInstructions ?? [],
      options.scripts ?? {},
      options.toolFormat === 'native',
    )

    super(architectAgentInfo.name, options.ai, {
      systemPrompt,
      tools,
      toolNamePrefix,
      provider: options.provider,
      agents: options.agents,
      scripts: options.scripts,
      callback: options.callback,
      policies: options.policies,
      toolFormat: options.toolFormat,
      parameters: options.parameters ?? {},
      usageMeter: options.usageMeter ?? new UsageMeter(),
      requestTimeoutSeconds: options.requestTimeoutSeconds,
      requireToolUse: options.requireToolUse ?? true,
    })
  }

  override onBeforeInvokeTool() {
    return Promise.resolve(undefined)
  }
}

export const architectAgentInfo = {
  name: 'architect',
  responsibilities: [
    'Analyzing the user’s overall task and requirements.',
    'Creating plans and making higher-level decisions about system structure and design.',
    'Reviewing and analyzing existing code or components for maintainability and scalability.',
    'Laying out the roadmap for implementation.',
  ],
} as const satisfies AgentInfo
