import type { AiServiceBase } from '../../AiService'
import { type FullToolInfo, getAvailableTools } from '../../tool'
import { type ToolProvider, allTools } from '../../tools'
import { AgentBase } from '../AgentBase'
import { fullSystemPrompt } from './prompts'

export type CoderAgentOptions = {
  ai: AiServiceBase
  os: string
  provider: ToolProvider
  interactive: boolean
  additionalTools?: FullToolInfo[]
  customInstructions?: string[]
  scripts?: Record<string, string | { command: string; description: string }>
}

export class CoderAgent extends AgentBase {
  constructor(options: CoderAgentOptions) {
    const combinedTools = [...(options.additionalTools ?? []), ...Object.values(allTools)]
    const tools = getAvailableTools(options.provider, combinedTools)
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

    super(options.ai, {
      systemPrompt,
      tools,
      toolNamePrefix,
      provider: options.provider,
      interactive: options.interactive,
    })
  }
}
