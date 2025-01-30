export type FilesystemProvider = {
  readFile?: (path: string) => Promise<string>
  writeFile?: (path: string, content: string) => Promise<void>
  removeFile?: (path: string) => Promise<void>
  listFiles?: (path: string, recursive: boolean, maxCount: number) => Promise<[string[], boolean]>
  searchFiles?: (path: string, regex: string, filePattern: string) => Promise<string[]>
  listCodeDefinitionNames?: (path: string) => Promise<string[]>
}

export type CommandProvider = {
  executeCommand?: (command: string, needApprove: boolean) => Promise<{ stdout: string; stderr: string; exitCode: number }>
}

export type InteractionProvider = {
  askFollowupQuestion?: (question: string, options: string[]) => Promise<string>
  attemptCompletion?: (result: string) => Promise<string | undefined>
}

export type ToolProvider = FilesystemProvider & CommandProvider & InteractionProvider

export class MockProvider implements ToolProvider {
  async readFile(path: string): Promise<string> {
    return 'mock content'
  }

  async writeFile(path: string, content: string): Promise<void> {
    return
  }

  async removeFile(path: string): Promise<void> {
    return
  }

  async listFiles(path: string, recursive: boolean, maxCount: number): Promise<[string[], boolean]> {
    return [['mock-file.txt'], false]
  }

  async searchFiles(path: string, regex: string, filePattern: string): Promise<string[]> {
    return ['mock-file.txt']
  }

  async listCodeDefinitionNames(path: string): Promise<string[]> {
    return ['mockDefinition']
  }

  async executeCommand(command: string, needApprove: boolean): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return { stdout: 'mock output', stderr: '', exitCode: 0 }
  }

  async askFollowupQuestion(question: string, options?: string[]): Promise<string> {
    return 'mock answer'
  }

  async attemptCompletion(result: string): Promise<string | undefined> {
    return 'mock completion'
  }
}
