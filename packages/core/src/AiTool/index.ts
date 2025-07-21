import type { MultiAgent } from '../Agent'
import { ToolResponseType } from '../tool'
import createNewProjectDef from './createNewProject'
import generateProjectConfigDef from './generateProjectConfig'
import type { AiToolDefinition, GetInput, GetOutput } from './types'

export const executeAgentTool = async <T extends AiToolDefinition<any, any>>(
  definition: T,
  agent: MultiAgent,
  params: GetInput<T>,
): Promise<GetOutput<T>> => {
  if (!definition.agent) {
    throw new Error('Agent not specified')
  }

  const exitReason = await agent.startTask({
    agentName: definition.agent,
    task: definition.prompt,
    context: definition.formatInput(params),
  })

  // Check if we have a successful completion
  if (exitReason.type === ToolResponseType.Exit) {
    return definition.parseOutput(exitReason.message)
  }

  throw new Error(`Tool execution failed: ${exitReason.type}`)
}

export const makeAgentTool = <T extends AiToolDefinition<any, any>>(definition: T) => {
  return async (agent: MultiAgent, params: GetInput<T>): Promise<GetOutput<T>> => {
    return executeAgentTool(definition, agent, params)
  }
}

export const generateProjectConfig = makeAgentTool(generateProjectConfigDef)
export const createNewProject = makeAgentTool(createNewProjectDef)

export type { AiToolDefinition, GetInput, GetOutput }
