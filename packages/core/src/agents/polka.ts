import { Mastra, createTool } from '@mastra/core'
import { Agent } from '@mastra/core/agent'
import { z } from 'zod'

import { Memory } from '@mastra/memory'
import { getModel } from './model'
import type { AgentInfo, IPolka, ModelConfig } from './types'

export interface AgentOptions<TName extends string, TCtx extends z.ZodSchema> {
  info: AgentInfo<TName, TCtx>
  model: ModelConfig
  contextProvider: (context: z.infer<TCtx>) => Promise<string>
  agents?: Record<string, AgentInfo>
}

export function agentOptions<TName extends string, TCtx extends z.ZodSchema>(def: AgentOptions<TName, TCtx>): AgentOptions<TName, TCtx> {
  return def
}

const exitReasonSuccess = z.object({
  reason: z.literal('success').describe('The execution was successful'),
})

const exitReasonFailure = z.object({
  reason: z.literal('failed').describe('Unable to complete the task'),
  message: z.string().describe('The error message'),
})

const exitReasonHandoverBase = z.object({
  reason: z.literal('handover').describe('Hand over the task to another agent'),
  task: z.string().describe('The task to be completed by the target agent'),
})

const exitReasonHandOver = (agents?: Record<string, AgentInfo>) => {
  if (!agents) {
    return undefined
  }

  const schemas = Object.values(agents).map((agent) =>
    exitReasonHandoverBase.extend({
      agentName: z.literal(agent.name),
      ...(agent.contextSchema ? { context: agent.contextSchema.describe('The context information for the task') } : {}),
    }),
  )

  if (schemas.length === 0) {
    return undefined
  }
  if (schemas.length === 1) {
    return schemas[0]
  }

  return z.union(schemas as any)
}

const agentOutputSchema = (agents?: Record<string, AgentInfo>, outputSchema: z.ZodSchema = z.string()) => {
  const handoverSchema = exitReasonHandOver(agents)

  return z.union([
    exitReasonSuccess.extend({
      result: outputSchema.describe('The result of the task'),
    }),
    exitReasonFailure,
    ...(handoverSchema ? [handoverSchema] : []),
  ])
}

type ExitReasonSuccess = z.infer<typeof exitReasonSuccess> & { result: any }
type ExitReasonFailure = z.infer<typeof exitReasonFailure>
type ExitReasonHandOver = z.infer<typeof exitReasonHandoverBase> & { agentName: string; context: any }
type ExitReason = ExitReasonSuccess | ExitReasonFailure | ExitReasonHandOver

export class PolkaAgent<TName extends string = string, TCtx extends z.ZodSchema = z.ZodSchema> {
  readonly options: AgentOptions<TName, TCtx>
  readonly agent: Agent

  constructor(options: AgentOptions<TName, TCtx>, polka: IPolka, callbacks: PolkaCallbacks) {
    this.options = options

    const tools = {} as Record<string, ReturnType<typeof createTool>>

    for (const [name, tool] of Object.entries(options.info.tools)) {
      let inputSchema = tool.inputSchema
      if (inputSchema && inputSchema instanceof z.ZodObject) {
        inputSchema = inputSchema.extend({
          reasoning: z.string().optional().describe('The reasoning for the tool use'),
        })
      }

      tools[name] = createTool({
        id: name,
        description: tool.description,
        inputSchema,
        outputSchema: tool.outputSchema,
        execute: async (input) => {
          await callbacks.onToolUse?.(name, input)
          return tool.execute(input, polka)
        },
      })
    }

    // TODO: manual control of memory
    this.agent = new Agent({
      name: options.info.name,
      instructions: options.info.systemPrompt,
      model: getModel(options.model),
      tools,
      memory: new Memory({
        options: {
          semanticRecall: false,
        },
      }),
    })
  }

  async startTask(task: string, options: { context?: z.infer<TCtx>; outputSchema?: z.ZodSchema } = {}): Promise<ExitReason> {
    let fullMessage = `<task>${task}</task>`
    if (options.context) {
      fullMessage += `\n<context>${await this.options.contextProvider(options.context)}</context>`
    }

    const resp = await this.agent.generate(task, {
      output: agentOutputSchema(this.options.agents, options.outputSchema),
    })

    return resp.object
  }
}

type GetSchema<TAgents extends Record<string, AgentOptions<any, any>>> = {
  [K in keyof TAgents]: TAgents[K]['info']['contextSchema']
}

export type PolkaCallbacks = {
  onStartTask?(agentName: string, task: string, context: any): Promise<void> | void
  onToolUse?(tool: string, args: any): Promise<void> | void
}

export class Polka<TAgents extends Record<string, AgentOptions<any, any>>> implements IPolka<GetSchema<TAgents>> {
  readonly #callbacks: PolkaCallbacks

  readonly agents: Record<keyof TAgents, PolkaAgent>
  readonly mastra: Mastra

  constructor(agents: TAgents, callbacks: PolkaCallbacks) {
    this.#callbacks = callbacks

    const mastraAgents: Record<string, Agent> = {}
    const obj: Record<string, PolkaAgent> = {}
    for (const [name, info] of Object.entries(agents)) {
      obj[name] = new PolkaAgent(info, this, callbacks)
    }
    this.agents = obj as Record<keyof TAgents, PolkaAgent>

    this.mastra = new Mastra({
      agents: mastraAgents,
    })
  }

  async startTask<TOutput extends z.ZodSchema = z.ZodString>(
    agentName: keyof TAgents,
    task: string,
    options: {
      context?: z.infer<TAgents[keyof TAgents]['info']['contextSchema']>
      outputSchema?: TOutput
    } = {},
  ): Promise<z.infer<TOutput> | { error: string }> {
    await this.#callbacks.onStartTask?.(agentName as string, task, options.context)

    const agent = this.agents[agentName]
    const resp = await agent.startTask(task, options)

    switch (resp.reason) {
      case 'success':
        return resp.result
      case 'failed':
        return {
          error: resp.message,
        }
      case 'handover':
        return await this.startTask(resp.agentName, resp.task, { context: resp.context, outputSchema: options.outputSchema })
    }
  }
}

export function createPolka<TAgents extends Record<string, AgentOptions<any, any>>>(
  agents: TAgents,
  callbacks: PolkaCallbacks = {},
): Polka<TAgents> {
  return new Polka<TAgents>(agents, callbacks)
}

export type GetAgentNames<T> = T extends Polka<infer TAgents> ? keyof TAgents : never
