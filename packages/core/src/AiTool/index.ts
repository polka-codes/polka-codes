import type { LanguageModelV2 } from '@ai-sdk/provider'
import { generateText } from 'ai'
import type { MultiAgent, SharedAgentOptions } from '../Agent'
import { ToolResponseType } from '../tool'
import type { UsageMeter } from '../UsageMeter'
import createNewProjectDef from './createNewProject'
import generateGitCommitMessageDef from './generateGitCommitMessage'
import generateGithubPullRequestDetailsDef from './generateGithubPullRequestDetails'
import generateProjectConfigDef from './generateProjectConfig'
import reviewDiffDef from './reviewDiff'

import type { AiToolDefinition, AiToolDefinitionWithAgent, AiToolDefinitionWithMultiAgent, GetInput, GetOutput } from './types'

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

export const executeMultiAgentTool = async <T extends AiToolDefinitionWithMultiAgent<any, any>>(
  definition: T,
  agent: MultiAgent,
  params: GetInput<T>,
): Promise<GetOutput<T>> => {
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

export const executeAgentTool = async <T extends AiToolDefinitionWithAgent<any, any>>(
  definition: T,
  options: SharedAgentOptions,
  params: GetInput<T>,
): Promise<GetOutput<T>> => {
  const agent = definition.agent(options)
  const exitReason = await agent.start(`${definition.prompt}\n\n${definition.formatInput(params)}`)

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

export const makeMultiAgentTool = <T extends AiToolDefinitionWithMultiAgent<any, any>>(definition: T) => {
  return async (agent: MultiAgent, params: GetInput<T>): Promise<GetOutput<T>> => {
    return executeMultiAgentTool(definition, agent, params)
  }
}

export const makeAgentTool = <T extends AiToolDefinitionWithAgent<any, any>>(definition: T) => {
  return async (options: SharedAgentOptions, params: GetInput<T>): Promise<GetOutput<T>> => {
    return executeAgentTool(definition, options, params)
  }
}

export const generateGitCommitMessage = makeTool(generateGitCommitMessageDef)
export const generateGithubPullRequestDetails = makeTool(generateGithubPullRequestDetailsDef)

export const reviewDiff = makeAgentTool(reviewDiffDef)
export const generateProjectConfig = makeMultiAgentTool(generateProjectConfigDef)
export const createNewProject = makeMultiAgentTool(createNewProjectDef)

export type { AiToolDefinition, GetInput, GetOutput }
