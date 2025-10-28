import { afterEach, beforeEach, describe, expect, it, type Mock, spyOn } from 'bun:test'
import { ToolResponseType } from '@polka-codes/core'
import * as workflow from '@polka-codes/workflow'
import { UserCancelledError } from '../errors'
import type { CliToolRegistry } from '../workflow-tools'
import * as codeWorkflowModule from './code.workflow'
import { epicWorkflow } from './epic.workflow'

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

  beforeEach(() => {
    mockContext = createMockContext()
  })

  afterEach(() => {
    agentWorkflowSpy.mockClear()
    codeWorkflowSpy.mockClear()
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
    agentWorkflowSpy.mockResolvedValueOnce({ type: ToolResponseType.Exit, message: 'todo items added' }) // add-todo-items
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { id: '1', title: 'Implement feature A', status: 'open', createdAt: '' },
      { id: '2', title: 'Implement feature B', status: 'open', createdAt: '' },
    ])

    // Phase 5: Implementation loop
    // Iteration 1
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { id: '1', title: 'Implement feature A', status: 'open', createdAt: '' },
      { id: '2', title: 'Implement feature B', status: 'open', createdAt: '' },
    ])
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
    ;(mockContext.tools.updateTodoItem as Mock<any>).mockResolvedValueOnce({
      id: '1',
      title: 'Implement feature A',
      status: 'completed',
      createdAt: '',
    })
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { id: '2', title: 'Implement feature B', status: 'open', createdAt: '' },
    ]) // get-next-task-1
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { id: '1', title: 'Implement feature A', status: 'completed', createdAt: '' },
      { id: '2', title: 'Implement feature B', status: 'open', createdAt: '' },
    ]) // allTodos for progress

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
    ;(mockContext.tools.updateTodoItem as Mock<any>).mockResolvedValueOnce({
      id: '2',
      title: 'Implement feature B',
      status: 'completed',
      createdAt: '',
    })
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([]) // get-next-task-2 (empty, loop ends)
    ;(mockContext.tools.listTodoItems as Mock<any>).mockResolvedValueOnce([
      { id: '1', title: 'Implement feature A', status: 'completed', createdAt: '' },
      { id: '2', title: 'Implement feature B', status: 'completed', createdAt: '' },
    ]) // allTodos for progress

    await epicWorkflow({ task: 'My new epic' }, mockContext)

    // Assertions
    expect(mockContext.logger.error).not.toHaveBeenCalled()
    const infoLogs = (mockContext.logger.info as any).mock.calls.map((c: any) => c[0])
    expect(infoLogs).toContain('🎉 Epic Workflow Complete!')
    expect(infoLogs).toContain('   Branch: feature/test-branch')
    expect(infoLogs).toContain('   1. feat: Implement feature A')
    expect(infoLogs).toContain('   2. feat: Implement feature B')
  })

  it('should terminate if pre-flight checks fail', async () => {
    // Phase 1: Pre-flight checks
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/.git', stderr: '' }) // git rev-parse --git-dir
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'M dirty-file.ts', stderr: '' }) // git status --porcelain (dirty)

    await epicWorkflow({ task: 'My new epic' }, mockContext)

    expect(mockContext.logger.error).toHaveBeenCalledWith(
      '❌ Error: Your working directory is not clean. Please stash or commit your changes before running the epic workflow.',
    )
    expect(agentWorkflowSpy).not.toHaveBeenCalled()
  })

  it('should terminate gracefully if user cancels plan approval', async () => {
    // Phase 1: Pre-flight checks
    ;(mockContext.tools.executeCommand as Mock<any>)
      .mockResolvedValueOnce({ exitCode: 0, stdout: '/.git', stderr: '' }) // git rev-parse --git-dir
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' }) // git status --porcelain

    // Phase 2: Create and approve plan
    agentWorkflowSpy.mockResolvedValueOnce({
      type: ToolResponseType.Exit,
      message: 'plan created',
      object: {
        plan: 'This is the plan.',
        branchName: 'feature/test-branch',
      },
    })
    ;(mockContext.tools.input as Mock<any>).mockRejectedValueOnce(new UserCancelledError()) // User cancels

    await epicWorkflow({ task: 'My new epic' }, mockContext)

    expect(mockContext.logger.info).toHaveBeenCalledWith('Plan creation cancelled by user.')
    expect(mockContext.logger.error).not.toHaveBeenCalled()
    // Assert that the workflow did not proceed
    expect((mockContext.tools.executeCommand as Mock<any>).mock.calls.length).toBe(2) // Only pre-flight checks
  })
})
