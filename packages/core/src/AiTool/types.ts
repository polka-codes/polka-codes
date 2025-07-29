import type { AgentBase, AgentNameType, SharedAgentOptions } from '../Agent'

export type AiToolDefinition<Input, Output = string> = {
  name: string
  description: string
  prompt: string
  formatInput: (params: Input) => string
  parseOutput: (output: string) => Output
}

export type AiToolDefinitionWithMultiAgent<Input, Output = string> = AiToolDefinition<Input, Output> & {
  agent: AgentNameType
}

export type AiToolDefinitionWithAgent<Input, Output = string> = AiToolDefinition<Input, Output> & {
  agent: (options: SharedAgentOptions) => AgentBase
}

export type GetInput<T> = T extends AiToolDefinition<infer Input, any> ? Input : never
export type GetOutput<T> = T extends AiToolDefinition<any, infer Output> ? Output : never
