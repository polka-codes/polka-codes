import { spawn } from 'node:child_process'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, normalize, resolve } from 'node:path'
import { input, select } from '@inquirer/prompts'
import type { ToolProvider } from '@polka-codes/core'
import ignore from 'ignore'
import { lookup } from 'mime-types'
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
  summarizeOutput?: (stdout: string, stderr: string) => Promise<string | undefined>
  summaryThreshold?: number
}

export const getProvider = (options: ProviderOptions = {}): ToolProvider => {
  const ig = ignore().add(options.excludeFiles ?? [])
  const memoryStore: Record<string, string> = {}
  const provider: ToolProvider = {
    listTopics: async (): Promise<string[]> => {
      return Object.keys(memoryStore)
    },
    read: async (topic: string): Promise<string | undefined> => {
      return memoryStore[topic]
    },
    append: async (topic: string, content: string): Promise<void> => {
      if (memoryStore[topic]) {
        memoryStore[topic] += content
      } else {
        memoryStore[topic] = content
      }
    },
    replace: async (topic: string, content: string): Promise<void> => {
      memoryStore[topic] = content
    },
    remove: async (topic: string): Promise<void> => {
      delete memoryStore[topic]
    },
    readFile: async (path: string, includeIgnored: boolean): Promise<string | undefined> => {
      if (!includeIgnored && ig.ignores(path)) {
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
    listFiles: async (path: string, recursive: boolean, maxCount: number, includeIgnored: boolean): Promise<[string[], boolean]> => {
      return await listFiles(path, recursive, maxCount, process.cwd(), options.excludeFiles, includeIgnored)
    },
    readBinaryFile: async (url: string) => {
      if (url.startsWith('file://')) {
        const filePath = decodeURIComponent(url.substring('file://'.length))
        const resolvedPath = normalize(resolve(process.cwd(), filePath))

        if (!resolvedPath.startsWith(process.cwd())) {
          throw new Error(`Access to file path "${filePath}" is restricted.`)
        }

        const data = await readFile(resolvedPath)
        const mediaType = lookup(resolvedPath) || 'application/octet-stream'

        return {
          base64Data: data.toString('base64'),
          mediaType,
        }
      }
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      const data = await response.arrayBuffer()
      const mediaType = lookup(url) || 'application/octet-stream'

      return {
        base64Data: Buffer.from(data).toString('base64'),
        mediaType,
      }
    },

    executeCommand: (
      command: string,
      _needApprove: boolean,
    ): Promise<{ stdout: string; stderr: string; exitCode: number; summary?: string }> => {
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

        child.on('close', async (code) => {
          options.command?.onExit(code ?? 0)
          const totalLength = stdoutText.length + stderrText.length
          if (totalLength > (options.summaryThreshold ?? 5000) && options.summarizeOutput) {
            try {
              const summary = await options.summarizeOutput(stdoutText, stderrText)
              if (summary) {
                resolve({
                  summary,
                  stdout: stdoutText,
                  stderr: stderrText,
                  exitCode: code ?? 0,
                })
                return
              }
            } catch (_e) {
              console.error('Summarization failed:', _e)
            }
          }
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
    },
    fetchUrl: async (url: string): Promise<string> => {
      const isRaw = url.startsWith('https://raw.githubusercontent.com/')

      const urlToFetch = isRaw ? url : `https://r.jina.ai/${url}`

      try {
        const response = await fetch(urlToFetch)
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        return await response.text()
      } catch (error) {
        console.error('Error fetching URL:', error)
        throw error
      }
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
