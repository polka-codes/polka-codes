import { spawn } from 'node:child_process'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type { AgentNameType, ToolProvider } from '@polka-codes/core'
import ignore from 'ignore'

import { input, select } from '@inquirer/prompts'
import type { Config } from './config'
import { checkRipgrep } from './utils/checkRipgrep'
import { listFiles } from './utils/listFiles'
import { searchFiles } from './utils/searchFiles'

export type ProviderOptions = {
  command?: {
    onStarted(command: string): void
    onStdout(data: string): void
    onStderr(data: string): void
    onExit(code: number): void
    onError(error: unknown): void
  }
  excludeFiles?: string[]
  interactive?: boolean
}

export const getProvider = (agentName: AgentNameType, config: Config, options: ProviderOptions = {}): ToolProvider => {
  const ig = ignore().add(options.excludeFiles ?? [])
  const provider: ToolProvider = {
    readFile: async (path: string): Promise<string | undefined> => {
      if (ig.ignores(path)) {
        throw new Error(`Not allow to access file ${path}`)
      }
      try {
        return await readFile(path, 'utf8')
      } catch (_e) {
        return undefined
      }
    },
    writeFile: async (path: string, content: string): Promise<void> => {
      if (ig.ignores(path)) {
        throw new Error(`Not allow to access file ${path}`)
      }
      // generate parent directories if they don't exist
      await mkdir(dirname(path), { recursive: true })

      return await writeFile(path, content, 'utf8')
    },
    removeFile: async (path: string): Promise<void> => {
      if (ig.ignores(path)) {
        throw new Error(`Not allow to access file ${path}`)
      }
      return await unlink(path)
    },
    renameFile: async (sourcePath: string, targetPath: string): Promise<void> => {
      if (ig.ignores(sourcePath) || ig.ignores(targetPath)) {
        throw new Error(`Not allow to access file ${sourcePath} or ${targetPath}`)
      }
      return await rename(sourcePath, targetPath)
    },
    listFiles: async (path: string, recursive: boolean, maxCount: number): Promise<[string[], boolean]> => {
      return await listFiles(path, recursive, maxCount, process.cwd(), options.excludeFiles)
    },

    executeCommand: (command: string, needApprove: boolean): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      // TODO: add timeout

      return new Promise((resolve, reject) => {
        // spawn a shell to execute the command

        options.command?.onStarted(command)

        const child = spawn(command, [], {
          shell: true,
          stdio: 'pipe',
        })

        let stdoutText = ''
        let stderrText = ''

        child.stdout.on('data', (data) => {
          const dataStr = data.toString()
          options.command?.onStdout(dataStr)
          stdoutText += dataStr
        })

        child.stderr.on('data', (data) => {
          const dataStr = data.toString()
          options.command?.onStderr(dataStr)
          stderrText += dataStr
        })

        child.on('close', (code) => {
          options.command?.onExit(code ?? 0)
          resolve({
            stdout: stdoutText,
            stderr: stderrText,
            exitCode: code ?? 0,
          })
        })

        child.on('error', (err) => {
          options.command?.onError(err)
          reject(err)
        })
      })
    },
    askFollowupQuestion: async (question: string, answerOptions: string[]): Promise<string> => {
      if (options.interactive) {
        if (answerOptions.length === 0) {
          return await input({ message: question })
        }

        const otherMessage = 'Other (enter text)'
        answerOptions.push(otherMessage)
        const answer = await select({
          message: question,
          choices: answerOptions.map((option) => ({ name: option, value: option })),
        })

        if (answer === otherMessage) {
          return await input({ message: 'Enter your answer:' })
        }
        return answer
      }

      return answerOptions[0] ?? '<warning>This is non-interactive mode, no answer can be provided.</warning>'
    },
    attemptCompletion: async (result: string): Promise<string | undefined> => {
      // TODO: if interactive, ask user to confirm completion

      return undefined
    },
  }

  if (checkRipgrep()) {
    provider.searchFiles = async (path: string, regex: string, filePattern: string): Promise<string[]> => {
      return await searchFiles(path, regex, filePattern, process.cwd(), options.excludeFiles)
    }
  } else {
    console.error(
      'Error: ripgrep (rg) is not installed. Search file tool is disabled. Please install it from https://github.com/BurntSushi/ripgrep#installation',
    )
  }

  return provider
}
