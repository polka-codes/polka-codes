import { getAvailableTools } from '../../getAvailableTools'
import { PermissionLevel } from '../../tool'
import { toToolInfoV1 } from '../../tool-v1-compat'
import { allTools } from '../../tools'
import { UsageMeter } from '../../UsageMeter'
import { AgentBase, type AgentInfo, type SharedAgentOptions } from '../AgentBase'
import { fullSystemPrompt } from './prompts'

export type ArchitectAgentOptions = SharedAgentOptions

export class ArchitectAgent extends AgentBase {
  constructor(options: ArchitectAgentOptions) {
    const combinedTools = [...(options.additionalTools ?? []), ...Object.values(allTools)]
    const tools = getAvailableTools({
      provider: options.provider,
      allTools: combinedTools,
      hasAgent: (options.agents?.length ?? 0) > 0,
      permissionLevel: PermissionLevel.Read,
      interactive: true,
    })
    const toolNamePrefix = 'tool_'
    const systemPrompt = fullSystemPrompt(
      {
        os: options.os,
      },
      tools.map(toToolInfoV1),
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
      interactive: options.interactive,
      agents: options.agents,
      scripts: options.scripts,
      callback: options.callback,
      policies: options.policies,
      toolFormat: options.toolFormat,
      parameters: options.parameters ?? {},
      usageMeter: options.usageMeter ?? new UsageMeter(),
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
