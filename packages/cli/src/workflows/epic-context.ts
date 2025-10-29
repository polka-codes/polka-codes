import { promises as fs } from 'node:fs'
import type { ProviderDataStore } from '@polka-codes/cli-shared'
import { type TodoItem, TodoItemSchema } from '@polka-codes/core'
import { parse, stringify } from 'yaml'
import { z } from 'zod'

export const EPIC_CONTEXT_FILE = '.epic.yml'

export const EpicContextSchema = z.object({
  task: z.string().nullish(),
  plan: z.string().nullish(),
  branchName: z.string().nullish(),
  todos: z.array(TodoItemSchema).nullish(),
  memory: z.record(z.string(), z.string()).nullish(),
})

export type EpicContext = z.infer<typeof EpicContextSchema>

export const saveEpicContext = async (context: EpicContext): Promise<void> => {
  const yamlString = stringify(context)
  await fs.writeFile(EPIC_CONTEXT_FILE, yamlString, 'utf-8')
}

export const loadEpicContext = async (): Promise<EpicContext> => {
  let fileContent: string
  try {
    fileContent = await fs.readFile(EPIC_CONTEXT_FILE, 'utf-8')
  } catch {
    // ignore read error
    return {}
  }
  try {
    const loaded = parse(fileContent)
    return EpicContextSchema.parse(loaded)
  } catch (error) {
    console.error('Error parsing epic context file:', EPIC_CONTEXT_FILE, error)
    return {}
  }
}

export class EpicMemoryStore implements ProviderDataStore<Record<string, string>> {
  #context: EpicContext

  constructor(context: EpicContext) {
    this.#context = context
  }

  async read(): Promise<Record<string, string>> {
    return this.#context.memory ?? {}
  }

  async write(data: Record<string, string>): Promise<void> {
    this.#context.memory = data
    await saveEpicContext(this.#context)
  }
}

export class EpicTodoItemStore implements ProviderDataStore<TodoItem[]> {
  #context: EpicContext

  constructor(context: EpicContext) {
    this.#context = context
  }

  async read(): Promise<TodoItem[]> {
    return this.#context.todos ?? []
  }

  async write(data: TodoItem[]): Promise<void> {
    this.#context.todos = data
    await saveEpicContext(this.#context)
  }
}
