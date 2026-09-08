import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext } from '@polka-codes/core'
import { z } from 'zod'
import { toolHandlers } from '../tool-implementations'
import type { CliToolRegistry } from '../workflow-tools'
import { createGitAwareDiff, createGitReadFile } from './git-file-tools'
import { reviewWorkflow } from './review.workflow'

const unused = async () => {
  throw new Error('Unexpected tool call')
}

test('single commits use their own changes and metadata, including clean HEAD and root commits', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'review-commit-'))
  const git = (...args: string[]) => execFileSync('git', args, { cwd: dir, encoding: 'utf8' })
  const requests: string[] = []
  let inspectCommit = false
  const provider = {
    executeCommand: async (command: string) => ({
      stdout: execFileSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8' }),
      stderr: '',
      exitCode: 0,
    }),
    executeFile: async (command: string, args: string[]) => ({
      stdout: execFileSync(command, args, { cwd: dir, encoding: 'utf8' }),
      stderr: '',
      exitCode: 0,
    }),
    readFile: async (path: string) => readFile(join(dir, path), 'utf8'),
  }
  const context = createContext<CliToolRegistry>({
    executeCommand: async (input) => {
      if (input.shell) return provider.executeCommand(input.command)
      return { stdout: execFileSync(input.command, input.args, { cwd: dir, encoding: 'utf8' }), stderr: '', exitCode: 0 }
    },
    generateText: async ({ messages }) => {
      requests.push(JSON.stringify(messages))
      if (inspectCommit && messages.at(-1)?.role === 'user') {
        return {
          requestMessages: messages,
          responseMessages: [
            {
              role: 'assistant',
              content: [
                { type: 'tool-call', toolCallId: 'read', toolName: 'readFile', input: { path: 'root.txt' } },
                { type: 'tool-call', toolCallId: 'diff', toolName: 'git_diff', input: { file: 'root.txt', includeLineNumbers: false } },
              ],
            },
          ],
        }
      }
      if (inspectCommit) {
        const reply = JSON.stringify(messages.at(-1))
        expect(reply).toContain('root\\n')
        expect(reply).toContain('+root')
        expect(reply).not.toContain('unrelated worktree content')
      }
      return {
        requestMessages: messages,
        responseMessages: [{ role: 'assistant', content: JSON.stringify({ overview: 'Reviewed', specificReviews: [] }) }],
      }
    },
    taskEvent: async () => {},
    getMemoryContext: async () => '',
    invokeTool: async ({ toolName, input, signal }) => {
      const tool = toolHandlers.get(toolName)
      if (!tool) throw new Error(`Unknown tool: ${toolName}`)
      return tool.handler(provider, z.record(z.string(), z.json()).parse(input), signal)
    },
    createCommit: unused,
    printChangeFile: unused,
    confirm: unused,
    input: unused,
    select: unused,
    readFile: unused,
    writeToFile: unused,
    readMemory: unused,
    listMemoryTopics: unused,
    updateMemory: unused,
    listTodoItems: unused,
    getTodoItem: unused,
    updateTodoItem: unused,
    createPullRequest: unused,
    runAgent: unused,
  })
  const review = (range: string) =>
    reviewWorkflow(
      { range, interactive: false, additionalTools: {}, config: { loadRules: { 'AGENTS.md': false, 'CLAUDE.md': false } } },
      context,
    )
  try {
    git('init', '-q')
    await writeFile(join(dir, 'root.txt'), 'root\n')
    git('add', '--all')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'ROOT_ONLY_MESSAGE')
    const root = git('rev-parse', 'HEAD').trim()
    await writeFile(join(dir, 'next.txt'), 'next\n')
    git('add', '--all')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'NEXT_ONLY_MESSAGE')
    const head = git('rev-parse', 'HEAD').trim()
    expect((await review('HEAD')).overview).toBe('Reviewed')
    expect(requests.at(-1)).toContain('next.txt')
    expect(requests.at(-1)).toContain('NEXT_ONLY_MESSAGE')
    expect(requests.at(-1)).not.toContain('ROOT_ONLY_MESSAGE')
    expect(requests.at(-1)).toContain(head)
    await writeFile(join(dir, 'next.txt'), 'unrelated worktree content\n')
    await writeFile(join(dir, 'root.txt'), 'unrelated worktree content\n')
    inspectCommit = true
    await review(root)
    inspectCommit = false
    expect(requests.at(-1)).toContain('root.txt')
    expect(requests.at(-1)).not.toContain('NEXT_ONLY_MESSAGE')
    expect(requests.at(-1)).not.toContain('next.txt')
    const patch = await createGitAwareDiff(root).handler(
      {
        executeCommand: async (command: string) => ({
          stdout: execFileSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8' }),
          stderr: '',
          exitCode: 0,
        }),
      },
      { file: 'root.txt', includeLineNumbers: false },
    )
    expect(patch.message).toMatchObject({ type: 'text', value: expect.stringContaining('+root') })
    for (const range of [`${root}..${head}`, `${root}...${head}`]) {
      await review(range)
      expect(requests.at(-1)).toContain('next.txt')
      expect(requests.at(-1)).not.toContain('unrelated worktree content')
    }
    const destination = 'new -> \t"你好".txt'
    git('mv', 'root.txt', destination)
    const selectedInput = {
      interactive: false,
      additionalTools: {},
      files: [join(git('rev-parse', '--show-toplevel').trim(), destination)],
    }
    expect((await reviewWorkflow(selectedInput, context)).overview).toBe('Reviewed')
    git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'Rename root')
    expect((await reviewWorkflow({ ...selectedInput, range: `${head}..HEAD` }, context)).overview).toBe('Reviewed')
    const content = await createGitReadFile('HEAD').handler(
      {
        executeCommand: async (command: string) => ({
          stdout: execFileSync('sh', ['-c', command], { cwd: dir, encoding: 'utf8' }),
          stderr: '',
          exitCode: 0,
        }),
      },
      { path: [destination] },
    )
    expect(content.message).toMatchObject({ type: 'text', value: expect.stringContaining('root\n') })
    expect(requests).toHaveLength(7)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
