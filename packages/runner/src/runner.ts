import { execSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { getProvider, type LoadedConfig, loadConfig } from '@polka-codes/cli-shared'
import {
  executeCommand,
  type FullToolInfo,
  listFiles,
  readBinaryFile,
  readFile,
  removeFile,
  renameFile,
  replaceInFile,
  responsePrompts,
  searchFiles,
  type ToolResponseResult,
  writeToFile,
} from '@polka-codes/core'
import { executeRunnerCommands } from './commands'
import type { UserContent, WsIncomingMessage } from './types'
import { WebSocketManager } from './WebSocketManager'

type RunnerMediaSource = { type: 'base64'; data: string } | { type: 'url'; url: string }

function toRunnerMediaSource(data: unknown): RunnerMediaSource | undefined {
  if (typeof data === 'string') return { type: 'base64', data }
  if (data instanceof URL) return { type: 'url', url: data.toString() }
  if (data instanceof Uint8Array) {
    return { type: 'base64', data: Buffer.from(data).toString('base64') }
  }
  if (data instanceof ArrayBuffer) {
    return { type: 'base64', data: Buffer.from(new Uint8Array(data)).toString('base64') }
  }
  if (!data || typeof data !== 'object' || !('type' in data)) return undefined
  if (data.type === 'data' && 'data' in data) return toRunnerMediaSource(data.data)
  if (data.type === 'url' && 'url' in data) {
    return typeof data.url === 'string' ? { type: 'url', url: data.url } : toRunnerMediaSource(data.url)
  }
  if (data.type === 'text' && 'text' in data && typeof data.text === 'string') {
    return { type: 'base64', data: Buffer.from(data.text).toString('base64') }
  }
  return undefined
}

export function formatRunnerToolResponse(tool: string, result: ToolResponseResult): Exclude<UserContent, string> {
  const compatibleResult: ToolResponseResult =
    result.type === 'content'
      ? {
          ...result,
          value: result.value.map((part) =>
            part.type === 'image-url' || part.type === 'file-url' ? { type: 'text' as const, text: `<media url="${part.url}" />` } : part,
          ),
        }
      : result

  return responsePrompts.toolResults(tool, compatibleResult).map((part) => {
    switch (part.type) {
      case 'text':
        return part
      case 'image': {
        const source = toRunnerMediaSource(part.image)
        return source
          ? { type: 'image', mediaType: part.mediaType, source }
          : { type: 'text', text: `<media media-type="${part.mediaType ?? 'image'}" />` }
      }
      case 'file': {
        const source = toRunnerMediaSource(part.data)
        return source
          ? { type: 'file', mediaType: part.mediaType, filename: part.filename, source }
          : { type: 'text', text: `<media media-type="${part.mediaType}" />` }
      }
      default:
        return { type: 'text', text: JSON.stringify(part) }
    }
  })
}

export interface RunnerOptions {
  taskId: string
  sessionToken: string
  githubToken: string
  api: string
}

export class Runner {
  #commandFailed = false
  private wsManager: WebSocketManager
  private provider: ReturnType<typeof getProvider>
  private availableTools: Record<string, FullToolInfo>

  constructor(
    private options: RunnerOptions,
    config: LoadedConfig | undefined,
  ) {
    // Create provider
    this.provider = getProvider({
      command: {
        onStarted(command) {
          console.log(`$ >>>> $ ${command}`)
        },
        onStdout(data) {
          process.stdout.write(data)
        },
        onStderr(data) {
          process.stderr.write(data)
        },
        onExit(code) {
          console.log(`$ <<<< $ Command exited with code: ${code}`)
        },
        onError(error) {
          console.log(`$ <<<< $ Command error: ${error}`)
        },
      },
      excludeFiles: config?.excludeFiles,
    })

    // Define available tools
    this.availableTools = {
      [executeCommand.name]: executeCommand,
      [listFiles.name]: listFiles,
      [readBinaryFile.name]: readBinaryFile,
      [readFile.name]: readFile,
      [removeFile.name]: removeFile,
      [renameFile.name]: renameFile,
      [replaceInFile.name]: replaceInFile,
      [searchFiles.name]: searchFiles,
      [writeToFile.name]: writeToFile,
    }

    // Initialize WebSocket manager
    this.wsManager = new WebSocketManager({
      taskId: options.taskId,
      sessionToken: options.sessionToken,
      githubToken: options.githubToken,
      apiUrl: options.api,
      onMessage: this.handleMessage.bind(this),
    })
  }

  /**
   * Start the runner
   */
  public start(): void {
    console.log('Runner initialized with:')
    console.log(`  API URL: ${this.options.api}`)
    console.log(`  Task ID: ${this.options.taskId}`)

    // Connect to WebSocket server
    this.wsManager.connect()
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(message: WsIncomingMessage): Promise<void> {
    switch (message.type) {
      case 'pending_tools':
        await this.handlePendingTools(message)
        break
      case 'get_files':
        await this.handleGetFiles()
        break
      case 'done':
        this.handleDone()
        break
    }
  }

  /**
   * Handle pending tools message
   */
  private async handlePendingTools(message: Extract<WsIncomingMessage, { type: 'pending_tools' }>): Promise<void> {
    console.log(
      `Received tool requests for step ${message.step}:`,
      message.requests.map((r) => r.tool),
    )

    if (message.requests.every((request) => request.tool === 'executeCommand')) {
      const execute = this.provider.executeCommand
      if (!execute) throw new Error('Runner command execution is unavailable.')
      const responses = await executeRunnerCommands(message.requests, execute)
      this.#commandFailed ||= responses.some(({ response }) => response.exitCode !== 0)
      this.wsManager.sendMessage({ type: 'pending_tools_response', step: message.step, responses })
      return
    }

    const responses: { index: number; tool: string; response: UserContent }[] = []

    for (const request of message.requests) {
      const fn = async () => {
        try {
          console.log(`Executing tool: ${request.tool} with params:`, request.params)

          // onBeforeInvokeTool handler override for coder agent
          if (request.params.overridenAgent === 'coder' && this.provider.executeCommand) {
            const format = typeof request.params.format === 'string' ? request.params.format : undefined
            const check = typeof request.params.check === 'string' ? request.params.check : undefined
            const test = typeof request.params.test === 'string' ? request.params.test : undefined
            if (format) {
              try {
                // it is ok if format failed
                // check should provide a better error message
                await this.provider.executeCommand(format, false)
              } catch (error) {
                console.warn(`Failed to format code using command: ${format}`, error)
              }
            }
            if (check) {
              try {
                const { exitCode, stdout, stderr } = await this.provider.executeCommand(check, false)
                if (exitCode !== 0) {
                  return responsePrompts.commandResult(check, exitCode, stdout, stderr)
                }
              } catch (error) {
                console.warn(`Failed to check code using command: ${check}`, error)
              }
            }
            if (test) {
              try {
                const { exitCode, stdout, stderr } = await this.provider.executeCommand(test, false)
                if (exitCode !== 0) {
                  return responsePrompts.commandResult(test, exitCode, stdout, stderr)
                }
              } catch (error) {
                console.warn(`Failed to test code using command: ${test}`, error)
              }
            }
            return {
              type: 'exit',
            } as const
          }
          const tool = this.availableTools[request.tool]
          if (tool) {
            const resp = await tool.handler(this.provider, request.params)
            if (resp.success) {
              return formatRunnerToolResponse(request.tool, resp.message)
            }
            return {
              type: 'error',
              message: responsePrompts.errorInvokeTool(request.tool, `Unexpected tool response: ${JSON.stringify(resp)}`),
            } as const
          }
          return {
            type: 'error',
            message: responsePrompts.errorInvokeTool(request.tool, 'Tool not available'),
          } as const
        } catch (toolError) {
          console.error(`Error executing tool ${request.tool}:`, toolError)
          return {
            type: 'error',
            message: responsePrompts.errorInvokeTool(request.tool, toolError),
          } as const
        }
      }

      const respMsg = await fn()

      if (typeof respMsg === 'string') {
        responses.push({
          index: request.index,
          tool: request.tool,
          response: respMsg,
        })
      } else if (Array.isArray(respMsg)) {
        responses.push({
          index: request.index,
          tool: request.tool,
          response: respMsg,
        })
      } else if (respMsg.type === 'exit') {
        this.wsManager.sendMessage({
          type: 'pending_tools_response_completed',
          step: message.step,
          index: request.index,
        })
        // ignore remaining tools
        return
      } else if (respMsg.type === 'error') {
        responses.push({
          index: request.index,
          tool: request.tool,
          response: respMsg.message,
        })
        // ignore remaining tools
        break
      }
    }

    this.wsManager.sendMessage({
      type: 'pending_tools_response',
      step: message.step,
      responses,
    })
  }

  /**
   * Handle get files message
   */
  private async handleGetFiles(): Promise<void> {
    console.log('Received get_files request.')

    try {
      // Get git status in porcelain format for machine-readable output
      const gitStatusOutput = execSync('git status --porcelain=v1 -z --untracked-files=all', { encoding: 'utf8' })

      // Parse the git status output to identify file changes
      const fileChanges = this.#parseGitStatus(gitStatusOutput)

      // Process each file change and send appropriate messages
      for (const change of fileChanges) {
        if (change.deleted) this.sendFileDeleted(change.path)
        else await this.#sendFileContent(change.path)
      }

      // Signal completion of file processing
      this.wsManager.sendMessage({ type: 'get_files_completed' })

      console.log(`Processed ${fileChanges.length} changed files`)
    } catch (error) {
      this.#commandFailed = true
      console.error('Error getting changed files:', error)
      // Send an error message back if git command fails
      this.wsManager.sendMessage({
        type: 'error',
        message: 'Failed to synchronize changed files',
        details: error instanceof Error ? error.message : String(error),
      })
    }
  }

  /**
   * Handle done message
   */
  private handleDone(): void {
    console.log('Received done message. Closing connection.')
    this.wsManager.close(true)
    // Ensure exit happens after potential close event processing
    setImmediate(() => process.exit(this.#commandFailed ? 1 : 0))
  }

  #parseGitStatus(output: string): Array<{ path: string; deleted: boolean }> {
    const changes: Array<{ path: string; deleted: boolean }> = []
    const records = output.split('\0')
    for (let index = 0; index < records.length; index++) {
      const record = records[index]
      if (!record) continue
      const status = record.slice(0, 2)
      const path = record.slice(3)
      // Porcelain -z writes the destination first, followed by a separate source record.
      if (status.includes('R') || status.includes('C')) {
        const source = records[++index]
        if (!source) throw new Error('Missing source path in Git status')
        if (status.includes('R')) changes.push({ path: source, deleted: true })
      }
      changes.push({ path, deleted: status.includes('D') })
    }
    return changes
  }

  async #sendFileContent(path: string): Promise<void> {
    const content = await fs.readFile(path, 'utf8')
    this.wsManager.sendMessage({ type: 'file', path, content })
    console.log(`Sent content for file: ${path}, size: ${content.length}`)
  }

  /**
   * Send file deleted
   */
  private sendFileDeleted(path: string): void {
    this.wsManager.sendMessage({
      type: 'file_deleted',
      path,
    })
    console.log(`Sent file_deleted for: ${path}`)
  }
}

/**
 * Run the runner
 */
export async function runRunner(options: RunnerOptions): Promise<void> {
  // Validate required options
  if (!options.taskId) {
    console.error('Error: Task ID is required.')
    process.exit(1)
  }
  if (!options.githubToken) {
    console.error('Error: GitHub token is required. Provide it via --github-token or GITHUB_TOKEN environment variable.')
    process.exit(1)
  }
  if (!options.api) {
    console.error('Error: API URL is required.')
    process.exit(1)
  }

  const config = await loadConfig()

  // Create and start the runner
  const runner = new Runner(options, config)
  runner.start()
}
