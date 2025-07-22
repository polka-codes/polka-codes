import type { ModelMessage } from 'ai'
import type { FullToolInfo, ToolResponse } from '../tool'
import type { AgentBase } from './AgentBase'

export type AgentPolicy = (tools: Record<string, FullToolInfo>, parameters: Record<string, any>) => AgentPolicyInstance | undefined

export type AgentPolicyInstance = {
  name: string
  tools?: FullToolInfo[]
  prompt?: string
  onBeforeInvokeTool?: (name: string, args: Record<string, string>) => Promise<ToolResponse | undefined>
  onBeforeRequest?: (agent: AgentBase) => Promise<void>
  prepareMessages?: (agent: AgentBase, messages: ModelMessage[]) => Promise<ModelMessage[]>
}
