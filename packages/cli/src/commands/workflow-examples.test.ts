import { expect, test } from 'bun:test'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { type AgentToolRegistry, createContext, createDynamicWorkflow, makeStepFn } from '@polka-codes/core'
import { z } from 'zod'
import { toolHandlers } from '../tool-implementations'

const root = fileURLToPath(new URL('../../../../', import.meta.url))
const cli = join(root, 'packages/cli/src/index.ts')
const files = [
  'task-discovery.yml',
  'continuous-improvement.yml',
  'review-and-commit.yml',
  'planner.yml',
  'worker.yml',
  'agent-like-workflow.yml',
]
const payloadSchema = z.object({
  workflowId: z.string(),
  stepId: z.string(),
  input: z.record(z.string(), z.unknown()),
  state: z.record(z.string(), z.unknown()),
})
type Payload = z.infer<typeof payloadSchema>
type Scenario = { empty?: boolean; blocked?: boolean; failed?: boolean; invalid?: boolean; reviewIssues?: boolean }
function reply(file: string, { workflowId, stepId, input, state }: Payload, scenario: Scenario = {}): unknown {
  if (stepId === 'init') return { count: 0 }
  if (stepId === 'increment') return { count: z.object({ count: z.number() }).parse(state.iteration).count + 1 }
  if (stepId === 'discover') return { count: scenario.empty ? 0 : 1, descriptions: scenario.empty ? [] : ['Fix the test'] }
  if (stepId === 'rediscover') return { count: 0, descriptions: [] }
  if (stepId === 'check-build' || stepId === 'check-tests') {
    return {
      failed: !scenario.empty && stepId === 'check-build' && z.object({ count: z.number() }).parse(state.iteration).count === 1,
      details: 'Controlled check result',
    }
  }
  if (stepId === 'check-changes') return { hasChanges: !scenario.empty }
  if (stepId === 'review-changes') return { hasCriticalOrMajorIssues: scenario.reviewIssues ?? false, details: 'Reviewed changes' }
  if (stepId === 'create-plan') {
    expect(input.goal).toBe('Add user authentication')
    return '# Authentication\n- [ ] Add login'
  }
  if (stepId === 'write-plan') return 'plans/active/feature.md'
  if (file === 'worker.yml') {
    if (stepId === 'read-plan' || stepId === 'mark-completed')
      return { hasIncompleteTasks: stepId === 'read-plan' && !scenario.empty, details: 'Plan tasks' }
    if (stepId === 'validate') return { valid: !scenario.invalid, reason: scenario.invalid ? 'Invalid plan' : 'Valid plan' }
    if (stepId === 'find-next-task') return { found: !scenario.blocked, description: 'Implement and verify the task' }
    if (stepId === 'verify-task') return { passed: !scenario.failed, details: scenario.failed ? 'Tests failed' : 'Tests passed' }
  }
  if (workflowId === 'execute-plan') {
    if (stepId === 'read-plan') return scenario.empty ? [] : ['Implement the task']
    if (stepId === 'refresh-plan') return []
    if (stepId === 'execute-task') return { completed: !scenario.failed, details: 'Execution result' }
  }
  return 'Done'
}

async function replay(file: string, scenario: Scenario = {}, workflowId = 'main', input: Record<string, unknown> = {}) {
  const visited: string[] = []
  const content = await readFile(join(root, 'examples', file), 'utf8')
  const context = createContext<AgentToolRegistry>(
    {
      generateText: async ({ messages, tools }) => {
        const message = messages.find((message) => message.role === 'user')
        if (!message || typeof message.content !== 'string') throw new Error('Expected structured step context')
        const payload = payloadSchema.parse(JSON.parse(message.content))
        visited.push(payload.stepId)
        if (visited.length > 60) throw new Error('Example failed to terminate')
        if (payload.stepId === 'sleep' || payload.stepId === 'archive-plan') expect(Object.keys(tools)).toContain('executeCommand')
        return {
          requestMessages: messages,
          responseMessages: [{ role: 'assistant', content: JSON.stringify(reply(file, payload, scenario)) }],
        }
      },
      taskEvent: async () => {},
      invokeTool: async () => {
        throw new Error('Controlled replies do not execute external effects')
      },
    },
    makeStepFn(),
  )
  await createDynamicWorkflow<AgentToolRegistry>(content, { toolInfo: [...toolHandlers.values()], maxStructuredOutputRepairAttempts: 0 })(
    workflowId,
    input,
    context,
  )
  return visited
}

test('discovery and bounded improvement loops follow real structured state and terminate', async () => {
  expect(await replay('task-discovery.yml')).toEqual(['discover', 'fix', 'rediscover', 'summary'])
  expect(await replay('task-discovery.yml', { empty: true })).toEqual(['discover', 'summary'])
  const cycles = await replay('continuous-improvement.yml')
  expect(cycles.filter((id) => id === 'increment')).toHaveLength(3)
  expect(cycles.filter((id) => id === 'fix-issues')).toHaveLength(1)
  expect(cycles.filter((id) => id === 'no-issues')).toHaveLength(2)
  expect(cycles.filter((id) => id === 'sleep')).toHaveLength(2)
  expect(cycles.at(-1)).toBe('summary')
})

test('review examples commit only for an accepted review with changes and the commit option enabled', async () => {
  expect(await replay('review-and-commit.yml')).toContain('create-commit')
  for (const [scenario, input] of [
    [{ empty: true }, {}],
    [{ reviewIssues: true }, {}],
    [{}, { commitOnSuccess: false }],
  ] satisfies [Scenario, Record<string, unknown>][]) {
    expect(await replay('review-and-commit.yml', scenario, 'main', input)).not.toContain('create-commit')
  }
})

test('worker archives only verified complete plans and preserves failed, blocked, or invalid plans', async () => {
  const success = await replay('worker.yml', {}, 'main', { planFile: 'plans/active/feature.md' })
  expect(success).toContain('do-commit')
  expect(success).toContain('archive-plan')
  const noCommit = await replay('worker.yml', {}, 'main', { planFile: 'plans/active/feature.md', autoCommit: false })
  expect(noCommit).not.toContain('do-commit')
  expect(noCommit).toContain('archive-plan')
  for (const scenario of [{ failed: true }, { blocked: true }, { invalid: true }]) {
    const visited = await replay('worker.yml', scenario, 'main', { planFile: 'plans/active/feature.md' })
    expect(visited).not.toContain('archive-plan')
    expect(visited).not.toContain('do-commit')
    expect(visited).toContain('report-incomplete')
  }
})

test('agent examples handle issue-free passes, completed plans, and unsuccessful tasks', async () => {
  expect(await replay('agent-like-workflow.yml', {}, 'improve')).toContain('fix')
  expect(await replay('agent-like-workflow.yml', { empty: true }, 'improve')).toEqual(['discover', 'no-issues', 'summary'])
  expect(await replay('agent-like-workflow.yml', {}, 'execute-plan')).toEqual(['read-plan', 'execute-task', 'refresh-plan', 'summary'])
  expect(await replay('agent-like-workflow.yml', { empty: true }, 'execute-plan')).toEqual(['read-plan', 'summary'])
  expect(await replay('agent-like-workflow.yml', { failed: true }, 'execute-plan')).toEqual(['read-plan', 'execute-task', 'summary'])
})

test('every documented example command runs through the real CLI with controlled model responses', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'workflow-examples-'))
  let activeFile = ''
  let steps: string[] = []
  const requestSchema = z.object({ messages: z.array(z.object({ role: z.string(), content: z.string() })) })
  const server = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(request) {
      const body = requestSchema.parse(await request.json())
      const message = body.messages.find((message) => message.role === 'user')
      if (!message) throw new Error('Expected a workflow step request')
      const payload = payloadSchema.parse(JSON.parse(message.content))
      steps.push(payload.stepId)
      if (steps.length > 60) throw new Error('Example failed to terminate')
      const chunk = {
        id: 'test',
        object: 'chat.completion.chunk',
        created: 1,
        model: 'test',
        choices: [{ index: 0, delta: { role: 'assistant', content: JSON.stringify(reply(activeFile, payload)) }, finish_reason: null }],
      }
      const end = { ...chunk, choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] }
      return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(end)}\n\ndata: [DONE]\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      })
    },
  })
  try {
    await mkdir(join(dir, '.config/polkacodes'), { recursive: true })
    await mkdir(join(dir, 'examples'))
    await writeFile(join(dir, '.config/polkacodes/config.yml'), 'memory:\n  enabled: false\n')
    await writeFile(
      join(dir, '.polkacodes.yml'),
      `defaultProvider: openai-compatible\ndefaultModel: test\nretryCount: 0\nproviders:\n  openai-compatible:\n    apiKey: test\n    baseUrl: http://127.0.0.1:${server.port}/v1\n`,
    )
    let commands = 0
    for (const file of files) {
      const content = await readFile(join(root, 'examples', file), 'utf8')
      await writeFile(join(dir, 'examples', file), content)
      for (const command of content.matchAll(/^# Usage: polka (.+)$/gm)) {
        const args = [...command[1].matchAll(/"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2])
        activeFile = file
        steps = []
        const child = Bun.spawn([process.execPath, cli, ...args, '--yes'], {
          cwd: dir,
          env: { ...process.env, HOME: dir },
          stdout: 'pipe',
          stderr: 'pipe',
        })
        const [code, stdout, stderr] = await Promise.all([
          child.exited,
          new Response(child.stdout).text(),
          new Response(child.stderr).text(),
        ])
        expect({ file, code, failed: (stdout + stderr).includes('Workflow failed') }).toEqual({ file, code: 0, failed: false })
        expect(steps.at(-1)).toBe('summary')
        commands++
      }
    }
    expect(commands).toBe(7)
  } finally {
    server.stop(true)
    await rm(dir, { recursive: true, force: true })
  }
}, 30000)
