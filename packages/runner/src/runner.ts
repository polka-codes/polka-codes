import { execFileSync, spawnSync } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { posix } from 'node:path'
import { getProvider, type LoadedConfig, loadConfig, parseGitPorcelain } from '@polka-codes/cli-shared'
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

function submoduleCommits(directory: string, commit?: string, paths?: string[]): Map<string, string> {
  const commits = new Map<string, string>()
  if (!commit || paths?.length === 0) return commits
  const tree = execFileSync('git', ['--literal-pathspecs', 'ls-tree', '-r', '-z', commit, '--', ...(paths ?? [])], {
    cwd: directory,
    encoding: 'utf8',
  })
  for (const entry of tree.split('\0')) {
    const match = /^160000 commit ([a-f0-9]+)\t([\s\S]+)$/.exec(entry)
    if (match) commits.set(match[2], match[1])
  }
  return commits
}

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
      const gitStatusOutput = execFileSync('git', ['status', '--porcelain=v1', '-z', '--untracked-files=all'], { encoding: 'utf8' })

      // Parse the git status output to identify file changes
      const fileChanges = parseGitPorcelain(gitStatusOutput)
      const head = spawnSync('git', ['rev-parse', '--verify', '--quiet', 'HEAD'], { encoding: 'utf8' })
      if (head.error) throw head.error
      // Exit 1 means the repository has no commits yet.
      if (head.status !== 0 && head.status !== 1) throw new Error(head.stderr || 'Failed to resolve Git HEAD')
      const submodules = submoduleCommits(
        '.',
        head.status === 0 ? head.stdout.trim() : undefined,
        fileChanges.map((change) => change.originalPath ?? change.path),
      )

      // Process each file change and send appropriate messages
      for (const change of fileChanges) {
        const status = change.indexStatus + change.workingTreeStatus
        if (change.originalPath && status.includes('R')) this.sendFileDeleted(change.originalPath)
        if (status.includes('D')) this.sendFileDeleted(change.path)
        else await this.#sendFileContent(change.path, submodules.get(change.originalPath ?? change.path))
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

  async #sendFileContent(path: string, baseCommit?: string): Promise<void> {
    const stat = await fs.lstat(path).catch((error: unknown) => {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return undefined
      throw error
    })
    if (!stat) {
      this.sendFileDeleted(path)
      return
    }
    if (stat.isDirectory()) {
      await this.#sendSubmodule(path, baseCommit)
      return
    }
    const content = await fs.readFile(path, 'utf8')
    this.wsManager.sendMessage({ type: 'file', path, content })
    console.log(`Sent content for file: ${path}, size: ${content.length}`)
  }

  async #sendSubmodule(path: string, baseCommit?: string): Promise<void> {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: path, encoding: 'utf8' })
    if (git('rev-parse', '--show-prefix').trim()) throw new Error(`Submodule is not initialized: ${path}`)
    const submodules = submoduleCommits(path, baseCommit)
    // Compare with the parent's recorded commit, including deletions already
    // committed inside the submodule. Disable rename detection to send both paths.
    const deleted = baseCommit
      ? git('diff', '--name-only', '--diff-filter=D', '--no-renames', '-z', baseCommit, '--').split('\0').filter(Boolean)
      : []
    const files = new Set(git('ls-files', '--cached', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean))
    for (const file of deleted) {
      if (!files.has(file)) this.sendFileDeleted(posix.join(path, file))
    }
    for (const file of files) {
      await this.#sendFileContent(posix.join(path, file), submodules.get(file))
    }
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
