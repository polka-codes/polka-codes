import { readFile } from 'node:fs/promises'
import { createDynamicWorkflow, type DynamicWorkflowRegistry, parseDynamicWorkflowDefinition, type WorkflowFn } from '@polka-codes/core'
import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import { toolHandlers } from '../tool-implementations'
import { getBaseWorkflowOptions } from '../utils/command'
import { type BaseWorkflowInput, commitWorkflow, fixWorkflow, planWorkflow, prWorkflow, reviewWorkflow } from '../workflows'

export async function runWorkflowCommand(task: string | undefined, _options: unknown, command: Command) {
  const workflowOpts = getBaseWorkflowOptions(command)
  const { verbose } = workflowOpts
  const logger = createLogger({ verbose })

  const { file, workflow: workflowName } = command.opts()

  // Read and parse workflow file
  logger.info(`Loading workflow from '${file}'...`)
  let content: string
  try {
    content = await readFile(file, 'utf-8')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    command.error(`Error reading file '${file}': ${errorMessage}`)
  }

  const parsedResult = parseDynamicWorkflowDefinition(content)
  if (!parsedResult.success) {
    command.error(`Failed to parse workflow: ${parsedResult.error}`)
  }
  const workflowDef = parsedResult.definition

  const workflowNames = Object.keys(workflowDef.workflows)
  logger.info(`Available workflows: ${workflowNames.join(', ')}`)

  const workflowId = workflowName ?? (workflowNames.includes('main') ? 'main' : workflowNames.length === 1 ? workflowNames[0] : undefined)
  if (!workflowId) {
    command.error(
      workflowNames.length === 0
        ? 'No workflows found in file.'
        : `Multiple workflows found in file and no 'main' workflow. Please specify one using --workflow <name>. Available workflows: ${workflowNames.join(', ')}`,
    )
  }
  if (!workflowNames.includes(workflowId)) {
    command.error(`Workflow '${workflowId}' not found in file. Available workflows: ${workflowNames.join(', ')}`)
  }
  logger.info(`Using workflow '${workflowId}'`)

  // Create dynamic workflow runner
  let dynamicRunner: ReturnType<typeof createDynamicWorkflow>
  try {
    dynamicRunner = createDynamicWorkflow(workflowDef, {
      toolInfo: [...toolHandlers.values()],
      builtInWorkflows: {
        plan: planWorkflow,
        fix: fixWorkflow,
        review: reviewWorkflow,
        commit: commitWorkflow,
        pr: prWorkflow,
      },
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    command.error(`Failed to parse workflow: ${errorMessage}`)
  }

  const workflowFn: WorkflowFn<BaseWorkflowInput, unknown, DynamicWorkflowRegistry> = async (input, context) => {
    return dynamicRunner(workflowId, input, context)
  }

  const selectedWorkflow = workflowDef.workflows[workflowId]
  const workflowInput: Record<string, unknown> = {}
  if (selectedWorkflow.inputs && selectedWorkflow.inputs.length > 0 && task) {
    const firstInput = selectedWorkflow.inputs[0]
    workflowInput[firstInput.id] = task
    logger.info(`Workflow input '${firstInput.id}': ${task}`)
  } else if (selectedWorkflow.inputs && selectedWorkflow.inputs.length > 0) {
    logger.info(`Workflow expects inputs: ${selectedWorkflow.inputs.map((i) => i.id).join(', ')}`)
  } else {
    logger.info('Workflow has no inputs')
  }

  logger.info(`Workflow has ${selectedWorkflow.steps.length} step(s)`)
  logger.debug(
    `Steps: ${selectedWorkflow.steps
      .map((s) => {
        // Type guard to check if step has id and task properties (basic workflow step)
        if ('id' in s && 'task' in s) {
          return `${s.id} (${s.task})`
        }
        // For control flow steps, just show the id
        return 'id' in s ? String(s.id) : '(unnamed step)'
      })
      .join(', ')}`,
  )

  await runWorkflow(workflowFn, workflowInput, { commandName: 'workflow', context: workflowOpts, logger })
}

export const workflowCommand = new Command('workflow')
  .description('Run custom workflows.')
  .argument('[task]', 'The task input for the workflow.')
  .requiredOption('-f, --file <path>', 'Path to the workflow file')
  .option('-w, --workflow <name>', 'The name of the workflow to run')
  .action(runWorkflowCommand)
