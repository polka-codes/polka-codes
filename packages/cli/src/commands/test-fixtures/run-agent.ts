import { Command } from 'commander'
import { runAgent } from '../agent'

const command = new Command().option('--config <path>').option('--yes')
command.parse(['--config', process.argv[2], '--yes'], { from: 'user' })
await runAgent('Inspect the example package', { approvalLevel: 'all' }, command)

// Exercise a task workflow through the same initialized registry and inherited base input.
const { runWorkflow } = await import('../../runWorkflow')
const { invokeWorkflow } = await import('../../agent/workflow-adapter')
const { getBaseWorkflowOptions } = await import('../../utils/command')
const options = getBaseWorkflowOptions(command)
const result = await runWorkflow(
  async (input, context) =>
    invokeWorkflow(
      'plan',
      { task: 'Inspect the package' },
      {
        ...context,
        workingDir: process.cwd(),
        stateDir: process.cwd(),
        sessionId: 'contract-test',
        workflowInput: input,
      },
    ),
  {},
  { commandName: 'agent', context: options, logger: options.logger, interactive: false },
)
if (!result?.success) throw new Error('Task workflow failed')
console.log('PLAN_WORKFLOW_OK')
