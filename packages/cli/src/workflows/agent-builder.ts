import type { FullToolInfo, JsonModelMessage } from '@polka-codes/core'
import {
  agentWorkflow,
  askFollowupQuestion,
  fetchUrl,
  listFiles,
  readBinaryFile,
  readFile,
  removeFile,
  renameFile,
  replaceInFile,
  searchFiles,
  writeToFile,
} from '@polka-codes/core'
import type { z } from 'zod'
import type { CliWorkflowContext } from '../agent/types'

export interface AgentToolConfig {
  includeInteractive?: boolean
  additionalTools?: {
    search?: FullToolInfo
    mcpTools?: FullToolInfo[]
  }
}

export function buildAgentToolList(config: AgentToolConfig = {}): FullToolInfo[] {
  const tools: FullToolInfo[] = [
    readFile,
    writeToFile,
    replaceInFile,
    searchFiles,
    listFiles,
    fetchUrl,
    readBinaryFile,
    removeFile,
    renameFile,
  ]

  if (config.includeInteractive) {
    tools.push(askFollowupQuestion)
  }

  if (config.additionalTools?.search) {
    tools.push(config.additionalTools.search)
  }

  if (config.additionalTools?.mcpTools) {
    tools.push(...config.additionalTools.mcpTools)
  }

  return tools
}

/**
 * Options for running an agent workflow
 */
export interface RunAgentWithSchemaOptions<T extends z.ZodSchema> {
  systemPrompt: string
  userMessage: string
  schema: T
  tools?: FullToolInfo[]
  toolConfig?: AgentToolConfig
  maxStructuredOutputRepairAttempts?: number
  model?: string
}

/**
 * Typed wrapper for agent workflow that ensures schema validation
 * and provides consistent error handling.
 */
export async function runAgentWithSchema<T extends z.ZodSchema>(
  context: CliWorkflowContext,
  options: RunAgentWithSchemaOptions<T>,
): Promise<z.infer<T>> {
  const tools = options.tools || buildAgentToolList(options.toolConfig)

  const result = await agentWorkflow(
    {
      systemPrompt: options.systemPrompt,
      userMessage: [{ role: 'user', content: options.userMessage }],
      tools,
      outputSchema: options.schema,
      maxStructuredOutputRepairAttempts: options.maxStructuredOutputRepairAttempts,
      model: options.model,
    },
    context,
  )

  if (result.type === 'Error') {
    throw new Error(`Agent workflow failed: ${result.error.message || 'Unknown error'}`)
  }
  if (!result.object) {
    throw new Error('Agent workflow failed: structured output was missing.')
  }

  return result.object as z.infer<T>
}

export interface RunAgentOptions {
  systemPrompt: string
  userMessage: string
  tools?: FullToolInfo[]
  toolConfig?: AgentToolConfig
  maxStructuredOutputRepairAttempts?: number
  model?: string
}

export async function runAgent(context: CliWorkflowContext, options: RunAgentOptions): Promise<string> {
  const tools = options.tools || buildAgentToolList(options.toolConfig)

  const result = await agentWorkflow(
    {
      systemPrompt: options.systemPrompt,
      userMessage: [{ role: 'user', content: options.userMessage }],
      tools,
      maxStructuredOutputRepairAttempts: options.maxStructuredOutputRepairAttempts,
      model: options.model,
    },
    context,
  )

  if (result.type !== 'Exit') {
    throw new Error(`Agent workflow failed: ${result.error?.message || 'Unknown error'}`)
  }

  return result.message
}

export interface ContinueAgentOptions {
  messages: JsonModelMessage[]
  tools?: FullToolInfo[]
  toolConfig?: AgentToolConfig
  maxStructuredOutputRepairAttempts?: number
  model?: string
}

export async function continueAgent(
  context: CliWorkflowContext,
  options: ContinueAgentOptions,
): Promise<{ message: string; messages: JsonModelMessage[] }> {
  const tools = options.tools || buildAgentToolList(options.toolConfig)

  const result = await agentWorkflow(
    {
      messages: options.messages,
      userMessage: [{ role: 'user', content: '' }], // Dummy message, will use messages instead
      tools,
      maxStructuredOutputRepairAttempts: options.maxStructuredOutputRepairAttempts,
      model: options.model,
    },
    context,
  )

  if (result.type !== 'Exit') {
    throw new Error(`Agent workflow failed: ${result.error?.message || 'Unknown error'}`)
  }

  return {
    message: result.message,
    messages: result.messages,
  }
}
