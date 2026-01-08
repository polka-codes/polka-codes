import { readFile } from 'node:fs/promises'
import {
  askFollowupQuestion,
  createDynamicWorkflow,
  type DynamicWorkflowRegistry,
  type FullToolInfo,
  listFiles,
  parseDynamicWorkflowDefinition,
  type WorkflowFn,
} from '@polka-codes/core'
import { Command } from 'commander'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import { type BaseWorkflowInput, commitWorkflow, fixWorkflow, planWorkflow, prWorkflow, reviewWorkflow } from '../workflows'

export async function runWorkflowCommand(task: string | undefined, _options: any, command: Command) {
  const globalOpts = (command.parent ?? command).opts()
  const { verbose } = globalOpts
  const logger = createLogger({ verbose })

  const { file, workflow: workflowName } = command.opts()

  if (!file) {
    logger.error('Error: Workflow file is required. Use -f or --file.')
    return
  }

  // Read and parse workflow file
  logger.info(`Loading workflow from '${file}'...`)
  let content: string
  try {
    content = await readFile(file, 'utf-8')
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(`Error reading file '${file}': ${errorMessage}`)
    return
  }

  const parsedResult = parseDynamicWorkflowDefinition(content)
  if (!parsedResult.success) {
    logger.error(`Failed to parse workflow: ${parsedResult.error}`)
    return
  }
  const workflowDef = parsedResult.definition

  const workflowNames = Object.keys(workflowDef.workflows)
  logger.info(`Available workflows: ${workflowNames.join(', ')}`)

  let workflowId = workflowName
  if (!workflowId) {
    if (workflowNames.includes('main')) {
      workflowId = 'main'
      logger.info(`Using 'main' workflow`)
    } else if (workflowNames.length === 1) {
      workflowId = workflowNames[0]
      logger.info(`Using workflow '${workflowId}'`)
    } else if (workflowNames.length > 1) {
      logger.error(
        `Multiple workflows found in file and no 'main' workflow. Please specify one using --workflow <name>. Available workflows: ${workflowNames.join(', ')}`,
      )
      return
    } else {
      logger.error('No workflows found in file.')
      return
    }
  } else {
    if (!workflowNames.includes(workflowId)) {
      logger.error(`Workflow '${workflowId}' not found in file. Available workflows: ${workflowNames.join(', ')}`)
      return
    }
    logger.info(`Using workflow '${workflowId}'`)
  }

  // Create dynamic workflow runner
  const tools: FullToolInfo[] = [listFiles, askFollowupQuestion]

  let dynamicRunner: ReturnType<typeof createDynamicWorkflow>
  try {
    dynamicRunner = createDynamicWorkflow(workflowDef, {
      toolInfo: tools,
      builtInWorkflows: {
        plan: planWorkflow,
        fix: fixWorkflow,
        review: reviewWorkflow,
        commit: commitWorkflow,
        pr: prWorkflow,
      },
    })
  } catch (error: any) {
    logger.error(`Failed to parse workflow: ${error.message}`)
    return
  }

  const workflowFn: WorkflowFn<BaseWorkflowInput, any, DynamicWorkflowRegistry> = async (input, context) => {
    return dynamicRunner(workflowId, input, context)
  }

  const selectedWorkflow = workflowDef.workflows[workflowId]
  const workflowInput: Record<string, any> = {}
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

  await runWorkflow(workflowFn, workflowInput, { commandName: 'workflow', context: globalOpts, logger })
}

export const workflowCommand = new Command('workflow')
  .description('Run custom workflows.')
  .argument('[task]', 'The task input for the workflow.')
  .option('-f, --file <path>', 'Path to the workflow file (required)')
  .option('-w, --workflow <name>', 'The name of the workflow to run')
  .action(runWorkflowCommand)
