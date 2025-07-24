import type { ModelMessage } from 'ai'
import type { FullToolInfoV2, ToolResponse } from '../tool'
import type { AgentBase } from './AgentBase'

export type AgentPolicy = (tools: Record<string, FullToolInfoV2>, parameters: Record<string, any>) => AgentPolicyInstance | undefined

export type AgentPolicyInstance = {
  name: string
  tools?: FullToolInfoV2[]
  prompt?: string
  onBeforeInvokeTool?: (name: string, args: Record<string, string>) => Promise<ToolResponse | undefined>
  onBeforeRequest?: (agent: AgentBase) => Promise<void>
  prepareMessages?: (agent: AgentBase, messages: ModelMessage[]) => Promise<ModelMessage[]>
}
