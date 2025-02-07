import { getAvailableTools } from '../../tool'
import { askFollowupQuestion, attemptCompletion, handOver, listCodeDefinitionNames, listFiles, readFile, searchFiles } from '../../tools'
import { AgentBase, type AgentInfo, type SharedAgentOptions } from '../AgentBase'
import { fullSystemPrompt } from './prompts'

export type ArchitectAgentOptions = SharedAgentOptions

export class ArchitectAgent extends AgentBase {
  constructor(options: ArchitectAgentOptions) {
    const agentTools = [
      ...(options.additionalTools ?? []),
      askFollowupQuestion,
      attemptCompletion,
      handOver,
      listCodeDefinitionNames,
      listFiles,
      readFile,
      searchFiles,
    ] // readonly tools
    const tools = getAvailableTools(options.provider, agentTools, (options.agents?.length ?? 0) > 0)
    const toolNamePrefix = 'tool_'
    const systemPrompt = fullSystemPrompt(
      {
        os: options.os,
      },
      tools,
      toolNamePrefix,
      options.customInstructions ?? [],
      options.scripts ?? {},
      options.interactive,
    )

    super(architectAgentInfo.name, options.ai, {
      systemPrompt,
      tools,
      toolNamePrefix,
      provider: options.provider,
      interactive: options.interactive,
      agents: options.agents,
      scripts: options.scripts,
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
