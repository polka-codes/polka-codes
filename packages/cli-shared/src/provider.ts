import { spawn } from 'node:child_process'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { dirname, normalize, resolve } from 'node:path'
import { vertex } from '@ai-sdk/google-vertex'
import type { LanguageModelV2 } from '@ai-sdk/provider'
import { input, select } from '@inquirer/prompts'
import type { IMemoryStore, TodoItem, ToolProvider } from '@polka-codes/core'
import { generateText, stepCountIs } from 'ai'
import ignore from 'ignore'
import { lookup } from 'mime-types'
import { checkRipgrep } from './utils/checkRipgrep'
import { listFiles } from './utils/listFiles'
import { searchFiles } from './utils/searchFiles'

export interface ProviderDataStore<T> {
  read(): Promise<T | undefined>
  write(data: T): Promise<void>
}

export interface TodoItemStore {
  read(): Promise<TodoItem[]>
  write(data: TodoItem[]): Promise<void>
}

export class InMemoryStore<T> implements ProviderDataStore<T> {
  #data: T | undefined

  async read() {
    return this.#data
  }

  async write(data: T) {
    this.#data = data
  }
}
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
  memoryStore?: ProviderDataStore<Record<string, string>> | IMemoryStore
  todoItemStore?: ProviderDataStore<TodoItem[]>
  getModel?: (command: string) => LanguageModelV2 | undefined
  yes?: boolean
}

/**
 * Helper function to detect if memoryStore is an IMemoryStore
 */
function isIMemoryStore(store: ProviderDataStore<Record<string, string>> | IMemoryStore): store is IMemoryStore {
  return 'readMemory' in store && 'updateMemory' in store
}

export const getProvider = (options: ProviderOptions = {}): ToolProvider => {
  const ig = ignore().add(options.excludeFiles ?? [])
  const memoryStore = options.memoryStore ?? new InMemoryStore()
  const todoItemStore = options.todoItemStore ?? new InMemoryStore()

  const defaultMemoryTopic = ':default:'

  const searchModel = options.getModel?.('search')

  // Helper functions for memory operations that work with both store types
  const readMemoryKV = async (topic: string): Promise<string | undefined> => {
    if (!isIMemoryStore(memoryStore)) {
      const data = (await memoryStore.read()) ?? {}
      return data[topic]
    }
    // For IMemoryStore, topic is the "name" parameter
    return memoryStore.readMemory(topic)
  }

  const updateMemoryKV = async (operation: 'append' | 'replace' | 'remove', topic: string, content: string | undefined): Promise<void> => {
    if (!isIMemoryStore(memoryStore)) {
      const data = (await memoryStore.read()) ?? {}
      switch (operation) {
        case 'append':
          if (content === undefined) {
            throw new Error('Content is required for append operation.')
          }
          data[topic] = `${data[topic] || ''}\n${content}`
          break
        case 'replace':
          if (content === undefined) {
            throw new Error('Content is required for replace operation.')
          }
          data[topic] = content
          break
        case 'remove':
          delete data[topic]
          break
      }
      await memoryStore.write(data)
      return
    }
    // Use IMemoryStore API
    await memoryStore.updateMemory(operation, topic, content)
  }

  const listMemoryTopicsKV = async (): Promise<string[]> => {
    if (!isIMemoryStore(memoryStore)) {
      const data = (await memoryStore.read()) ?? {}
      return Object.keys(data)
    }
    // For IMemoryStore, we need to query for all names in the current scope
    const entries = await memoryStore.queryMemory({})
    if (Array.isArray(entries)) {
      return entries.map((e) => e.name)
    }
    return []
  }

  const provider: ToolProvider = {
    listTodoItems: async (id?: string | null, status?: string | null) => {
      const todoItems = (await todoItemStore.read()) ?? []
      let items: TodoItem[]
      if (!id) {
        items = todoItems.filter((i) => !i.id.includes('.'))
      } else {
        const parent = todoItems.find((i) => i.id === id)
        if (!parent) {
          throw new Error(`To-do item with id ${id} not found`)
        }
        items = todoItems.filter((i) => i.id.startsWith(`${id}.`) && i.id.split('.').length === id.split('.').length + 1)
      }

      if (status) {
        items = items.filter((item) => item.status === status)
      }

      items.sort((a, b) => {
        const aParts = a.id.split('.')
        const bParts = b.id.split('.')
        const len = Math.min(aParts.length, bParts.length)
        for (let i = 0; i < len; i++) {
          const comparison = aParts[i].localeCompare(bParts[i], undefined, { numeric: true })
          if (comparison !== 0) {
            return comparison
          }
        }
        return aParts.length - bParts.length
      })

      return items
    },
    getTodoItem: async (id) => {
      const todoItems = (await todoItemStore.read()) ?? []
      const item = todoItems.find((i) => i.id === id)
      if (!item) {
        throw new Error(`To-do item with id ${id} not found`)
      }
      const subItems = todoItems
        .filter((i) => i.id.startsWith(`${id}.`) && i.id.split('.').length === id.split('.').length + 1)
        .map(({ id, title }) => ({ id, title }))

      return { ...item, subItems }
    },
    updateTodoItem: async (input) => {
      const todoItems = (await todoItemStore.read()) ?? []
      if (input.operation === 'add') {
        const { parentId, title, description, status } = input
        if (!title) {
          throw new Error('Title is required for add operation')
        }
        let newId: string
        if (parentId) {
          const parent = todoItems.find((i) => i.id === parentId)
          if (!parent) {
            throw new Error(`Parent to-do item with id ${parentId} not found`)
          }
          const childItems = todoItems.filter(
            (i) => i.id.startsWith(`${parentId}.`) && i.id.split('.').length === parentId.split('.').length + 1,
          )
          const maxId = childItems.reduce((max, item) => {
            const parts = item.id.split('.')
            const lastPart = parseInt(parts[parts.length - 1], 10)
            return Math.max(max, lastPart)
          }, 0)
          newId = `${parentId}.${maxId + 1}`
        } else {
          const rootItems = todoItems.filter((i) => !i.id.includes('.'))
          const maxId = rootItems.reduce((max, item) => {
            const idNum = parseInt(item.id, 10)
            return Math.max(max, idNum)
          }, 0)
          newId = `${maxId + 1}`
        }
        const newItem: TodoItem = {
          id: newId,
          title,
          description: description ?? '',
          status: status ?? 'open',
        }
        await todoItemStore.write([...todoItems, newItem])
        return { id: newId }
      } else {
        // update
        const { id } = input
        if (!id) {
          throw new Error('ID is required for update operation')
        }
        const item = todoItems.find((i) => i.id === id)
        if (!item) {
          throw new Error(`To-do item with id ${id} not found`)
        }
        if (input.title != null) {
          item.title = input.title
        }
        if (input.description != null) {
          item.description = input.description ?? ''
        }
        if (input.status != null) {
          item.status = input.status
        }
        await todoItemStore.write(todoItems)
        return { id }
      }
    },
    listMemoryTopics: async (): Promise<string[]> => {
      return listMemoryTopicsKV()
    },
    readMemory: async (topic: string = defaultMemoryTopic): Promise<string | undefined> => {
      return readMemoryKV(topic)
    },
    updateMemory: async (
      operation: 'append' | 'replace' | 'remove',
      topic: string | undefined,
      content: string | undefined,
    ): Promise<void> => {
      const memoryTopic = topic ?? defaultMemoryTopic
      await updateMemoryKV(operation, memoryTopic, content)
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
      if (options.yes) {
        if (answerOptions.length > 0) {
          return answerOptions[0]
        }
        return ''
      }

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
    search:
      searchModel &&
      (async (query: string) => {
        const googleSearchTool = vertex.tools.googleSearch({})
        const resp = await generateText({
          model: searchModel,
          system:
            'You are a web search assistant. When searching for information, provide comprehensive and detailed results. Include relevant facts, statistics, dates, and key details from the search results. Synthesize information from multiple sources when available. Structure your response clearly with the most relevant information first. Reference or cite sources when presenting specific claims or data.',
          tools: {
            google_search: googleSearchTool,
          },
          prompt: query,
          stopWhen: stepCountIs(5),
        })
        return resp.text
      }),
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
