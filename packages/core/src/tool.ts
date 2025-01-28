export type ToolParameter = {
  name: string
  description: string
  required: boolean
  usageValue: string
}

export type ToolExample = {
  description: string
  parameters: { name: string; value: string }[]
}

export type ToolInfo = {
  name: string
  description: string
  parameters: ToolParameter[]
  examples?: ToolExample[]
}

export type FullToolInfo = ToolInfo & {
  handler: ToolHandler<ToolInfo, any>
  isAvailable: (provider: any) => boolean
}

export enum ToolResponseType {
  Reply = 'Reply',
  Exit = 'Exit',
  Invalid = 'Invalid',
  Error = 'Error',
  Interrupted = 'Interrupted',
  HandOver = 'HandOver',
}

// Reply to the tool use
export type ToolResponseReply = {
  type: ToolResponseType.Reply
  message: string
}

// Should end the message thread
// e.g. task completed successfully
export type ToolResponseExit = {
  type: ToolResponseType.Exit
  message: string
}

// The tool arguments are invalid
export type ToolResponseInvalid = {
  type: ToolResponseType.Invalid
  message: string
}

// Some error occurred when executing the tool
// e.g. network request error, IO error
export type ToolResponseError = {
  type: ToolResponseType.Error
  message: string
  // If true, the tool can be retried
  // e.g. network request error are generally retryable
  // but IO errors are not
  canRetry?: boolean
}

// The tool execution was interrupted
// e.g. user cancelled the tool execution
// or some security policy was violated
export type ToolResponseInterrupted = {
  type: ToolResponseType.Interrupted
  message: string
}

// Hand over the task to another agent
// e.g. hand over a coding task to the coder agent
export type ToolResponseHandOver = {
  type: ToolResponseType.HandOver
  agentName: string
  task: string
  context?: string
  files: string[]
}

export type ToolResponse =
  | ToolResponseReply
  | ToolResponseExit
  | ToolResponseInvalid
  | ToolResponseError
  | ToolResponseInterrupted
  | ToolResponseHandOver

export type ToolHandler<T extends ToolInfo, P> = (
  provider: P,
  args: Partial<Record<T['parameters'][number]['name'], string>>,
) => Promise<ToolResponse>

export const getAvailableTools = (provider: any, allTools: FullToolInfo[]) => {
  return allTools.filter((tool) => tool.isAvailable(provider))
}
