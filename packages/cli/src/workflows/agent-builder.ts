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
  type WorkflowContext,
  writeToFile,
} from '@polka-codes/core'
import type { z } from 'zod'
import type { CliToolRegistry } from '../workflow-tools'

// Re-export with proper type
type CliWorkflowContext = WorkflowContext<CliToolRegistry>

export interface AgentToolConfig {
  includeInteractive?: boolean
  additionalTools?: {
    search?: FullToolInfo
    mcpTools?: FullToolInfo[]
  }
}

/**
 * Build a standardized list of agent tools
 */
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
  maxToolRoundTrips?: number
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
      maxToolRoundTrips: options.maxToolRoundTrips,
      model: options.model,
    },
    context,
  )

  if (result.type !== 'Exit' || !result.object) {
    const errorMessage =
      result.type === 'Error'
        ? result.error?.message || 'Unknown error'
        : result.type === 'UsageExceeded'
          ? 'Usage exceeded (tokens or rounds)'
          : `Unexpected result type: ${result.type}`

    throw new Error(`Agent workflow failed: ${errorMessage}`)
  }

  return result.object as z.infer<T>
}

/**
 * Options for running an agent workflow without schema validation
 */
export interface RunAgentOptions {
  systemPrompt: string
  userMessage: string
  tools?: FullToolInfo[]
  toolConfig?: AgentToolConfig
  maxToolRoundTrips?: number
  model?: string
}

/**
 * Wrapper for agent workflow without schema validation
 */
export async function runAgent(context: CliWorkflowContext, options: RunAgentOptions): Promise<string> {
  const tools = options.tools || buildAgentToolList(options.toolConfig)

  const result = await agentWorkflow(
    {
      systemPrompt: options.systemPrompt,
      userMessage: [{ role: 'user', content: options.userMessage }],
      tools,
      maxToolRoundTrips: options.maxToolRoundTrips,
      model: options.model,
    },
    context,
  )

  if (result.type !== 'Exit') {
    const errorMessage =
      result.type === 'Error'
        ? result.error?.message || 'Unknown error'
        : result.type === 'UsageExceeded'
          ? 'Usage exceeded (tokens or rounds)'
          : `Unexpected result type: ${(result as { type: string }).type}`

    throw new Error(`Agent workflow failed: ${errorMessage}`)
  }

  return result.message
}

/**
 * Continue an agent workflow with existing messages
 */
export interface ContinueAgentOptions {
  messages: JsonModelMessage[]
  tools?: FullToolInfo[]
  toolConfig?: AgentToolConfig
  maxToolRoundTrips?: number
  model?: string
}

/**
 * Continue an agent workflow with existing message history
 */
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
      maxToolRoundTrips: options.maxToolRoundTrips,
      model: options.model,
    },
    context,
  )

  if (result.type !== 'Exit') {
    const errorMessage =
      result.type === 'Error'
        ? result.error?.message || 'Unknown error'
        : result.type === 'UsageExceeded'
          ? 'Usage exceeded (tokens or rounds)'
          : `Unexpected result type: ${(result as { type: string }).type}`

    throw new Error(`Agent workflow failed: ${errorMessage}`)
  }

  return {
    message: result.message,
    messages: result.messages,
  }
}
