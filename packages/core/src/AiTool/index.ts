import { MultiAgent } from '../Agent'
import type { AiServiceBase, ApiUsage, MessageParam } from '../AiService'
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
  if (ai instanceof MultiAgent && definition.preferredAgent) {
    const [exitReason, taskInfo] = await ai.startTask({
      agentName: definition.preferredAgent,
      task: definition.formatInput(params),
      context: definition.prompt,
    })

    if (taskInfo.messages.length > 0) {
      const lastMessage = taskInfo.messages[taskInfo.messages.length - 1] as MessageParam
      const content = lastMessage.content
      if (typeof content !== 'string') {
        throw new Error('Expected string content in agent response')
      }

      // Check if we have a successful completion
      const isSuccess = typeof exitReason === 'object' && 'type' in exitReason && exitReason.type === ToolResponseType.Exit
      if (isSuccess) {
        return {
          response: definition.parseOutput(content),
          usage: ai.usage,
        }
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
