import { execFileSync, execSync } from 'node:child_process'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createContext, type Logger } from '@polka-codes/core'
import type { CliToolRegistry } from '../../workflow-tools'
import { mergeConfig } from '../config'
import { DEFAULT_AGENT_CONFIG } from '../constants'
import { AutonomousAgent } from '../orchestrator'
import type { CliWorkflowContext } from '../types'

const [mode, level, terminal] = process.argv.slice(2)
if (terminal === 'tty') Object.defineProperty(process.stdin, 'isTTY', { value: true })
const config = mergeConfig(DEFAULT_AGENT_CONFIG, { approval: { level }, stateDir: join(process.cwd(), '.polka/state') })
let taskCalls = 0
let modelCalls = 0
let stop: Promise<void> | undefined
const logger: Logger = {
  debug: () => {},
  warn: console.log,
  error: console.log,
  info: (...args: unknown[]) => {
    console.log(...args)
    if (String(args[0]).startsWith('[Continuous] Plan execution complete:')) stop = agent.stop()
  },
}
const unused = async () => {
  throw new Error('Unexpected tool call')
}
const tools = createContext<CliToolRegistry>(
  {
    executeCommand: async (input) => ({
      stdout: input.shell ? execSync(input.command, { encoding: 'utf8' }) : execFileSync(input.command, input.args, { encoding: 'utf8' }),
      stderr: '',
      exitCode: 0,
    }),
    readFile: ({ path }) => readFile(path, 'utf8'),
    generateText: async ({ messages }) => {
      const decomposition = mode === 'goal' && modelCalls++ === 0
      if (!decomposition) {
        taskCalls++
        console.log('TASK_WORKFLOW_STARTED')
      }
      return {
        requestMessages: messages,
        responseMessages: [
          {
            role: 'assistant',
            content: JSON.stringify(
              decomposition
                ? {
                    requirements: ['Inspect project'],
                    highLevelPlan: 'Inspect the current project configuration.',
                    risks: [],
                    tasks: [
                      {
                        title: 'Inspect project',
                        description: 'Inspect the current project configuration.',
                        type: 'other',
                        priority: 'low',
                        complexity: 'low',
                        estimatedTime: 1,
                      },
                    ],
                  }
                : mode === 'continuous' && taskCalls > 1
                  ? { summary: 'Verified project configuration.' }
                  : { plan: 'Inspect the current project configuration.' },
            ),
          },
        ],
      }
    },
    taskEvent: async () => {},
    getMemoryContext: async () => '',
    invokeTool: unused,
    createCommit: unused,
    printChangeFile: unused,
    confirm: unused,
    input: unused,
    select: unused,
    writeToFile: async ({ path, content }) => {
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, content)
    },
    readMemory: unused,
    listMemoryTopics: unused,
    updateMemory: async () => {},
    listTodoItems: unused,
    getTodoItem: unused,
    updateTodoItem: unused,
    createPullRequest: unused,
    runAgent: unused,
  },
  undefined,
  logger,
)
const context: CliWorkflowContext = {
  ...tools,
  sessionId: 'approval-test',
  workingDir: process.cwd(),
  stateDir: join(process.cwd(), '.polka/state'),
  workflowInput: {
    interactive: false,
    additionalTools: {},
    config: { scripts: { check: 'true' }, loadRules: { 'AGENTS.md': false, 'CLAUDE.md': false } },
  },
}
const agent = new AutonomousAgent(config, context)
await agent.initialize()
try {
  if (mode === 'goal') {
    await agent.setGoal('Inspect project')
    await agent.run()
  } else await agent.runContinuous()
} catch (error) {
  if (!(error instanceof Error && error.message.includes('failed, stopping execution'))) throw error
} finally {
  await stop
  await agent.cleanup()
}
const state = await agent.getState()
console.log(
  `RESULT:${JSON.stringify({ taskCalls, queued: state?.taskQueue.length, completed: state?.completedTasks.map((t) => t.status), blocked: state?.blockedTasks.map((t) => t.status) })}`,
)
