import { afterEach, describe, expect, mock, test } from 'bun:test'
import { type EpicWorkflowInput, epicWorkflow } from './epic.workflow'
import { createTestProxy } from './testing/helper'

describe('epicWorkflow', () => {
  let assert: () => void

  afterEach(() => {
    assert?.()
    mock.restore()
  })

  test('should run the epic workflow successfully', async () => {
    const task = 'Implement a new feature'
    const plan = '1. Create a new file\n2. Add content to the file'
    const branchName = 'feat/new-feature'
    const baseBranch = 'main'
    const saveEpicContext = mock(() => Promise.resolve())

    const {
      context,
      assert: proxyAssert,
      logger,
    } = createTestProxy([
      // Pre-flight checks
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['rev-parse', '--git-dir'] },
        returnValue: { exitCode: 0, stdout: '.git', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git status --porcelain', shell: true },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
        returnValue: { exitCode: 0, stdout: baseBranch, stderr: '' },
      },
      // Create and approve plan
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: JSON.stringify({ type: 'plan-generated', plan, branchName }),
          },
        ],
      },
      {
        toolName: 'input',
        args: { message: 'Press Enter to approve the plan, or provide feedback to refine it.' },
        returnValue: '',
      },
      // Create feature branch
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
        returnValue: { exitCode: 0, stdout: baseBranch, stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['rev-parse', '--verify', branchName] },
        returnValue: { exitCode: 1, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['checkout', '-b', branchName, baseBranch] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      // Add todo items
      {
        toolName: 'listTodoItems',
        args: {},
        returnValue: [],
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [
          {
            role: 'assistant',
            content: '',
          },
        ],
      },
      {
        toolName: 'listTodoItems',
        args: {},
        returnValue: [
          { id: '1', title: 'Create a new file', status: 'open', description: '' },
          { id: '2', title: 'Add content to the file', status: 'open', description: '' },
        ],
      },
      // Implementation loop - iteration 1
      {
        toolName: 'listTodoItems',
        args: { status: 'open' },
        returnValue: [
          { id: '1', title: 'Create a new file', status: 'open', description: '' },
          { id: '2', title: 'Add content to the file', status: 'open', description: '' },
        ],
      },
      // codeWorkflow -> planWorkflow
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [{ role: 'assistant', content: '{"plan":"Create a new file named new-file.ts"}' }],
      },
      // codeWorkflow -> implement
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [{ role: 'assistant', content: '```json\n{"summary": "Create a new file"}\n```' }],
      },
      {
        toolName: 'updateMemory',
        args: { operation: 'append', topic: 'implementation-summary', content: 'Create a new file' },
        returnValue: undefined,
      },
      {
        toolName: 'executeCommand',
        args: { command: 'bun fix', shell: true, pipe: true },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'bun check && AGENT=1 bun test -u', shell: true, pipe: true },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['add', '.'] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['commit', '-m', 'feat: Create a new file'] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      // Review and fix cycle
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] },
        returnValue: { exitCode: 0, stdout: 'A\tnew-file.ts', stderr: '' },
      },
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: {
          messages: expect.any(Array),
          model: undefined,
          tools: expect.any(Object),
        },
        returnValue: [
          {
            role: 'assistant',
            content: JSON.stringify({ overview: 'No issues found', specificReviews: [] }),
          },
        ],
      },
      // Update task status
      {
        toolName: 'updateTodoItem',
        args: { operation: 'update', id: '1', status: 'completed' },
        returnValue: undefined,
      },
      {
        toolName: 'listTodoItems',
        args: { status: 'open' },
        returnValue: [{ id: '2', title: 'Add content to the file', status: 'open', description: '' }],
      },
      {
        toolName: 'listTodoItems',
        args: {},
        returnValue: [
          { id: '1', title: 'Create a new file', status: 'completed', description: '' },
          { id: '2', title: 'Add content to the file', status: 'open', description: '' },
        ],
      },
      // Implementation loop - iteration 2
      // codeWorkflow -> planWorkflow
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [{ role: 'assistant', content: '{"plan":"Add content to new-file.ts"}' }],
      },
      // codeWorkflow -> implement
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: expect.anything(),
        returnValue: [{ role: 'assistant', content: '```json\n{"summary": "Add content to the file"}\n```' }],
      },
      {
        toolName: 'updateMemory',
        args: { operation: 'append', topic: 'implementation-summary', content: 'Add content to the file' },
        returnValue: undefined,
      },
      {
        toolName: 'executeCommand',
        args: { command: 'bun fix', shell: true, pipe: true },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'bun check && AGENT=1 bun test -u', shell: true, pipe: true },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['add', '.'] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['commit', '-m', 'feat: Add content to the file'] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      // Review and fix cycle
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['diff', '--name-status', 'HEAD~1', 'HEAD'] },
        returnValue: { exitCode: 0, stdout: 'M\tnew-file.ts', stderr: '' },
      },
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: {
          messages: expect.any(Array),
          model: undefined,
          tools: expect.any(Object),
        },
        returnValue: [
          {
            role: 'assistant',
            content: JSON.stringify({ overview: 'No issues found', specificReviews: [] }),
          },
        ],
      },
      // Update task status
      {
        toolName: 'updateTodoItem',
        args: { operation: 'update', id: '2', status: 'completed' },
        returnValue: undefined,
      },
      {
        toolName: 'listTodoItems',
        args: { status: 'open' },
        returnValue: [],
      },
      {
        toolName: 'listTodoItems',
        args: {},
        returnValue: [
          { id: '1', title: 'Create a new file', status: 'completed', description: '' },
          { id: '2', title: 'Add content to the file', status: 'completed', description: '' },
        ],
      },
      // Final review
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['rev-parse', '--abbrev-ref', 'HEAD'] },
        returnValue: { exitCode: 0, stdout: branchName, stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['diff', '--name-status', `${baseBranch}...${branchName}`] },
        returnValue: { exitCode: 0, stdout: 'A\tnew-file.ts', stderr: '' },
      },
      {
        toolName: 'getMemoryContext',
        args: undefined,
        returnValue: '',
      },
      {
        toolName: 'generateText',
        args: {
          messages: expect.any(Array),
          model: undefined,
          tools: expect.any(Object),
        },
        returnValue: [
          {
            role: 'assistant',
            content: JSON.stringify({ overview: 'No issues found', specificReviews: [] }),
          },
        ],
      },
      // Cleanup
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['rm', '-f', '.epic.yml'] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['status', '--porcelain', '--', '.epic.yml'] },
        returnValue: { exitCode: 0, stdout: ' D .epic.yml', stderr: '' },
      },
      {
        toolName: 'executeCommand',
        args: { command: 'git', args: ['commit', '-m', 'chore: remove .epic.yml', '--', '.epic.yml'] },
        returnValue: { exitCode: 0, stdout: '', stderr: '' },
      },
    ])
    assert = proxyAssert

    const epicContext: EpicWorkflowInput = {
      task,
      plan: '',
      branchName: '',
      baseBranch: '',
      saveEpicContext,
    }

    await epicWorkflow(epicContext, context)

    expect(logger.info).toHaveBeenCalledWith(expect.stringContaining('Epic Workflow Complete!'))
    expect(saveEpicContext).toHaveBeenCalledTimes(1)
  })
})
