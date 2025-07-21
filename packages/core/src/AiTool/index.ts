import type { LanguageModelV2 } from '@ai-sdk/provider'
import { generateText } from 'ai'
import type { MultiAgent } from '../Agent'
import type { UsageMeter } from '../UsageMeter'
import { ToolResponseType } from '../tool'
import createNewProjectDef from './createNewProject'
import generateGitCommitMessageDef from './generateGitCommitMessage'
import generateGithubPullRequestDetailsDef from './generateGithubPullRequestDetails'
import generateProjectConfigDef from './generateProjectConfig'
import type { AiToolDefinition, GetInput, GetOutput } from './types'

export const executeTool = async <T extends AiToolDefinition<any, any>>(
  definition: T,
  ai: LanguageModelV2,
  params: GetInput<T>,
  usageMeter: UsageMeter,
): Promise<GetOutput<T>> => {
  const resp = await generateText({
    model: ai,
    system: definition.prompt,
    messages: [
      {
        role: 'user',
        content: definition.formatInput(params),
      },
    ],
  })

  usageMeter.addUsage(ai, resp)

  return definition.parseOutput(resp.text)
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
  return async (ai: LanguageModelV2, params: GetInput<T>, usageMeter: UsageMeter): Promise<GetOutput<T>> => {
    return executeTool(definition, ai, params, usageMeter)
  }
}

export const makeAgentTool = <T extends AiToolDefinition<any, any>>(definition: T) => {
  return async (agent: MultiAgent, params: GetInput<T>): Promise<GetOutput<T>> => {
    return executeAgentTool(definition, agent, params)
  }
}

export const generateGitCommitMessage = makeTool(generateGitCommitMessageDef)
export const generateGithubPullRequestDetails = makeTool(generateGithubPullRequestDetailsDef)
export const generateProjectConfig = makeAgentTool(generateProjectConfigDef)
export const createNewProject = makeAgentTool(createNewProjectDef)

export type { AiToolDefinition, GetInput, GetOutput }
