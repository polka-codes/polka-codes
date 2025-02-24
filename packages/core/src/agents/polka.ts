import { Agent, Mastra, createTool } from '@mastra/core'
import { z } from 'zod'

import { Memory } from '@mastra/memory'
import { getModel } from './model'
import type { AgentInfo, IPolka, ModelConfig } from './types'

export interface AgentOptions<TName extends string = string, TCtx extends z.ZodSchema = z.ZodObject<any>> extends AgentInfo<TName, TCtx> {
  model: ModelConfig
  contextProvider: (context: z.infer<TCtx>) => Promise<string>
  agents?: Record<string, AgentOptions>
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

const exitReasonHandOver = (agents?: Record<string, AgentOptions>) => {
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

const agentOutputSchema = (agents?: Record<string, AgentOptions>, outputSchema: z.ZodSchema = z.string()) => {
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

export class PolkaAgent<TName extends string = string, TCtx extends z.ZodSchema = z.ZodObject<any>> {
  readonly info: AgentOptions<TName, TCtx>
  readonly agent: Agent

  constructor(info: AgentOptions<TName, TCtx>, polka: IPolka) {
    this.info = info

    const tools = {} as Record<string, ReturnType<typeof createTool>>

    for (const [name, tool] of Object.entries(info.tools)) {
      tools[name] = createTool({
        id: name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
        execute: async (input) => {
          return tool.execute(input, polka)
        },
      })
    }

    this.agent = new Agent({
      name: info.name,
      instructions: info.systemPrompt,
      model: getModel(info.model),
      tools,
    })
  }

  async startTask(task: string, options: { context?: z.infer<TCtx>; outputSchema?: z.ZodSchema } = {}): Promise<ExitReason> {
    let fullMessage = `<task>${task}</task>`
    if (options.context) {
      fullMessage += `\n<context>${await this.info.contextProvider(options.context)}</context>`
    }

    const resp = await this.agent.generate(task, {
      output: agentOutputSchema(this.info.agents, options.outputSchema),
    })

    return resp.object
  }
}

export class Polka<TAgents extends Record<string, AgentOptions> = Record<string, AgentOptions>> implements IPolka<TAgents> {
  readonly agents: Record<keyof TAgents, PolkaAgent>
  readonly mastra: Mastra

  constructor(agents: TAgents) {
    const mastraAgents: Record<string, Agent> = {}
    const obj: Record<string, PolkaAgent> = {}
    for (const [name, info] of Object.entries(agents)) {
      obj[name] = new PolkaAgent(info, this)
    }
    this.agents = obj as Record<keyof TAgents, PolkaAgent>

    // TODO: manual control of the memory
    this.mastra = new Mastra({
      agents: mastraAgents,
      memory: new Memory({
        options: {
          semanticRecall: false,
        },
      }),
    })
  }

  async startTask<TOutput extends z.ZodSchema = z.ZodString>(
    agentName: keyof TAgents,
    task: string,
    options: {
      context?: z.infer<TAgents[keyof TAgents]['contextSchema']>
      outputSchema?: TOutput
    } = {},
  ): Promise<z.infer<TOutput> | { error: string }> {
    const agent = this.agents[agentName]
    const resp = await agent.startTask(task, options.context)

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

export type GetAgentNames<T> = T extends Polka<infer TAgents> ? keyof TAgents : never
