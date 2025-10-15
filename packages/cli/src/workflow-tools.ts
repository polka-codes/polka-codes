import type { AgentNameType, FullToolInfoV2 } from '@polka-codes/core'
import type { AgentToolRegistry, ToolSignature } from '@polka-codes/workflow'
import type z from 'zod'

type InvokeAgentInput<T> = {
  agent: AgentNameType
  messages: (
    | string
    | {
        type: 'system' | 'user' | 'assistant'
        content: string
      }
  )[]
  outputSchema?: z.ZodSchema<T>
  tools?: FullToolInfoV2[]
  context?: string
  defaultContext?: boolean
}

type InvokeAgentOutput<T> = {
  output: T
  messages: any[]
}

export type InvokeAgentTool = ToolSignature<InvokeAgentInput<any>, InvokeAgentOutput<any>>

type FileChange = { path: string; status: string }

export type CliToolRegistry = {
  invokeAgent: InvokeAgentTool
  createPullRequest: ToolSignature<{ title: string; description: string }, { title: string; description: string }>
  createCommit: ToolSignature<{ message: string }, { message: string }>
  printChangeFile: ToolSignature<void, { stagedFiles: FileChange[]; unstagedFiles: FileChange[] }>
  confirm: ToolSignature<{ message: string; default: false }, boolean>
  input: ToolSignature<{ message: string; default?: string }, string>
  select: ToolSignature<{ message: string; choices: { name: string; value: string }[] }, string>
  writeToFile: ToolSignature<{ path: string; content: string }, void>
  readFile: ToolSignature<{ path: string }, string | null>
  executeCommand: ToolSignature<
    { command: string; pipe?: boolean } & ({ args: string[]; shell?: false } | { shell: true }),
    { exitCode: number; stdout: string; stderr: string }
  >
} & AgentToolRegistry
