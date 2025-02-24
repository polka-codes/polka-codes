import type { MultiAgent } from '../Agent'
import type { AiServiceBase, ApiUsage } from '../AiService'
import { ToolResponseType } from '../tool'
import createNewProjectDef from './createNewProject'
import generateGithubPullRequestDetailsDef from './generateGithubPullRequestDetails'
import generateProjectConfigDef from './generateProjectConfig'
import type { AiToolDefinition, GetInput, GetOutput } from './types'

export const executeTool = async <T extends AiToolDefinition<any, any>>(
  definition: T,
  ai: AiServiceBase,
  params: GetInput<T>,
): Promise<{ response: GetOutput<T>; usage: ApiUsage }> => {
  const { response, usage } = await (ai as AiServiceBase).request(definition.prompt, [
    { role: 'user', content: definition.formatInput(params) },
  ])
  return {
    response: definition.parseOutput(response),
    usage,
  }
}

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

export const makeTool = <T extends AiToolDefinition<any, any>>(definition: T) => {
  return async (ai: AiServiceBase, params: GetInput<T>): Promise<{ response: GetOutput<T>; usage: ApiUsage }> => {
    return executeTool(definition, ai, params)
  }
}

export const makeAgentTool = <T extends AiToolDefinition<any, any>>(definition: T) => {
  return async (agent: MultiAgent, params: GetInput<T>): Promise<GetOutput<T>> => {
    return executeAgentTool(definition, agent, params)
  }
}

export const generateGithubPullRequestDetails = makeTool(generateGithubPullRequestDetailsDef)
export const generateProjectConfig = makeAgentTool(generateProjectConfigDef)
export const createNewProject = makeAgentTool(createNewProjectDef)

export type { AiToolDefinition, GetInput, GetOutput }
