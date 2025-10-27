import type { TodoItem, UpdateTodoItemInput, UpdateTodoItemOutput } from './todo'

export type FilesystemProvider = {
  readFile?: (path: string, includeIgnored: boolean) => Promise<string | undefined>
  writeFile?: (path: string, content: string) => Promise<void>
  removeFile?: (path: string) => Promise<void>
  renameFile?: (sourcePath: string, targetPath: string) => Promise<void>
  listFiles?: (path: string, recursive: boolean, maxCount: number, includeIgnored: boolean) => Promise<[string[], boolean]>
  searchFiles?: (path: string, regex: string, filePattern: string) => Promise<string[]>
  readBinaryFile?: (url: string) => Promise<{
    base64Data: string
    mediaType: string
  }>
}

export type CommandProvider = {
  executeCommand?: (
    command: string,
    needApprove: boolean,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number; summary?: string }>
}

export type InteractionProvider = {
  askFollowupQuestion?: (question: string, options: string[]) => Promise<string>
}

export type WebProvider = {
  fetchUrl?: (url: string) => Promise<string>
}

export interface MemoryProvider {
  listMemoryTopics: () => Promise<string[]>
  readMemory: (topic?: string) => Promise<string | undefined>
  updateMemory: (operation: 'append' | 'replace' | 'remove', topic: string | undefined, content: string | undefined) => Promise<void>
}

export type ListTodoItemsOutput = Pick<TodoItem, 'id' | 'title' | 'status'>[]

export type GetTodoItemOutput = TodoItem & {
  subItems: {
    id: string
    title: string
  }[]
}

export type TodoProvider = {
  listTodoItems: (id?: string | null) => Promise<ListTodoItemsOutput>
  getTodoItem: (id: string) => Promise<GetTodoItemOutput>
  updateTodoItem: (input: UpdateTodoItemInput) => Promise<UpdateTodoItemOutput>
}

export type ToolProvider = FilesystemProvider &
  CommandProvider &
  InteractionProvider &
  WebProvider &
  Partial<MemoryProvider> &
  Partial<TodoProvider>

export class MockProvider implements ToolProvider {
  async listTodoItems(id?: string | null) {
    if (id) {
      return [{ id: `${id}-1`, title: 'mock sub item', status: 'open' as const }]
    }
    return [{ id: '1', title: 'mock item', status: 'open' as const }]
  }

  async getTodoItem(id: string) {
    return {
      id,
      title: 'mock item',
      description: 'mock desc',
      relevantFileList: [],
      status: 'open' as const,
      subItems: [],
    }
  }

  async updateTodoItem(input: UpdateTodoItemInput) {
    if (input.operation === 'add') {
      return { id: '2' }
    }
    return { id: input.id as string }
  }
  async readFile(_path: string, _includeIgnored?: boolean): Promise<string> {
    return 'mock content'
  }

  async writeFile(_path: string, _content: string): Promise<void> {
    return
  }

  async removeFile(_path: string): Promise<void> {
    return
  }

  async renameFile(_sourcePath: string, _targetPath: string): Promise<void> {
    return
  }

  async listFiles(_path: string, _recursive: boolean, _maxCount: number, _includeIgnored?: boolean): Promise<[string[], boolean]> {
    return [['mock-file.txt'], false]
  }

  async searchFiles(_path: string, _regex: string, _filePattern: string): Promise<string[]> {
    return ['mock-file.txt']
  }

  async executeCommand(
    _command: string,
    _needApprove: boolean,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; summary?: string }> {
    return { stdout: 'mock output', stderr: '', exitCode: 0 }
  }

  async askFollowupQuestion(_question: string, _options?: string[]): Promise<string> {
    return 'mock answer'
  }

  async listMemoryTopics(): Promise<string[]> {
    return ['default']
  }

  async readMemory(_topic?: string): Promise<string | undefined> {
    return 'mock memory content'
  }

  async updateMemory(_operation: 'append' | 'replace' | 'remove', _topic?: string, _content?: string): Promise<void> {
    return
  }
}
