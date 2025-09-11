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
  attemptCompletion?: (result: string) => Promise<string | undefined>
}

export type WebProvider = {
  fetchUrl?: (url: string) => Promise<string>
}

export type ToolProvider = FilesystemProvider & CommandProvider & InteractionProvider & WebProvider

export class MockProvider implements ToolProvider {
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

  async attemptCompletion(_result: string): Promise<string | undefined> {
    return 'mock completion'
  }
}
