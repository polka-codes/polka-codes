import type { z } from 'zod'

export enum AiProvider {
  Anthropic = 'anthropic',
  Ollama = 'ollama',
  DeepSeek = 'deepseek',
  OpenRouter = 'openrouter',
  OpenAI = 'openai',
  Bedrock = 'bedrock',
}

export type ModelConfig = {
  provider: AiProvider
  model: string
  apiKey?: string
  baseUrl?: string
}

export type AgentTool<TAgents extends Record<string, AgentInfo>, TInput extends z.ZodSchema, TOutput extends z.ZodSchema> = {
  id: string
  description: string
  inputSchema?: TInput
  outputSchema?: TOutput
  execute: (
    input: z.infer<TInput extends z.ZodSchema ? TInput : any>,
    polka: IPolka<TAgents>,
  ) => Promise<z.infer<TOutput extends z.ZodSchema ? TOutput : never>>
}

export type AgentTools = Record<string, AgentTool<any, any, any>>

export function agentTool<
  TAgents extends Record<string, AgentInfo> = Record<string, AgentInfo>,
  TInput extends z.ZodSchema = z.ZodObject<any>,
  TOutput extends z.ZodSchema = z.ZodObject<any>,
>(def: AgentTool<TAgents, TInput, TOutput>): AgentTool<TAgents, TInput, TOutput> {
  return def
}

export type AgentInfo<TName extends string = string, TCtx extends z.ZodSchema = z.ZodObject<any>> = {
  name: TName
  description: string
  systemPrompt: string
  contextSchema: TCtx
  tools: AgentTools
}

export interface IPolka<TAgents extends Record<string, AgentInfo> = Record<string, AgentInfo>> {
  startTask<TOutput extends z.ZodSchema = z.ZodString>(
    agentName: keyof TAgents,
    task: string,
    options: {
      context?: z.infer<TAgents[keyof TAgents]['contextSchema']>
      outputSchema?: TOutput
    },
  ): Promise<z.infer<TOutput> | { error: string }>
}
