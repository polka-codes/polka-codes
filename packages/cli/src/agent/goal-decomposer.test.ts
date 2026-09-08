import { expect, test } from 'bun:test'
import { type AgentToolRegistry, createContext, type JsonResponseMessage } from '@polka-codes/core'
import type { CliToolRegistry } from '../workflow-tools'
import { TaskExecutor } from './executor'
import { GoalDecomposer } from './goal-decomposer'
import { createTaskPlanner } from './planner'
import { type CliWorkflowContext, Priority } from './types'

const unused = async () => {
  throw new Error('Unexpected tool call')
}
function fixture(responses: JsonResponseMessage[]) {
  const requests: AgentToolRegistry['generateText']['input'][] = []
  const memory = new Map<string, string>()
  const context: CliWorkflowContext = {
    ...createContext<CliToolRegistry>({
      generateText: async (input) => {
        requests.push(input)
        const response = responses.shift()
        if (!response) throw new Error('Unexpected model request')
        return { requestMessages: input.messages, responseMessages: [response] }
      },
      taskEvent: async () => {},
      executeCommand: async () => ({ stdout: '', stderr: '', exitCode: 0 }),
      readFile: async () => null,
      getMemoryContext: async () => '',
      updateMemory: async (input) => {
        if (input.topic !== undefined && 'content' in input && input.content !== undefined) memory.set(input.topic, input.content)
      },
      invokeTool: unused,
      createCommit: unused,
      printChangeFile: unused,
      confirm: unused,
      input: unused,
      select: unused,
      writeToFile: unused,
      readMemory: unused,
      listMemoryTopics: unused,
      listTodoItems: unused,
      getTodoItem: unused,
      updateTodoItem: unused,
      createPullRequest: unused,
      runAgent: unused,
    }),
    sessionId: 'goal-test',
    stateDir: '.',
    workingDir: '.',
    workflowInput: { interactive: false, additionalTools: {}, config: { loadRules: { 'AGENTS.md': false, 'CLAUDE.md': false } } },
  }
  return { context, requests, memory }
}
const response = (value: unknown): JsonResponseMessage => ({ role: 'assistant', content: JSON.stringify(value) })
const goalTask = (type: string, title = 'Implement login', dependencies: string[] = []) => ({
  title,
  type,
  description: 'Implement login with session validation',
  priority: 'high',
  complexity: 'low',
  estimatedTime: 10,
  files: ['src/login.ts'],
  dependencies,
})
const decomposition = (tasks: unknown[]) => ({
  requirements: ['Session validation'],
  highLevelPlan: 'Implement and verify session validation',
  tasks,
  risks: [],
})

for (const type of ['feature', 'bugfix']) {
  test(`${type} goals reach implementation with their description and file context even without configured checks`, async () => {
    const { context, requests, memory } = fixture([
      response(decomposition([goalTask(type)])),
      response({ plan: 'Implement the requested session validation.' }),
      response({ summary: 'Implemented session validation.' }),
    ])
    const result = await new GoalDecomposer(context).decompose('Add session validation')
    const task = result.tasks[0]
    expect(task.priority).toBe(Priority.HIGH)
    expect(task.files).toEqual(['src/login.ts'])
    expect(task.workflowInput).not.toHaveProperty('files')
    expect(task.workflowInput).not.toHaveProperty('error')
    const execution = await new TaskExecutor(context, context.logger).execute(task)
    expect(execution.success).toBe(true)
    expect(execution.output).toBe('Implemented session validation.')
    expect(requests).toHaveLength(3)
    expect(JSON.stringify(requests[1].messages)).toContain('Implement login with session validation')
    expect(JSON.stringify(requests[1].messages)).toContain('src/login.ts')
    expect(memory.get('implementation-summary')).toBe('Implemented session validation.')
  })
}

test('decomposed dependencies are accepted by the real planner and analysis remains a planning task', async () => {
  const { context } = fixture([
    response(decomposition([goalTask('other', 'Analyze login'), goalTask('feature', 'Implement login', ['Analyze login'])])),
  ])
  const result = await new GoalDecomposer(context).decompose('Add session validation')
  const plan = createTaskPlanner(context).createPlan(result.goal, result.tasks)
  expect(plan.executionOrder).toEqual([[result.tasks[0].id], [result.tasks[1].id]])
  expect(plan.tasks[0].workflow).toBe('plan')
  expect(plan.tasks[1].workflow).toBe('code')
})

test('goal decomposition validates actual model output instead of accepting incomplete tasks', async () => {
  const { context } = fixture(Array.from({ length: 3 }, () => response(decomposition([{ type: 'feature' }]))))
  await expect(new GoalDecomposer(context).decompose('Add session validation')).rejects.toThrow('Structured output remained invalid')
})
