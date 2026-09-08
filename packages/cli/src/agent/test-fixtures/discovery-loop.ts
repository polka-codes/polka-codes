import { execFileSync } from 'node:child_process'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createContext, type Logger } from '@polka-codes/core'
import { DEFAULT_AGENT_CONFIG } from '../constants'
import { createContinuousImprovementLoop } from '../improvement-loop'
import { AgentStateManager } from '../state-manager'
import type { CliWorkflowContext } from '../types'

const stateManager = new AgentStateManager(join(process.cwd(), '.polka/state'), 'discovery-test')
await stateManager.initialize(DEFAULT_AGENT_CONFIG)
let executions = 0
const ids: string[] = []
const logger: Logger = {
  debug: () => {},
  warn: console.log,
  error: console.log,
  info: (...args: unknown[]) => {
    console.log(...args)
    if (String(args[0]).startsWith('[Continuous] Plan execution complete:') || args[0] === '[Continuous] No tasks discovered')
      void loop.stop()
  },
}
const context: CliWorkflowContext<Record<string, never>> = {
  ...createContext({}, undefined, logger),
  sessionId: 'discovery-test',
  workingDir: process.cwd(),
  stateDir: '.polka/state',
}
const loop = createContinuousImprovementLoop(context, stateManager, async (task) => {
  executions++
  ids.push(task.id)
  await writeFile('source.txt', 'fixed')
  await stateManager.moveTask(task.id, 'queue', 'completed')
  return true
})
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })
await loop.start()
if (executions !== 1) throw new Error('Initial failure was hidden by the legacy cache')
await loop.start()
if (executions !== 1) throw new Error('Completed uncommitted fix was re-enqueued')
await writeFile('source.txt', 'new failure')
await loop.start()
if (ids.length !== 2 || ids[0] === ids[1]) throw new Error('New uncommitted failure was not rediscovered')
if (head !== execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })) throw new Error('Test must keep HEAD unchanged')
console.log('FRESH_DISCOVERY_OK')
