import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import {
  askFollowupQuestion,
  createDynamicWorkflow,
  type DynamicWorkflowRegistry,
  executeCommand,
  type FullAgentToolInfo,
  fetchUrl,
  generateWorkflowCodeWorkflow,
  generateWorkflowDefinitionWorkflow,
  listFiles,
  parseDynamicWorkflowDefinition,
  readBinaryFile,
  readFile as readFileTool,
  removeFile,
  renameFile,
  replaceInFile,
  searchFiles,
  type WorkflowFile,
  type WorkflowFn,
  writeToFile,
} from '@polka-codes/core'
import { Command } from 'commander'
import { stringify } from 'yaml'
import { createLogger } from '../logger'
import { runWorkflow } from '../runWorkflow'
import type { BaseWorkflowInput } from '../workflows'

async function saveWorkflowFile(path: string, workflow: WorkflowFile) {
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, stringify(workflow))
}

function clearWorkflowCode(workflowDef: WorkflowFile) {
  for (const wf of Object.values(workflowDef.workflows)) {
    for (const step of wf.steps) {
      step.code = undefined
    }
  }
}

export async function runWorkflowCommand(task: string | undefined, _options: any, command: Command) {
  const globalOpts = (command.parent ?? command).opts()
  const { verbose, yes } = globalOpts
  const logger = createLogger({ verbose })

  const { file, regenerate, create, workflow: workflowName } = command.opts()

  if (!file) {
    logger.error('Error: Workflow file is required. Use -f or --file.')
    return
  }

  // Tools available to the dynamic workflow
  const tools: FullAgentToolInfo[] = [
    readFileTool,
    writeToFile,
    replaceInFile,
    searchFiles,
    listFiles,
    executeCommand,
    fetchUrl,
    readBinaryFile,
    removeFile,
    renameFile,
    askFollowupQuestion,
  ]

  const availableTools = tools.map((t) => ({ name: t.name, description: t.description }))

  const isCreate = !!create
  const isUpdate = !!regenerate

  if (isCreate) {
    if (!task) {
      logger.error('Error: Task is required for creating a workflow.')
      return
    }

    logger.info('Generating workflow definition...')
    const defResult = await runWorkflow(
      generateWorkflowDefinitionWorkflow,
      { prompt: task, availableTools },
      { commandName: 'workflow', command, logger, yes },
    )

    if (!defResult) {
      logger.error('Failed to generate workflow definition.')
      return
    }

    logger.info('Generating workflow code...')
    const codeResult = await runWorkflow(
      generateWorkflowCodeWorkflow,
      { workflow: defResult },
      { commandName: 'workflow', command, logger, yes },
    )

    if (!codeResult) {
      logger.error('Failed to generate workflow code.')
      return
    }

    await saveWorkflowFile(file, codeResult)
    logger.info(`Workflow saved to '${file}'.`)
    return
  }

  if (isUpdate) {
    let workflowDef: WorkflowFile | undefined
    try {
      const content = await readFile(file, 'utf-8')
      const res = parseDynamicWorkflowDefinition(content)
      if (!res.success) {
        throw new Error(res.error)
      }
      workflowDef = res.definition
    } catch (e) {
      logger.error(`Error reading or parsing file '${file}': ${e}`)
      return
    }

    if (task) {
      logger.info('Updating workflow definition...')
      const updatePrompt = `Current workflow definition:\n${JSON.stringify(workflowDef, null, 2)}\n\nUpdate request: ${task}\n\nReturn the updated workflow definition.`
      const defResult = await runWorkflow(
        generateWorkflowDefinitionWorkflow,
        { prompt: updatePrompt, availableTools },
        { commandName: 'workflow', command, logger, yes },
      )

      if (!defResult) {
        logger.error('Failed to update workflow definition.')
        return
      }
      workflowDef = defResult
    } else {
      logger.info('Clearing existing code for regeneration...')
      clearWorkflowCode(workflowDef)
    }

    logger.info('Generating workflow code...')
    const codeResult = await runWorkflow(
      generateWorkflowCodeWorkflow,
      { workflow: workflowDef },
      { commandName: 'workflow', command, logger, yes },
    )

    if (!codeResult) {
      logger.error('Failed to generate workflow code.')
      return
    }

    await saveWorkflowFile(file, codeResult)
    logger.info(`Workflow saved to '${file}'.`)
    return
  }

  // Execute Mode
  logger.info(`Executing workflow from '${file}'...`)
  let content: string
  try {
    content = await readFile(file, 'utf-8')
  } catch (e) {
    logger.error(`Error reading file '${file}': ${e}`)
    return
  }

  logger.warn('Warning: allowUnsafeCodeExecution is enabled. This workflow has full access to your system.')

  const parsedResult = parseDynamicWorkflowDefinition(content)
  if (!parsedResult.success) {
    logger.error(`Failed to parse workflow: ${parsedResult.error}`)
    return
  }
  const workflowDef = parsedResult.definition

  const workflowNames = Object.keys(workflowDef.workflows)

  let workflowId = workflowName
  if (!workflowId) {
    if (workflowNames.includes('main')) {
      workflowId = 'main'
    } else if (workflowNames.length === 1) {
      workflowId = workflowNames[0]
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
  }

  let dynamicRunner: ReturnType<typeof createDynamicWorkflow>
  try {
    dynamicRunner = createDynamicWorkflow(workflowDef, {
      allowUnsafeCodeExecution: true,
      toolInfo: tools,
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
  }

  await runWorkflow(workflowFn, workflowInput, { commandName: 'workflow', command, logger, yes })
}

export const workflowCommand = new Command('workflow')
  .description('Generate, manage, and run custom workflows.')
  .argument('[task]', 'The task description for generating the workflow.')
  .option('-f, --file <path>', 'Path to the workflow file')
  .option('-w, --workflow <name>', 'The name of the workflow to run')
  .option('--create', 'Create a new workflow')
  .option('--regenerate', 'Regenerate the code for the workflow')
  .action(runWorkflowCommand)
