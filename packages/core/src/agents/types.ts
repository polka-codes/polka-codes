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

export type AgentTool<TAgents extends Record<string, z.ZodSchema>, TInput extends z.ZodSchema, TOutput extends z.ZodSchema> = {
  id: string
  description: string
  inputSchema?: TInput
  outputSchema?: TOutput
  execute: (
    input: z.infer<TInput extends z.ZodSchema ? TInput : any>,
    polka: IPolka<TAgents>,
  ) => Promise<z.infer<TOutput extends z.ZodSchema ? TOutput : never>>
}

export type AgentTools = Record<string, AgentTool<Record<string, z.ZodSchema>, z.ZodSchema, z.ZodSchema>>

export function agentTool<
  TAgents extends Record<string, z.ZodSchema> = Record<string, z.ZodSchema>,
  TInput extends z.ZodSchema = z.ZodSchema,
  TOutput extends z.ZodSchema = z.ZodSchema,
>(def: AgentTool<TAgents, TInput, TOutput>): AgentTool<TAgents, TInput, TOutput> {
  return def
}

export type AgentInfo<TName extends string = string, TCtx extends z.ZodSchema = z.ZodSchema> = {
  name: TName
  description: string
  systemPrompt: string
  contextSchema: TCtx
  tools: AgentTools
}

export function agentInfo<TName extends string, TCtx extends z.ZodSchema>(def: AgentInfo<TName, TCtx>): AgentInfo<TName, TCtx> {
  return def
}

export interface IPolka<TAgents extends Record<string, z.ZodSchema> = Record<string, z.ZodSchema>> {
  startTask<TOutput extends z.ZodSchema = z.ZodString>(
    agentName: keyof TAgents,
    task: string,
    options: {
      context?: z.infer<TAgents[keyof TAgents]>
      outputSchema?: TOutput
    },
  ): Promise<z.infer<TOutput> | { error: string }>
}
