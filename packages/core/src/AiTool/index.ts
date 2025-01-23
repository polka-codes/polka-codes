import type { AiServiceBase, ApiUsage } from '../AiService'
import generateGitCommitMessageDef from './generateGitCommitMessage'
import type { AiToolDefinition, GetInput, GetOutput } from './types'

export const executeTool = async <T extends AiToolDefinition<any, any>>(
  definition: T,
  ai: AiServiceBase,
  params: GetInput<T>,
): Promise<{ response: GetOutput<T>; usage: ApiUsage }> => {
  const { response, usage } = await ai.request(definition.prompt, [{ role: 'user', content: definition.formatInput(params) }])
  return {
    response: definition.parseOutput(response),
    usage,
  }
}

export const makeTool = <T extends AiToolDefinition<any, any>>(definition: T) => {
  return async (ai: AiServiceBase, params: GetInput<T>): Promise<{ response: GetOutput<T>; usage: ApiUsage }> => {
    return executeTool(definition, ai, params)
  }
}

export const generateGitCommitMessage = makeTool(generateGitCommitMessageDef)

export type { AiToolDefinition, GetInput, GetOutput }
