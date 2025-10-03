import type { ToolSignature } from '@polka-codes/workflow'
import type { InvokeAgentInput } from '@polka-codes/workflow/src/tools/invokeAgent'

type FileChange = { path: string; status: string }

export type WorkflowTools = {
  invokeAgent: ToolSignature<InvokeAgentInput<any>, any>
  createPullRequest: ToolSignature<{ title: string; description: string }, { title: string; description: string }>
  createCommit: ToolSignature<{ message: string }, { message: string }>
  printChangeFile: ToolSignature<Record<string, never>, { stagedFiles: FileChange[]; unstagedFiles: FileChange[] }>
  confirm: ToolSignature<{ message: string }, boolean>
}
