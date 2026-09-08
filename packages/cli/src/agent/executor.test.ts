import { expect, test } from 'bun:test'
import { execFileSync } from 'node:child_process'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createContext } from '@polka-codes/core'
import type { CliToolRegistry } from '../workflow-tools'
import { TaskExecutor } from './executor'
import { type CliWorkflowContext, Priority, type Task } from './types'
import { invokeWorkflow, invokeWorkflowWithTimeout } from './workflow-adapter'

const unused = async () => {
  throw new Error('Unexpected tool call')
}
const task = (id = 'task'): Task => ({
  id,
  title: 'Review commit',
  description: 'Review the current commit',
  type: 'review',
  priority: Priority.MEDIUM,
  complexity: 'low',
  estimatedTime: 1,
  status: 'pending',
  workflow: 'review',
  workflowInput: { range: 'HEAD' },
  dependencies: [],
  files: [],
  createdAt: Date.now(),
  retryCount: 0,
})

async function withExecutor(
  run: (fixture: {
    executor: TaskExecutor
    context: CliWorkflowContext
    calls: CliToolRegistry['executeCommand']['input'][]
    started: Promise<void>
    release: () => void
  }) => Promise<void>,
  pending = true,
) {
  const dir = await mkdtemp(join(tmpdir(), 'agent-cancel-'))
  const started = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  const calls: CliToolRegistry['executeCommand']['input'][] = []
  let rounds = 0
  execFileSync('git', ['init', '-q'], { cwd: dir })
  await writeFile(join(dir, 'file.txt'), 'test\n')
  execFileSync('git', ['add', '--all'], { cwd: dir })
  execFileSync('git', ['-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'initial'], { cwd: dir })
  const base = createContext<CliToolRegistry>({
    executeCommand: async (input) => {
      calls.push(input)
      started.resolve()
      if (pending) await release.promise
      if (input.shell) throw new Error('Unexpected shell')
      return { stdout: execFileSync(input.command, input.args, { cwd: dir, encoding: 'utf8' }), stderr: '', exitCode: 0 }
    },
    generateText: async ({ messages }) => ({
      requestMessages: messages,
      responseMessages: [{ role: 'assistant', content: JSON.stringify({ overview: `Review ${++rounds}`, specificReviews: [] }) }],
    }),
    taskEvent: async () => {},
    getMemoryContext: async () => '',
    invokeTool: unused,
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
  const context: CliWorkflowContext = {
    ...base,
    stateDir: dir,
    workingDir: dir,
    sessionId: 'test',
    workflowInput: { interactive: false, additionalTools: {}, config: { loadRules: { 'AGENTS.md': false, 'CLAUDE.md': false } } },
  }
  const executor = new TaskExecutor(context, context.logger)
  try {
    await run({ executor, context, calls, started: started.promise, release: () => release.resolve() })
  } finally {
    executor.cancelAll()
    release.resolve()
    await Bun.sleep(10)
    await rm(dir, { recursive: true, force: true })
  }
}

async function promptly<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    Bun.sleep(200).then(() => {
      throw new Error('Cancellation did not settle promptly')
    }),
  ])
}

test('cancel settles a real workflow while its provider response is pending and blocks later calls', async () => {
  await withExecutor(async ({ executor, calls, started, release }) => {
    const result = executor.execute(task())
    await started
    expect(executor.cancel('task')).toBe(true)
    expect(executor.isRunning('task')).toBe(false)
    expect((await promptly(result)).success).toBe(false)
    expect(calls[0].signal?.aborted).toBe(true)
    release()
    await Bun.sleep(10)
    expect(calls).toHaveLength(1)
    expect(executor.cancel('task')).toBe(false)
  })
})

test('cancelAll settles every active execution without accepting late success', async () => {
  await withExecutor(async ({ executor, calls, started, release }) => {
    const results = [executor.execute(task('one')), executor.execute(task('two'))]
    await started
    executor.cancelAll()
    for (const result of await promptly(Promise.all(results))) expect(result.success).toBe(false)
    expect(executor.getRunningCount()).toBe(0)
    const count = calls.length
    release()
    await Bun.sleep(10)
    expect(calls).toHaveLength(count)
  })
})

test('task timeout cancels a real workflow and blocks later provider calls', async () => {
  await withExecutor(async ({ executor, calls, release }) => {
    const result = await executor.execute(task(), undefined, 10)
    expect(result.success).toBe(false)
    expect(result.error?.message).toContain('timed out')
    expect(calls[0].signal?.aborted).toBe(true)
    release()
    await Bun.sleep(10)
    expect(calls).toHaveLength(1)
  })
})

test('adapter timeout also cancels the underlying workflow', async () => {
  await withExecutor(async ({ context, calls, release }) => {
    const result = await invokeWorkflowWithTimeout('review', { range: 'HEAD' }, context, 10)
    expect(result.success).toBe(false)
    expect(calls[0].signal?.aborted).toBe(true)
    release()
    await Bun.sleep(10)
    expect(calls).toHaveLength(1)
  })
})

test('successful executions have independent step caches and clear timeout timers', async () => {
  await withExecutor(async ({ executor, context, calls }) => {
    expect((await executor.execute(task('one'), undefined, 1000)).output).toContain('Review 1')
    expect((await executor.execute(task('two'), undefined, 1000)).output).toContain('Review 2')
    expect(executor.getRunningCount()).toBe(0)
    await Bun.sleep(1010)
    expect(calls.every((call) => call.signal?.aborted === false)).toBe(true)
    await expect(invokeWorkflow('unknown', {}, context)).rejects.toThrow('Unknown workflow')
  }, false)
})
