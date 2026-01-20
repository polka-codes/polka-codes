/**
 * CLI Tool Registry Type Definitions
 *
 * This file defines the CliToolRegistry which extends AgentToolRegistry with
 * CLI-specific tools. The tools are organized by domain:
 *
 * - **Git Operations**: createCommit, printChangeFile
 * - **User Interaction**: confirm, input, select
 * - **File Operations**: readFile, writeToFile
 * - **Command Execution**: executeCommand
 * - **Memory Management**: getMemoryContext, readMemory, listMemoryTopics, updateMemory
 * - **Todo Management**: listTodoItems, getTodoItem, updateTodoItem
 * - **Remote Operations**: createPullRequest, runAgent
 *
 * The AgentToolRegistry (from @polka-codes/core) provides additional tools like:
 * - replaceInFile, searchFiles, listFiles
 * - generateText, invokeTool
 * - And more...
 */

import type {
  AgentToolRegistry,
  AgentWorkflowInput,
  ExitReason,
  TodoItem,
  ToolSignature,
  UpdateTodoItemInput,
  UpdateTodoItemOutput,
} from '@polka-codes/core'

type FileChange = { path: string; status: string }

/**
 * CLI-specific tool signatures
 *
 * These tools extend the base AgentToolRegistry with CLI-specific functionality.
 * Tools are grouped by domain for better discoverability.
 */
export type CliToolRegistry = {
  // === Git Operations ===
  createCommit: ToolSignature<{ message: string }, { message: string }>
  printChangeFile: ToolSignature<void, { stagedFiles: FileChange[]; unstagedFiles: FileChange[] }>

  // === User Interaction ===
  confirm: ToolSignature<{ message: string; default: false }, boolean>
  input: ToolSignature<{ message: string; default?: string }, string>
  select: ToolSignature<{ message: string; choices: { name: string; value: string }[] }, string>

  // === File Operations ===
  readFile: ToolSignature<{ path: string }, string | null>
  writeToFile: ToolSignature<{ path: string; content: string }, void>

  // === Command Execution ===
  executeCommand: ToolSignature<
    { command: string; pipe?: boolean } & ({ args: string[]; shell?: false } | { shell: true }),
    { exitCode: number; stdout: string; stderr: string }
  >

  // === Memory Management ===
  getMemoryContext: ToolSignature<void, string>
  readMemory: ToolSignature<{ topic?: string }, string>
  listMemoryTopics: ToolSignature<void, string[]>
  updateMemory: ToolSignature<
    | { operation: 'append'; topic?: string; content: string }
    | { operation: 'replace'; topic?: string; content: string }
    | { operation: 'remove'; topic?: string },
    void
  >

  // === Todo Management ===
  listTodoItems: ToolSignature<{ id?: string | null; status?: 'open' | 'completed' | 'closed' | null }, TodoItem[]>
  getTodoItem: ToolSignature<{ id: string }, TodoItem | undefined>
  updateTodoItem: ToolSignature<UpdateTodoItemInput, UpdateTodoItemOutput>

  // === Remote Operations ===
  createPullRequest: ToolSignature<{ title: string; description: string }, { title: string; description: string }>
  runAgent: ToolSignature<AgentWorkflowInput, ExitReason>
} & AgentToolRegistry
