import { runWorkflow } from '../runWorkflow'
import type { CliToolRegistry } from '../workflow-tools'

const result = await runWorkflow<Record<string, never>, { success: boolean }, Pick<CliToolRegistry, 'updateMemory'>>(
  async (_input, { tools }) => {
    await tools.updateMemory({ operation: 'replace', topic: 'test', content: 'persisted' })
    return { success: true }
  },
  {},
  {
    commandName: 'code',
    context: { apiProvider: 'deepseek', model: 'deepseek-chat', apiKey: 'test-key', silent: true },
    logger: { debug() {}, info() {}, warn() {}, error() {} },
    errorResult: 'structured',
  },
)
console.log(JSON.stringify(result))
