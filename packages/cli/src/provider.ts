import { spawn } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import ignore from 'ignore'

import type { ToolProvider } from '@polka-codes/core'
import { listFiles } from './utils/listFiles'
import { searchFiles } from './utils/searchFiles'

export type ProviderOptions = {
  command: {
    onStarted(command: string): void
    onStdout(data: string): void
    onStderr(data: string): void
    onExit(code: number): void
    onError(error: unknown): void
  }
  excludeFiles?: string[]
}

export const getProvider = (options: ProviderOptions): ToolProvider => {
  const ig = ignore().add(options.excludeFiles ?? [])
  return {
    readFile: async (path: string): Promise<string> => {
      if (ig.ignores(path)) {
        throw new Error(`Not allow to access file ${path}`)
      }
      return await readFile(path, 'utf8')
    },
    writeFile: async (path: string, content: string): Promise<void> => {
      if (ig.ignores(path)) {
        throw new Error(`Not allow to access file ${path}`)
      }
      // generate parent directories if they don't exist
      await mkdir(dirname(path), { recursive: true })

      return await writeFile(path, content, 'utf8')
    },
    listFiles: async (path: string, recursive: boolean, maxCount: number): Promise<[string[], boolean]> => {
      return await listFiles(path, recursive, maxCount, dirname(path), options.excludeFiles)
    },
    searchFiles: async (path: string, regex: string, filePattern: string): Promise<string[]> => {
      return await searchFiles(path, regex, filePattern, dirname(path), options.excludeFiles)
    },
    // listCodeDefinitionNames: async (path: string) => Promise<string[]> {},

    executeCommand: (command: string, needApprove: boolean): Promise<{ stdout: string; stderr: string; exitCode: number }> => {
      // TODO: add timeout

      return new Promise((resolve, reject) => {
        // spawn a shell to execute the command

        options.command.onStarted(command)

        const child = spawn(command, [], {
          shell: true,
          stdio: 'pipe',
        })

        let stdoutText = ''
        let stderrText = ''

        child.stdout.on('data', (data) => {
          const dataStr = data.toString()
          options.command.onStdout(dataStr)
          stdoutText += dataStr
        })

        child.stderr.on('data', (data) => {
          const dataStr = data.toString()
          options.command.onStderr(dataStr)
          stderrText += dataStr
        })

        child.on('close', (code) => {
          options.command.onExit(code ?? 0)
          resolve({
            stdout: stdoutText,
            stderr: stderrText,
            exitCode: code ?? 0,
          })
        })

        child.on('error', (err) => {
          options.command.onError(err)
          reject(err)
        })
      })
    },
    // askFollowupQuestion: async (question: string, options: string[]) => Promise<string> {},
    // attemptCompletion: async (result: string) => Promise<string | undefined> {},
  }
}
