import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from 'bun:test'
import { ToolResponseType } from '@polka-codes/core'
import * as workflow from '@polka-codes/workflow'
import { UserCancelledError } from '../errors'
import type { CliToolRegistry } from '../workflow-tools'
import * as codeWorkflow from './code.workflow'
import { epicWorkflow } from './epic.workflow'

const createMockContext = () => {
  const tools = {
    input: mock<any>(),
    executeCommand: mock<any>(),
    getMemoryContext: mock<any>(async () => ''),
    appendMemory: mock<any>(),
    replaceMemory: mock<any>(),
    removeMemory: mock<any>(),
    taskEvent: mock<any>(),
    generateText: mock<any>(() => [{ role: 'assistant', content: '{}' }]),
    invokeTool: mock<any>(),
  }
  const step = mock(async (_name: string, fn: () => any) => fn())
  const logger = {
    info: mock(() => {}),
    error: mock(() => {}),
    warn: mock(() => {}),
    debug: mock(() => {}),
  }

  const context = {
    tools,
    step,
    logger,
  } as unknown as workflow.WorkflowContext<CliToolRegistry>

  return { context, tools, step, logger }
}

describe('epicWorkflow', () => {
  let agentWorkflowSpy: any
  let codeWorkflowSpy: any

  beforeEach(() => {
    agentWorkflowSpy = spyOn(workflow, 'agentWorkflow')
    codeWorkflowSpy = spyOn(codeWorkflow, 'codeWorkflow')
  })

  afterEach(() => {
    agentWorkflowSpy.mockRestore()
    codeWorkflowSpy.mockRestore()
  })

  test('should exit early if task is empty', async () => {
    const { context, logger } = createMockContext()

    await epicWorkflow({ task: '' }, context)

    expect(logger.error).toHaveBeenCalledWith('❌ Error: Task cannot be empty. Please provide a valid task description.')
  })

  test('should exit early if git is not initialized', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand.mockResolvedValue({ exitCode: 1, stdout: '', stderr: 'Not a git repository' })

    await epicWorkflow({ task: 'Create a new feature' }, context)

    expect(tools.executeCommand).toHaveBeenCalledWith({ command: 'git', args: ['rev-parse', '--git-dir'] })
    expect(logger.error).toHaveBeenCalledWith('❌ Error: Git is not initialized in this directory. Please run `git init` first.')
  })

  test('should exit early if working directory is not clean', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'M src/file.ts', stderr: '' })

    await epicWorkflow({ task: 'Create a new feature' }, context)

    expect(tools.executeCommand).toHaveBeenCalledWith({ command: 'git status --porcelain', shell: true })
    expect(logger.error).toHaveBeenCalledWith(
      '❌ Error: Your working directory is not clean. Please stash or commit your changes before running the epic workflow.',
    )
  })

  test('should exit when plan is not created', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy.mockResolvedValue({
      type: ToolResponseType.Exit,
      object: {
        plan: null,
        reason: 'Task is already complete',
      },
    })

    await epicWorkflow({ task: 'Create a new feature' }, context)

    expect(logger.info).toHaveBeenCalledWith('No plan created. Reason: Task is already complete')
  })

  test('should handle user cancellation during plan approval', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy.mockResolvedValue({
      type: ToolResponseType.Exit,
      object: {
        plan: '- [ ] Create component',
        branchName: 'feat/new-feature',
      },
    })

    tools.input.mockRejectedValue(new UserCancelledError())

    await epicWorkflow({ task: 'Create a new feature' }, context)

    expect(logger.info).toHaveBeenCalledWith('Plan creation cancelled by user.')
  })

  test('should exit if branch name validation fails', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy.mockResolvedValue({
      type: ToolResponseType.Exit,
      object: {
        plan: '- [ ] Create component',
        branchName: 'feat/invalid branch name',
      },
    })

    tools.input.mockResolvedValue('')

    await epicWorkflow({ task: 'Create a new feature' }, context)

    expect(logger.error).toHaveBeenCalledWith(
      '❌ Error: Invalid branch name format: "feat/invalid branch name". Branch names should contain only letters, numbers, hyphens, underscores, and forward slashes.',
    )
  })

  test('should exit if branch already exists', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: 'abc123', stderr: '' })

    agentWorkflowSpy.mockResolvedValue({
      type: ToolResponseType.Exit,
      object: {
        plan: '- [ ] Create component',
        branchName: 'feat/new-feature',
      },
    })

    tools.input.mockResolvedValue('')

    await epicWorkflow({ task: 'Create a new feature' }, context)

    expect(tools.executeCommand).toHaveBeenCalledWith({ command: 'git', args: ['rev-parse', '--verify', 'feat/new-feature'] })
    expect(logger.error).toHaveBeenCalledWith(
      "❌ Error: Branch 'feat/new-feature' already exists. Please use a different branch name or delete the existing branch.",
    )
  })

  test('should successfully complete epic with single task', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          plan: '- [ ] Create component',
          branchName: 'feat/new-component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [ ] Create component',
          isComplete: false,
          nextTask: 'Create component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [x] Create component',
          isComplete: true,
          nextTask: null,
        },
      })

    codeWorkflowSpy.mockResolvedValue({ summaries: ['Created component'] })

    tools.input.mockResolvedValue('')
    tools.appendMemory.mockResolvedValue(undefined)
    tools.replaceMemory.mockResolvedValue(undefined)
    tools.removeMemory.mockResolvedValue(undefined)

    await epicWorkflow({ task: 'Create a new component' }, context)

    expect(tools.executeCommand).toHaveBeenCalledWith({ command: 'git', args: ['checkout', '-b', 'feat/new-component'] })
    expect(tools.executeCommand).toHaveBeenCalledWith({ command: 'git', args: ['add', '.'] })
    expect(tools.executeCommand).toHaveBeenCalledWith({ command: 'git', args: ['commit', '-m', 'feat: Create component'] })
    expect(tools.appendMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'epic-context',
      }),
    )
    expect(tools.removeMemory).toHaveBeenCalledWith({ topic: 'epic-context' })
    expect(tools.removeMemory).toHaveBeenCalledWith({ topic: 'epic-plan' })
    expect(logger.info).toHaveBeenCalledWith('✅ All tasks complete!\n')
  })

  test('should successfully complete epic with multiple tasks', async () => {
    const { context, tools, logger } = createMockContext()

    const plan = '- [ ] Create component\n- [ ] Add tests'

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          plan,
          branchName: 'feat/new-component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: plan,
          isComplete: false,
          nextTask: 'Create component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [x] Create component\n- [ ] Add tests',
          isComplete: false,
          nextTask: 'Add tests',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [x] Create component\n- [x] Add tests',
          isComplete: true,
          nextTask: null,
        },
      })

    codeWorkflowSpy.mockResolvedValue({ summaries: ['Done'] })

    tools.input.mockResolvedValue('')
    tools.appendMemory.mockResolvedValue(undefined)
    tools.replaceMemory.mockResolvedValue(undefined)
    tools.removeMemory.mockResolvedValue(undefined)

    await epicWorkflow({ task: 'Create a new component with tests' }, context)

    expect(codeWorkflowSpy).toHaveBeenCalledTimes(2)
    expect(logger.info).toHaveBeenCalledWith('✅ All tasks complete!\n')
  })

  test('should handle implementation error with cleanup', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          plan: '- [ ] Create component',
          branchName: 'feat/new-component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [ ] Create component',
          isComplete: false,
          nextTask: 'Create component',
        },
      })

    codeWorkflowSpy.mockRejectedValue(new Error('Implementation failed'))

    tools.input.mockResolvedValue('')

    await expect(epicWorkflow({ task: 'Create a new component' }, context)).rejects.toThrow('Implementation failed')

    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Epic workflow failed: Implementation failed'))
    expect(logger.info).toHaveBeenCalledWith("\nBranch 'feat/new-component' was created but work is incomplete.")
    expect(logger.info).toHaveBeenCalledWith('To cleanup: git checkout <previous-branch> && git branch -D feat/new-component\n')
    expect(tools.removeMemory).toHaveBeenCalledWith({ topic: 'epic-context' })
    expect(tools.removeMemory).toHaveBeenCalledWith({ topic: 'epic-plan' })
  })

  test('should skip review when no files changed', async () => {
    const { context, tools, logger } = createMockContext()

    tools.executeCommand
      .mockResolvedValueOnce({ exitCode: 0, stdout: '.git', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 1, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValueOnce({ exitCode: 0, stdout: '', stderr: '' })
      .mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' })

    agentWorkflowSpy
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          plan: '- [ ] Create component',
          branchName: 'feat/new-component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [ ] Create component',
          isComplete: false,
          nextTask: 'Create component',
        },
      })
      .mockResolvedValueOnce({
        type: ToolResponseType.Exit,
        object: {
          updatedPlan: '- [x] Create component',
          isComplete: true,
          nextTask: null,
        },
      })

    codeWorkflowSpy.mockResolvedValue({ summaries: ['Done'] })

    tools.input.mockResolvedValue('')
    tools.appendMemory.mockResolvedValue(undefined)
    tools.replaceMemory.mockResolvedValue(undefined)
    tools.removeMemory.mockResolvedValue(undefined)

    await epicWorkflow({ task: 'Create a new component' }, context)

    expect(logger.info).toHaveBeenCalledWith('ℹ️  No files were changed. Skipping review.\n')
  })
})
