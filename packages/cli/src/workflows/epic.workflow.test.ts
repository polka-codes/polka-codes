import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from 'bun:test'
import { promises as fs } from 'node:fs'
import { ToolResponseType } from '@polka-codes/core'
import * as workflow from '@polka-codes/workflow'
import type { CliToolRegistry } from '../workflow-tools'
import * as codeWorkflowModule from './code.workflow'
import { epicWorkflow } from './epic.workflow'
import { EPIC_CONTEXT_FILE, type EpicContext } from './epic-context'

// Mock dependencies
const agentWorkflowSpy = spyOn(workflow, 'agentWorkflow')
const codeWorkflowSpy = spyOn(codeWorkflowModule, 'codeWorkflow')

type MockTools = {
  [K in keyof CliToolRegistry]: Mock<(...args: any[]) => Promise<any>>
}

const createMockContext = (): workflow.WorkflowContext<CliToolRegistry> => {
  const loggerObj = {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
  }
  const logger: workflow.WorkflowContext<CliToolRegistry>['logger'] = {
    info: spyOn(loggerObj, 'info'),
    warn: spyOn(loggerObj, 'warn'),
    error: spyOn(loggerObj, 'error'),
    debug: spyOn(loggerObj, 'debug'),
  }

  const dummyTools = {
    createPullRequest: async () => ({ title: 'test', description: 'test' }),
    createCommit: async () => ({ message: 'test' }),
    printChangeFile: async () => ({ stagedFiles: [], unstagedFiles: [] }),
    confirm: async () => true,
    input: async () => '',
    select: async () => 'test',
    writeToFile: async () => {},
    readFile: async () => '',
    executeCommand: async () => ({ exitCode: 0, stdout: '', stderr: '' }),
    getMemoryContext: async () => 'memory context',
    readMemory: async () => '',
    listMemoryTopics: async () => [],
    updateMemory: async () => {},
    listTodoItems: async () => [],
    getTodoItem: async () => undefined,
    updateTodoItem: async () => ({
      id: '1',
      title: 'Test To-Do',
      status: 'completed' as const,
      createdAt: new Date().toISOString(),
    }),
    generateText: async () => [],
    taskEvent: async () => {},
    invokeTool: async () => ({ type: ToolResponseType.Exit as const, message: 'test' }),
  }

  const tools: MockTools = {
    createPullRequest: spyOn(dummyTools, 'createPullRequest'),
    createCommit: spyOn(dummyTools, 'createCommit'),
    printChangeFile: spyOn(dummyTools, 'printChangeFile'),
    confirm: spyOn(dummyTools, 'confirm'),
    input: spyOn(dummyTools, 'input'),
    select: spyOn(dummyTools, 'select'),
    writeToFile: spyOn(dummyTools, 'writeToFile'),
    readFile: spyOn(dummyTools, 'readFile'),
    executeCommand: spyOn(dummyTools, 'executeCommand'),
    getMemoryContext: spyOn(dummyTools, 'getMemoryContext'),
    readMemory: spyOn(dummyTools, 'readMemory'),
    listMemoryTopics: spyOn(dummyTools, 'listMemoryTopics'),
    updateMemory: spyOn(dummyTools, 'updateMemory'),
    listTodoItems: spyOn(dummyTools, 'listTodoItems'),
    getTodoItem: spyOn(dummyTools, 'getTodoItem'),
    updateTodoItem: spyOn(dummyTools, 'updateTodoItem'),
    generateText: spyOn(dummyTools, 'generateText'),
    taskEvent: spyOn(dummyTools, 'taskEvent'),
    invokeTool: spyOn(dummyTools, 'invokeTool'),
  }

  return {
    logger,
    tools: tools as any,
    step: async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
      logger.debug(`Executing step: ${name}`)
      return await fn()
    },
  }
}

describe('epicWorkflow', () => {
  let mockContext: workflow.WorkflowContext<CliToolRegistry>
  const task = 'My new epic'
  let epicContext: EpicContext

  beforeEach(() => {
    mockContext = createMockContext()
    epicContext = {}
  })

  afterEach(async () => {
    agentWorkflowSpy.mockClear()
    codeWorkflowSpy.mockClear()
    try {
      await fs.unlink(EPIC_CONTEXT_FILE)
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  })

  it('should run the happy path successfully', async () => {
    // Phase 1: Pre-flight checks
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/.git', stderr: '' }) // git rev-parse --git-dir
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git status --porcelain

    // Phase 2: Create and approve plan
    agentWorkflowSpy.mockResolvedValueOnce({
      type: ToolResponseType.Exit,
      message: 'Plan created',
      object: {
        plan: 'This is the plan.',
        branchName: 'feature/test-branch',
      },
    })
    ;(mockContext.tools.input as Mock<any>).mockResolvedValueOnce('') // Approve plan

    // Phase 3: Create feature branch
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' }) // git rev-parse --verify (branch doesn't exist)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git checkout -b

    // Phase 4: Add todo items
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([]) // initial check in epicWorkflow is empty
    agentWorkflowSpy.mockImplementationOnce(async (_input, _context) => {
      // This agent is responsible for creating todos. We don't need to mock its internal calls.
      return { type: ToolResponseType.Exit, message: 'todo items added' }
    })
    const todosAfterAdd = [
      { id: '1', title: 'Implement feature A', status: 'open', createdAt: new Date().toISOString() },
      { id: '2', title: 'Implement feature B', status: 'open', createdAt: new Date().toISOString() },
    ]
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce(todosAfterAdd) // After adding, for the log message.

    // Phase 5: Implementation loop
    // get-initial-tasks
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce(todosAfterAdd)

    // Iteration 1
    codeWorkflowSpy.mockResolvedValueOnce({ success: true, summaries: ['Implemented feature A'] }) // task-1
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git add .
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git commit -m
    ;(mockContext.tools.executeCommand as Mock<any>).mockResolvedValueOnce({ exitCode: 0, stdout: 'M	file1.ts', stderr: '' }) // git diff --name-status
    agentWorkflowSpy.mockResolvedValueOnce({
      // review-1-0
      type: ToolResponseType.Exit,
      message: 'no issues',
      object: { specificReviews: [] }, // No issues found
    })
    ;(mockContext.tools.updateTodoItem as Mock<any>).mockResolvedValueOnce({ ...todosAfterAdd[0], status: 'completed' })
    // get-next-task-1
    const todosAfterIteration1 = [todosAfterAdd[1]]
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce(todosAfterIteration1)
    // all todos for progress
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([{ ...todosAfterAdd[0], status: 'completed' }, todosAfterAdd[1]])

    // Iteration 2
    codeWorkflowSpy.mockResolvedValueOnce({ success: true, summaries: ['Implemented feature B'] }) // task-2
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git add .
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git commit -m
    ;(mockContext.tools.executeCommand as Mock<any>).mockResolvedValueOnce({ exitCode: 0, stdout: 'M	file2.ts', stderr: '' }) // git diff --name-status
    agentWorkflowSpy.mockResolvedValueOnce({
      // review-2-0
      type: ToolResponseType.Exit,
      message: 'no issues',
      object: { specificReviews: [] }, // No issues found
    })
    ;(mockContext.tools.updateTodoItem as Mock<any>).mockResolvedValueOnce({ ...todosAfterAdd[1], status: 'completed' })
    // get-next-task-2
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([]) // No more open tasks
    // all todos for progress
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { ...todosAfterAdd[0], status: 'completed' },
      { ...todosAfterAdd[1], status: 'completed' },
    ])

    // Final review and cleanup
    ;(mockContext.tools.executeCommand as Mock<any>).mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' }) // gh --version (skip final review)
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git rm -f .epic.yml
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'D .epic.yml', stderr: '' }) // git status --porcelain
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git commit .epic.yml

    await epicWorkflow({ task, epicContext }, mockContext)

    // Assertions
    expect(mockContext.logger.error).not.toHaveBeenCalled()
    const infoLogs = (mockContext.logger.info as any).mock.calls.map((c: any) => c[0])
    expect(infoLogs).toContain('Epic Workflow Complete!')
    expect(infoLogs).toContain('   Branch: feature/test-branch')
    expect(infoLogs.join('\n')).toMatch(/feat: Implement feature A/)
    expect(infoLogs.join('\n')).toMatch(/feat: Implement feature B/)
  })

  it('should terminate if pre-flight checks fail', async () => {
    // Phase 1: Pre-flight checks
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/.git', stderr: '' }) // git rev-parse --git-dir
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'M dirty-file.ts', stderr: '' }) // git status --porcelain (dirty)

    await epicWorkflow({ task, epicContext }, mockContext)

    expect(mockContext.logger.error).toHaveBeenCalledWith(
      'Error: Your working directory is not clean. Please stash or commit your changes before running the epic workflow.',
    )
    expect(agentWorkflowSpy).not.toHaveBeenCalled()
  })

  it('should resume an in-progress epic from context', async () => {
    const epicContext: EpicContext = {
      task: 'My resumed epic',
      plan: 'This is the resumed plan.',
      branchName: 'feature/resume-branch',
    }

    // Phase 1: Pre-flight checks
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/.git', stderr: '' }) // git rev-parse --git-dir
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'feature/resume-branch', stderr: '' }) // git rev-parse --abbrev-ref HEAD (branch check)

    // Phase 3: Create/switch to feature branch
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git rev-parse --verify (branch exists)
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'feature/resume-branch', stderr: '' }) // git rev-parse --abbrev-ref HEAD (already on branch)

    // Phase 4 is skipped because todos exist
    const existingTodos = [
      { id: '1', title: 'Completed Task', status: 'completed', createdAt: new Date().toISOString() },
      { id: '2', title: 'Open Task', status: 'open', createdAt: new Date().toISOString() },
    ]
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce(existingTodos)

    // Phase 5: Implementation loop
    // get-initial-tasks
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([existingTodos[1]]) // Return open task
    codeWorkflowSpy.mockResolvedValueOnce({ success: true, summaries: ['Implemented Open Task'] }) // task-1
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git add .
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git commit -m
    ;(mockContext.tools.executeCommand as Mock<any>).mockResolvedValueOnce({ exitCode: 0, stdout: 'M	file1.ts', stderr: '' }) // git diff --name-status
    agentWorkflowSpy.mockResolvedValueOnce({
      // review-1-0
      type: ToolResponseType.Exit,
      message: 'no issues',
      object: { specificReviews: [] }, // No issues found
    })
    ;(mockContext.tools.updateTodoItem as Mock<any>).mockResolvedValueOnce({ ...existingTodos[1], status: 'completed' })
    // get-next-task
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([]) // No more open tasks
    // final list for progress
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { ...existingTodos[0] },
      { ...existingTodos[1], status: 'completed' },
    ])

    // Final review and cleanup
    ;(mockContext.tools.executeCommand as Mock<any>).mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' }) // gh --version (skip final review)
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git rm -f .epic.yml
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'D .epic.yml', stderr: '' }) // git status --porcelain
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git commit .epic.yml

    await epicWorkflow({ task: epicContext.task!, epicContext }, mockContext)

    // Assertions
    expect(mockContext.logger.error).not.toHaveBeenCalled()
    const infoLogs = (mockContext.logger.info as any).mock.calls.map((c: any) => c[0]).join('\n')
    expect(infoLogs).toContain('Resuming previous epic session.')
    // Planning should be skipped, so agentWorkflow for planning is not called.
    // The first call to agentWorkflow will be for review.
    expect(agentWorkflowSpy).toHaveBeenCalledTimes(1)
    expect(agentWorkflowSpy.mock.calls[0][0]).toMatchObject({
      systemPrompt: expect.stringMatching('You are a senior software engineer reviewing code changes'),
    })
    // addTodoItemsFromPlan should be skipped
    expect(infoLogs).not.toContain('Creating todo items from plan')
    // Implementation loop should run for the open task
    expect(codeWorkflowSpy).toHaveBeenCalledTimes(1)
    expect(codeWorkflowSpy).toHaveBeenCalledWith(expect.objectContaining({ task: expect.stringContaining('Open Task') }), expect.anything())
    expect(infoLogs).toContain('Epic Workflow Complete!')
  })

  it('should throw an error on resume if on a different git branch', async () => {
    const epicContext: EpicContext = {
      task: 'My resumed epic',
      plan: 'This is the resumed plan.',
      branchName: 'feature/correct-branch',
    }

    // Phase 1: Pre-flight checks
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/.git', stderr: '' }) // git rev-parse --git-dir
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'feature/wrong-branch', stderr: '' }) // git rev-parse --abbrev-ref HEAD (branch check)

    await expect(epicWorkflow({ task: epicContext.task!, epicContext }, mockContext)).rejects.toThrow(
      "You are on branch 'feature/wrong-branch' but the epic was started on branch 'feature/correct-branch'. Please switch to the correct branch to resume.",
    )

    expect(mockContext.logger.error).toHaveBeenCalled()
    const errorLogs = (mockContext.logger.error as any).mock.calls.map((c: any) => c[0]).join('\n')
    expect(errorLogs).toContain(
      "Epic workflow failed: You are on branch 'feature/wrong-branch' but the epic was started on branch 'feature/correct-branch'. Please switch to the correct branch to resume.",
    )
  })
})
