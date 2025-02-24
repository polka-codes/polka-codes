import { z } from 'zod'

import { type AgentInfo, agentTool } from '../types'

export const delegateTool = (agents: AgentInfo[]) => {
  const agentInputSchemas = agents.map((agent) =>
    z.object({
      agentName: z.literal(agent.name),
      task: z.string().describe('The task to be completed by the target agent'),
      ...(agent.contextSchema ? { context: agent.contextSchema.describe('The context information for the task') } : {}),
    }),
  )

  let inputSchema: z.ZodSchema
  if (agents.length === 0) {
    throw new Error('At least one agent is required to delegate a task')
  }
  if (agents.length === 1) {
    inputSchema = agentInputSchemas[0]
  } else {
    inputSchema = z.union(agentInputSchemas as any)
  }

  return agentTool({
    id: 'delegate',
    description: 'Delegate a task to another agent to execute and receive the result back',
    inputSchema: inputSchema.describe('The input for the task'),
    outputSchema: z.object({
      status: z.enum(['success', 'failure']).describe('The status of the task'),
      output: z.string().describe('The output of the task'),
    }),
    execute: async (input, polka) => {
      try {
        const result = await polka.startTask(input.agentName, input.task, input.context)
        if (typeof result === 'string') {
          return {
            status: 'success' as const,
            output: result,
          }
        }
        return {
          status: 'failure' as const,
          output: result.error,
        }
      } catch (error: any) {
        return {
          status: 'failure' as const,
          output: 'message' in error ? error.message : (error?.toString() ?? JSON.stringify(error)),
        }
      }
    },
  })
}
