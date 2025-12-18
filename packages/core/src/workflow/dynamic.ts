import { parse } from 'yaml'
import { z } from 'zod'
import { parseJsonFromMarkdown } from '../Agent/parseJsonFromMarkdown'
import type { FullAgentToolInfo, ToolResponseResult } from '../tool'
import { ToolResponseType } from '../tool'
import { type AgentToolRegistry, agentWorkflow } from './agent.workflow'
import { type WorkflowDefinition, type WorkflowFile, WorkflowFileSchema, type WorkflowStepDefinition } from './dynamic-types'
import type { Logger, StepFn, ToolRegistry, WorkflowContext, WorkflowTools } from './workflow'

/**
 * Tool groups that can be used in step.tools arrays.
 * - "readonly": File reading operations only
 * - "readwrite": Full file system access
 * - "internet": Network operations (fetch, search)
 * - "all": All available tools (special keyword, not in this map)
 */
export const TOOL_GROUPS: Record<string, string[]> = {
  readonly: ['readFile', 'readBinaryFile', 'listFiles', 'searchFiles'],
  readwrite: ['readFile', 'readBinaryFile', 'listFiles', 'searchFiles', 'writeToFile', 'replaceInFile', 'removeFile', 'renameFile'],
  internet: ['fetchUrl', 'search'],
}

export type RunWorkflowTool = { input: { workflowId: string; input?: any }; output: any }

export type DynamicWorkflowRegistry = ToolRegistry & { runWorkflow: RunWorkflowTool }

export type DynamicWorkflowParseResult = { success: true; definition: WorkflowFile } | { success: false; error: string }

export function parseDynamicWorkflowDefinition(source: string): DynamicWorkflowParseResult {
  try {
    const raw = parse(source)
    const validated = WorkflowFileSchema.safeParse(raw)
    if (!validated.success) {
      return { success: false, error: z.prettifyError(validated.error) }
    }
    return { success: true, definition: validated.data }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export type DynamicStepRuntimeContext<TTools extends ToolRegistry> = {
  workflowId: string
  stepId: string
  input: Record<string, any>
  state: Record<string, any>
  tools: WorkflowTools<TTools>
  logger: Logger
  step: StepFn
  runWorkflow: (workflowId: string, input?: Record<string, any>) => Promise<any>
  toolInfo: Readonly<FullAgentToolInfo[]> | undefined
}

export type DynamicWorkflowRunnerOptions = {
  /**
   * Tool definitions used when a step does not have persisted `code`
   * and needs to be executed via `agentWorkflow`.
   */
  toolInfo?: Readonly<FullAgentToolInfo[]>
  /**
   * Model id forwarded to `agentWorkflow` for agent-executed steps.
   */
  model?: string
  /**
   * Maximum round trips for agent-executed steps.
   */
  maxToolRoundTrips?: number
  /**
   * Opt-in to execute persisted step `code` strings.
   * When false, steps without code must be agent-executed.
   */
  allowUnsafeCodeExecution?: boolean
  /**
   * Customize per-step system prompt for agent-executed steps.
   */
  stepSystemPrompt?: (args: { workflowId: string; step: WorkflowStepDefinition; input: any; state: any }) => string
  /**
   * Whether to wrap plain text agent responses in an object { result: ... }.
   * Defaults to false.
   */
  wrapAgentResultInObject?: boolean
}

type CompiledStepFn<TTools extends ToolRegistry> = (ctx: DynamicStepRuntimeContext<TTools>) => Promise<any>

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (arg1: string, arg2: string) => (ctx: any) => Promise<any>

function validateAndApplyDefaults(workflowId: string, workflow: WorkflowDefinition, input: Record<string, any>): Record<string, any> {
  if (!workflow.inputs || workflow.inputs.length === 0) {
    return input
  }

  const validatedInput: Record<string, any> = {}
  const errors: string[] = []

  for (const inputDef of workflow.inputs) {
    const providedValue = input[inputDef.id]

    if (providedValue !== undefined && providedValue !== null) {
      validatedInput[inputDef.id] = providedValue
    } else if (inputDef.default !== undefined && inputDef.default !== null) {
      validatedInput[inputDef.id] = inputDef.default
    } else {
      errors.push(`Missing required input '${inputDef.id}'${inputDef.description ? `: ${inputDef.description}` : ''}`)
    }
  }

  if (errors.length > 0) {
    throw new Error(`Workflow '${workflowId}' input validation failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`)
  }

  return validatedInput
}

function createRunWorkflowFn<TTools extends ToolRegistry>(args: {
  input: Record<string, any>
  state: Record<string, any>
  context: WorkflowContext<TTools>
  runInternal: (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ) => Promise<any>
}) {
  return async (subWorkflowId: string, subInput?: Record<string, any>) => {
    const mergedInput = { ...args.input, ...args.state, ...(subInput ?? {}) }
    return await args.runInternal(subWorkflowId, mergedInput, args.context, args.state)
  }
}

function compileStep<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  workflowId: string,
  compiledSteps: Map<string, CompiledStepFn<TTools>>,
): CompiledStepFn<TTools> {
  const key = `${workflowId}.${stepDef.id}`
  const existing = compiledSteps.get(key)
  if (existing) {
    return existing
  }

  if (!stepDef.code) {
    throw new Error(`Step '${stepDef.id}' in workflow '${workflowId}' has no code`)
  }

  try {
    const fn = new AsyncFunction('ctx', stepDef.code) as CompiledStepFn<TTools>
    compiledSteps.set(key, fn)
    return fn
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const codePreview = stepDef.code.length > 200 ? `${stepDef.code.substring(0, 200)}...` : stepDef.code
    throw new Error(
      `Failed to compile code for step '${stepDef.id}' in workflow '${workflowId}':\n` +
        `  Error: ${errorMsg}\n` +
        `  Code:\n${codePreview
          .split('\n')
          .map((line) => `    ${line}`)
          .join('\n')}`,
    )
  }
}

async function executeStepWithAgent<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  workflowId: string,
  input: Record<string, any>,
  state: Record<string, any>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  runInternal: (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ) => Promise<any>,
): Promise<any> {
  const tools = context.tools as unknown as WorkflowTools<AgentToolRegistry>
  if (typeof tools.generateText !== 'function' || typeof tools.invokeTool !== 'function' || typeof tools.taskEvent !== 'function') {
    throw new Error(
      `Step '${stepDef.id}' in workflow '${workflowId}' requires agent execution, but AgentToolRegistry tools are not available.`,
    )
  }

  if (!options.toolInfo) {
    throw new Error(
      `Step '${stepDef.id}' in workflow '${workflowId}' requires agent execution, but no toolInfo was provided to DynamicWorkflowRunner.`,
    )
  }

  const rawAllowedToolNames = stepDef.tools
  let toolsForAgent: FullAgentToolInfo[]

  if (rawAllowedToolNames) {
    const expandedToolNames = new Set<string>()
    let includeAll = false

    for (const name of rawAllowedToolNames) {
      if (name === 'all') {
        includeAll = true
        break
      }
      if (Object.hasOwn(TOOL_GROUPS, name)) {
        for (const tool of TOOL_GROUPS[name]) {
          expandedToolNames.add(tool)
        }
      } else {
        expandedToolNames.add(name)
      }
    }

    if (includeAll) {
      toolsForAgent = [...options.toolInfo]
    } else {
      toolsForAgent = options.toolInfo.filter((t) => expandedToolNames.has(t.name))
    }
  } else {
    toolsForAgent = [...options.toolInfo]
  }

  if (!rawAllowedToolNames || rawAllowedToolNames.includes('all') || rawAllowedToolNames.includes('runWorkflow')) {
    toolsForAgent.push({
      name: 'runWorkflow',
      description: 'Run a named sub-workflow defined in the current workflow file.',
      parameters: z.object({
        workflowId: z.string().describe('Sub-workflow id to run'),
        input: z.any().nullish().describe('Optional input object for the sub-workflow'),
      }),
      handler: async () => {
        return { type: ToolResponseType.Error, message: { type: 'error-text', value: 'runWorkflow is virtual.' } }
      },
    })
  }

  const allowedToolNameSet = new Set(toolsForAgent.map((t) => t.name))

  context.logger.debug(`[Agent] Available tools for step '${stepDef.id}': ${toolsForAgent.map((t) => t.name).join(', ')}`)

  const systemPrompt =
    options.stepSystemPrompt?.({ workflowId, step: stepDef, input, state }) ??
    [
      `You are an AI assistant executing a workflow step.`,
      '',
      '# Instructions',
      '- Execute the task defined in the user message.',
      '- Use the provided tools to accomplish the task.',
      '- Return the step output as valid JSON in markdown.',
      '- Do not ask for user input. If information is missing, make a reasonable assumption or fail.',
    ]
      .filter(Boolean)
      .join('\n')

  const userContent = [
    `Workflow: ${workflowId}`,
    `Step: ${stepDef.id}`,
    `Task: ${stepDef.task}`,
    stepDef.expected_outcome ? `Expected outcome: ${stepDef.expected_outcome}` : '',
    `Workflow Input: ${JSON.stringify(input)}`,
    `Current State: ${JSON.stringify(state)}`,
  ]
    .filter(Boolean)
    .join('\n')

  const runWorkflow = createRunWorkflowFn({ input, state, context, runInternal })

  const agentTools: WorkflowTools<AgentToolRegistry> = {
    generateText: tools.generateText.bind(tools),
    taskEvent: tools.taskEvent.bind(tools),
    invokeTool: async ({ toolName, input: toolInput }: { toolName: string; input: any }) => {
      if (!allowedToolNameSet.has(toolName)) {
        return {
          type: ToolResponseType.Error,
          message: { type: 'error-text', value: `Tool '${toolName}' is not allowed in this step.` },
        }
      }

      if (toolName === 'runWorkflow') {
        const subWorkflowId = toolInput?.workflowId
        const subInput = toolInput?.input
        if (typeof subWorkflowId !== 'string') {
          return {
            type: ToolResponseType.Error,
            message: { type: 'error-text', value: 'runWorkflow.workflowId must be a string.' },
          }
        }
        try {
          const output = await runWorkflow(subWorkflowId, subInput)
          const jsonResult: ToolResponseResult = { type: 'json', value: output as any }
          return { type: ToolResponseType.Reply, message: jsonResult }
        } catch (error) {
          return {
            type: ToolResponseType.Error,
            message: { type: 'error-text', value: error instanceof Error ? error.message : String(error) },
          }
        }
      }
      return await tools.invokeTool({ toolName, input: toolInput })
    },
  }

  const result = await agentWorkflow(
    {
      tools: toolsForAgent,
      systemPrompt,
      userMessage: [{ role: 'user', content: userContent }],
      maxToolRoundTrips: options.maxToolRoundTrips,
      model: options.model,
    },
    { ...context, tools: agentTools },
  )

  if (result.type === 'Exit') {
    // Prefer structured object output
    if (result.object !== undefined) {
      return result.object
    }

    // Try to parse JSON from message
    const parsed = parseJsonFromMarkdown(result.message)
    if (parsed.success) {
      return parsed.data
    }

    // If message is a simple string, wrap it in an object for consistency if enabled
    if (options.wrapAgentResultInObject) {
      context.logger.warn(`[Agent] Step '${stepDef.id}' returned plain text instead of JSON. Wrapping in {result: ...}`)
      return { result: result.message }
    }
    return result.message
  }

  if (result.type === 'Error') {
    throw new Error(`Agent step '${stepDef.id}' in workflow '${workflowId}' failed: ${result.error?.message || 'Unknown error'}`)
  }

  if (result.type === 'UsageExceeded') {
    throw new Error(`Agent step '${stepDef.id}' in workflow '${workflowId}' exceeded usage limits (tokens or rounds)`)
  }

  throw new Error(`Agent step '${stepDef.id}' in workflow '${workflowId}' exited unexpectedly with type: ${(result as any).type}`)
}

async function executeStepWithTimeout<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  workflowId: string,
  input: Record<string, any>,
  state: Record<string, any>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  compiledSteps: Map<string, CompiledStepFn<TTools>>,
  runInternal: (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ) => Promise<any>,
): Promise<any> {
  const executeStepLogic = async (): Promise<any> => {
    if (stepDef.code && options.allowUnsafeCodeExecution) {
      context.logger.debug(`[Step] Executing step '${stepDef.id}' with compiled code`)
      const fn = compileStep(stepDef, workflowId, compiledSteps)
      const runWorkflow = createRunWorkflowFn({ input, state, context, runInternal })

      const runtimeCtx: DynamicStepRuntimeContext<TTools> = {
        workflowId,
        stepId: stepDef.id,
        input,
        state,
        tools: context.tools,
        logger: context.logger,
        step: context.step,
        runWorkflow,
        toolInfo: options.toolInfo,
      }

      const result = await fn(runtimeCtx)
      context.logger.debug(`[Step] Compiled code execution completed for step '${stepDef.id}'`)
      return result
    }

    context.logger.debug(`[Step] Executing step '${stepDef.id}' with agent`)
    const result = await executeStepWithAgent(stepDef, workflowId, input, state, context, options, runInternal)
    context.logger.debug(`[Step] Agent execution completed for step '${stepDef.id}'`)
    return result
  }

  // Apply timeout if specified
  if (stepDef.timeout && stepDef.timeout > 0) {
    context.logger.debug(`[Step] Step '${stepDef.id}' has timeout of ${stepDef.timeout}ms`)
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Step '${stepDef.id}' in workflow '${workflowId}' timed out after ${stepDef.timeout}ms`)),
        stepDef.timeout as number,
      )
    })

    try {
      return await Promise.race([executeStepLogic(), timeoutPromise])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  return await executeStepLogic()
}

async function executeStep<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  workflowId: string,
  input: Record<string, any>,
  state: Record<string, any>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  compiledSteps: Map<string, CompiledStepFn<TTools>>,
  runInternal: (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ) => Promise<any>,
): Promise<any> {
  const result = await executeStepWithTimeout(stepDef, workflowId, input, state, context, options, compiledSteps, runInternal)

  // Validate output against schema if provided
  if (stepDef.outputSchema) {
    try {
      const _schema = z.any() // TODO: Convert outputSchema to Zod schema
      // For now, we'll just validate that it's a valid JSON structure
      if (typeof stepDef.outputSchema === 'object') {
        context.logger.debug(`[Step] Validating output for step '${stepDef.id}' against schema`)
        // Basic validation: ensure result matches expected type
        if (stepDef.outputSchema.type === 'object') {
          if (typeof result !== 'object' || result === null || Array.isArray(result)) {
            throw new Error(`Expected object output, got ${Array.isArray(result) ? 'array' : result === null ? 'null' : typeof result}`)
          }
        }
        if (stepDef.outputSchema.type === 'array' && !Array.isArray(result)) {
          throw new Error(`Expected array output, got ${typeof result}`)
        }
      }
    } catch (error) {
      throw new Error(
        `Step '${stepDef.id}' in workflow '${workflowId}' output validation failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  return result
}

export function createDynamicWorkflow<TTools extends ToolRegistry = DynamicWorkflowRegistry>(
  definition: WorkflowFile | string,
  options: DynamicWorkflowRunnerOptions = {},
) {
  if (typeof definition === 'string') {
    const res = parseDynamicWorkflowDefinition(definition)
    if (!res.success) {
      throw new Error(res.error)
    }
    definition = res.definition
  }

  const compiledSteps = new Map<string, CompiledStepFn<TTools>>()

  const runInternal = async (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ): Promise<any> => {
    const workflow = definition.workflows[workflowId]
    if (!workflow) {
      throw new Error(`Workflow '${workflowId}' not found`)
    }

    // Validate inputs and apply defaults
    const validatedInput = validateAndApplyDefaults(workflowId, workflow, input)

    context.logger.info(`[Workflow] Starting workflow '${workflowId}'`)
    context.logger.debug(`[Workflow] Input: ${JSON.stringify(validatedInput)}`)
    context.logger.debug(`[Workflow] Inherited state: ${JSON.stringify(inheritedState)}`)
    context.logger.debug(`[Workflow] Steps: ${workflow.steps.map((s) => s.id).join(', ')}`)

    const state: Record<string, any> = { ...inheritedState }
    let lastOutput: any

    for (let i = 0; i < workflow.steps.length; i++) {
      const stepDef = workflow.steps[i]
      const stepName = `${workflowId}.${stepDef.id}`

      context.logger.info(`[Workflow] Step ${i + 1}/${workflow.steps.length}: ${stepDef.id}`)
      context.logger.debug(`[Workflow] Step task: ${stepDef.task}`)
      if (stepDef.expected_outcome) {
        context.logger.debug(`[Workflow] Expected outcome: ${stepDef.expected_outcome}`)
      }
      context.logger.debug(`[Workflow] Current state keys: ${Object.keys(state).join(', ')}`)

      lastOutput = await context.step(stepName, async () => {
        return await executeStep(stepDef, workflowId, validatedInput, state, context, options, compiledSteps, runInternal)
      })

      const outputKey = stepDef.output ?? stepDef.id
      state[outputKey] = lastOutput

      context.logger.debug(
        `[Workflow] Step output stored as '${outputKey}': ${typeof lastOutput === 'object' ? JSON.stringify(lastOutput).substring(0, 200) : lastOutput}`,
      )
    }

    context.logger.info(`[Workflow] Completed workflow '${workflowId}'`)
    if (workflow.output) {
      context.logger.debug(`[Workflow] Returning output field: ${workflow.output}`)
      return state[workflow.output]
    }
    context.logger.debug(`[Workflow] Returning full state with keys: ${Object.keys(state).join(', ')}`)
    return state
  }

  return async (workflowId: string, input: Record<string, any>, context: WorkflowContext<TTools>) => {
    return await runInternal(workflowId, input, context, {})
  }
}
