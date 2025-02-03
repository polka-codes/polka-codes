import { MultiAgent } from '../Agent'
import type { AiServiceBase, ApiUsage } from '../AiService'
import { ToolResponseType } from '../tool'
import generateGitCommitMessageDef from './generateGitCommitMessage'
import generateGithubPullRequestDetailsDef from './generateGithubPullRequestDetails'
import generateProjectConfigDef from './generateProjectConfig'
import type { AiToolDefinition, GetInput, GetOutput } from './types'

export const executeTool = async <T extends AiToolDefinition<any, any>>(
  definition: T,
  ai: AiServiceBase | MultiAgent,
  params: GetInput<T>,
): Promise<{ response: GetOutput<T>; usage: ApiUsage }> => {
  if (ai instanceof MultiAgent && definition.agent) {
    const [exitReason, taskInfo] = await ai.startTask({
      agentName: definition.agent,
      task: definition.formatInput(params),
      context: definition.prompt,
    })

    // Check if we have a successful completion
    const isSuccess = typeof exitReason === 'object' && 'type' in exitReason && exitReason.type === ToolResponseType.Exit
    if (isSuccess) {
      return {
        response: definition.parseOutput(exitReason.message),
        usage: ai.usage,
      }
    }

    throw new Error(`Tool execution failed: ${JSON.stringify(exitReason)}`)
  }

  const { response, usage } = await (ai as AiServiceBase).request(definition.prompt, [
    { role: 'user', content: definition.formatInput(params) },
  ])
  return {
    response: definition.parseOutput(response),
    usage,
  }
}

export const makeTool = <T extends AiToolDefinition<any, any>>(definition: T) => {
  return async (ai: AiServiceBase | MultiAgent, params: GetInput<T>): Promise<{ response: GetOutput<T>; usage: ApiUsage }> => {
    return executeTool(definition, ai, params)
  }
}

export const generateGitCommitMessage = makeTool(generateGitCommitMessageDef)
export const generateGithubPullRequestDetails = makeTool(generateGithubPullRequestDetailsDef)
export const generateProjectConfig = makeTool(generateProjectConfigDef)

export type { AiToolDefinition, GetInput, GetOutput }
