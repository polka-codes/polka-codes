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

  const { file, workflow: workflowName, continuous, until, interval, maxIterations } = command.opts()

  if (!file) {
    logger.error('Error: Workflow file is required. Use -f or --file.')
    return
  }

  // Read and parse workflow file
  logger.info(`Loading workflow from '${file}'...`)
  let content: string
  try {
    content = await readFile(file, 'utf-8')
  } catch (e) {
    logger.error(`Error reading file '${file}': ${e}`)
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

  // Handle continuous/loop mode
  if (continuous || until) {
    const maxIter = maxIterations ?? (continuous ? 0 : 100) // 0 = infinite for continuous mode
    const sleepInterval = interval ?? 5000 // Default 5 seconds between iterations

    logger.info(`🔄 Running workflow in continuous mode`)
    if (maxIter > 0) {
      logger.info(`   Max iterations: ${maxIter}`)
    } else {
      logger.info(`   Max iterations: unlimited`)
    }
    if (until) {
      logger.info(`   Until condition: ${until}`)
    }
    logger.info(`   Sleep interval: ${sleepInterval}ms`)
    logger.info('')

    let iteration = 0
    while (maxIter === 0 || iteration < maxIter) {
      iteration++
      logger.info(`\n${'='.repeat(60)}`)
      logger.info(`Iteration ${iteration}${maxIter > 0 ? ` / ${maxIter}` : ''}`)
      logger.info(`${'='.repeat(60)}\n`)

      try {
        await runWorkflow(workflowFn, workflowInput, { commandName: 'workflow', context: globalOpts, logger })

        // Check if we should stop based on --until condition
        if (until) {
          // Simple evaluation for now - could be enhanced
          // For now, just check if until is a simple boolean or string comparison
          if (until === 'true' || until === 'success') {
            logger.info(`\n✅ Until condition met: ${until}`)
            break
          }
        }
      } catch (error) {
        logger.error(`\n❌ Workflow execution failed: ${error}`)
        if (continuous) {
          logger.info(`Continuing to next iteration...`)
        } else {
          throw error
        }
      }

      // Sleep between iterations
      if (maxIter === 0 || iteration < maxIter) {
        logger.info(`\n⏱️  Sleeping for ${sleepInterval}ms before next iteration...`)
        await new Promise((resolve) => setTimeout(resolve, sleepInterval))
      }
    }

    logger.info(`\n✅ Continuous mode completed after ${iteration} iteration(s)`)
    return
  }

  // Single execution mode
  await runWorkflow(workflowFn, workflowInput, { commandName: 'workflow', context: globalOpts, logger })
}

export const workflowCommand = new Command('workflow')
  .description('Run custom workflows.')
  .argument('[task]', 'The task input for the workflow.')
  .option('-f, --file <path>', 'Path to the workflow file (required)')
  .option('-w, --workflow <name>', 'The name of the workflow to run')
  .option('-c, --continuous', 'Run workflow continuously (until manually stopped)')
  .option('-u, --until <condition>', 'Run workflow until condition is met (e.g., "success", "true")')
  .option('-i, --interval <ms>', 'Sleep interval between iterations in milliseconds (default: 5000)', '5000')
  .option('-m, --max-iterations <n>', 'Maximum number of iterations (default: unlimited for --continuous, 100 for --until)', '100')
  .action(runWorkflowCommand)
