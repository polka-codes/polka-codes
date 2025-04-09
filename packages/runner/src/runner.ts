// Generated by polka.codes
import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { getProvider, loadConfig } from '@polka-codes/cli-shared'
import {
  type FullToolInfo,
  ToolResponseType,
  executeCommand,
  listCodeDefinitionNames,
  listFiles,
  readFile,
  removeFile,
  renameFile,
  replaceInFile,
  responsePrompts,
  searchFiles,
  writeToFile,
} from '@polka-codes/core'

import { WebSocketManager } from './WebSocketManager'
import type { WsIncomingMessage } from './types'

export interface RunnerOptions {
  taskId: string
  sessionToken: string
  githubToken?: string
  api: string
}

export class Runner {
  private wsManager: WebSocketManager
  private provider: ReturnType<typeof getProvider>
  private availableTools: Record<string, FullToolInfo>

  constructor(private options: RunnerOptions) {
    const config = loadConfig() ?? {}

    // Create provider
    this.provider = getProvider('coder', config || {}, {
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
      excludeFiles: config.excludeFiles,
      interactive: false,
    })

    // Define available tools
    this.availableTools = {
      [executeCommand.name]: executeCommand,
      [listCodeDefinitionNames.name]: listCodeDefinitionNames,
      [listFiles.name]: listFiles,
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

    const responses: { index: number; tool: string; response: string }[] = []

    for (const request of message.requests) {
      const fn = async () => {
        try {
          console.log(`Executing tool: ${request.tool} with params:`, request.params)

          // onBeforeInvokeTool handler override for coder agent
          if (request.params.overridenAgent === 'coder' && this.provider.executeCommand) {
            const { foramt, check, test } = request.params
            if (foramt) {
              try {
                // it is ok if format failed
                // check should provide a better error message
                await this.provider.executeCommand(foramt, false)
              } catch (error) {
                console.warn(`Failed to format code using command: ${foramt}`, error)
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
            }
          }
          const tool = this.availableTools[request.tool]
          if (tool) {
            const resp = await tool.handler(this.provider, request.params)
            if (resp.type === ToolResponseType.Reply) {
              return responsePrompts.toolResults(request.tool, resp.message)
            }
            return responsePrompts.errorInvokeTool(request.tool, `Unexpected tool response: ${JSON.stringify(resp)}`)
          }
          return responsePrompts.errorInvokeTool(request.tool, 'Tool not available')
        } catch (toolError) {
          console.error(`Error executing tool ${request.tool}:`, toolError)
          return responsePrompts.errorInvokeTool(request.tool, toolError)
        }
      }

      const respMsg = await fn()

      if (typeof respMsg === 'string') {
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
      const gitStatusOutput = execSync('git status --porcelain=v1', { encoding: 'utf8' })

      // Parse the git status output to identify file changes
      const fileChanges = this.parseGitStatus(gitStatusOutput)

      // Process each file change and send appropriate messages
      for (const change of fileChanges) {
        switch (change.status) {
          case 'added':
          case 'modified':
            this.sendFileContent(change.path)
            break
          case 'deleted':
            this.sendFileDeleted(change.path)
            break
          case 'renamed':
            if (change.oldPath) {
              this.sendFileDeleted(change.oldPath)
              this.sendFileContent(change.path)
            }
            break
        }
      }

      // Signal completion of file processing
      this.wsManager.sendMessage({ type: 'get_files_completed' })

      console.log(`Processed ${fileChanges.length} changed files`)
    } catch (error) {
      console.error('Error getting changed files:', error)
      // Send an error message back if git command fails
      this.wsManager.sendMessage({
        type: 'error',
        message: 'Failed to get changed files using git',
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
    setImmediate(() => process.exit(0))
  }

  /**
   * Parse git status output
   */
  private parseGitStatus(gitStatusOutput: string): Array<{
    status: 'added' | 'modified' | 'deleted' | 'renamed'
    path: string
    oldPath?: string
  }> {
    const changes: Array<{
      status: 'added' | 'modified' | 'deleted' | 'renamed'
      path: string
      oldPath?: string
    }> = []

    const lines = gitStatusOutput.split('\n').filter((line) => line.trim().length > 0)

    for (const line of lines) {
      const statusCode = line.substring(0, 2)
      const path = line.substring(3)

      // Handle renamed files (format: R  old-file -> new-file)
      if (statusCode.startsWith('R')) {
        const parts = path.split(' -> ')
        if (parts.length === 2) {
          const [oldPath, newPath] = parts
          changes.push({
            status: 'renamed',
            path: newPath,
            oldPath: oldPath,
          })
          continue
        }
      }

      // Handle other status codes
      if (statusCode === '??') {
        // Untracked file (new)
        changes.push({ status: 'added', path })
      } else if (statusCode.includes('A')) {
        // Added file
        changes.push({ status: 'added', path })
      } else if (statusCode.includes('M')) {
        // Modified file
        changes.push({ status: 'modified', path })
      } else if (statusCode.includes('D')) {
        // Deleted file
        changes.push({ status: 'deleted', path })
      }
    }

    return changes
  }

  /**
   * Send file content
   */
  private sendFileContent(path: string): void {
    try {
      if (existsSync(path)) {
        const content = readFileSync(path, 'utf8')
        this.wsManager.sendMessage({
          type: 'file',
          path,
          content,
        })
        console.log(`Sent content for file: ${path}`)
      } else {
        console.error(`File not found: ${path}`)
        this.wsManager.sendMessage({
          type: 'error',
          message: 'File not found',
          details: path,
        })
      }
    } catch (error) {
      console.error(`Error reading file ${path}:`, error)
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

  // Create and start the runner
  const runner = new Runner(options)
  runner.start()
}
