import type { TodoItem, UpdateTodoItemInput, UpdateTodoItemOutput } from '@polka-codes/core'
import type { AgentToolRegistry, ToolSignature } from '@polka-codes/workflow'

type FileChange = { path: string; status: string }

export type CliToolRegistry = {
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
  getMemoryContext: ToolSignature<void, string>
  updateMemory: ToolSignature<
    | { operation: 'append'; topic?: string; content: string }
    | { operation: 'replace'; topic?: string; content: string }
    | { operation: 'remove'; topic?: string },
    void
  >
  listTodoItems: ToolSignature<{ id?: string | null; status?: 'open' | 'completed' | 'closed' | null }, TodoItem[]>
  getTodoItem: ToolSignature<{ id: string }, TodoItem | undefined>
  updateTodoItem: ToolSignature<UpdateTodoItemInput, UpdateTodoItemOutput>
} & AgentToolRegistry
