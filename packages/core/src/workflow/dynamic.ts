import { parse } from 'yaml'
import { z } from 'zod'
import { parseJsonFromMarkdown } from '../Agent/parseJsonFromMarkdown'
import type { FullToolInfo, ToolResponseResult } from '../tool'
import { type AgentToolRegistry, agentWorkflow } from './agent.workflow'
import {
  type ValidationResult,
  type WorkflowControlFlowStep,
  type WorkflowDefinition,
  type WorkflowFile,
  WorkflowFileSchema,
  type WorkflowStepDefinition,
} from './dynamic-types'
import type { Logger, StepFn, ToolRegistry, WorkflowContext, WorkflowFn, WorkflowTools } from './workflow'

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

/**
 * Validate a workflow file for common issues
 */
export function validateWorkflowFile(definition: WorkflowFile): ValidationResult {
  const errors: string[] = []

  // Check each workflow
  for (const [workflowId, workflow] of Object.entries(definition.workflows)) {
    // Validate steps exist
    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push(`Workflow '${workflowId}' has no steps`)
      continue
    }

    // Collect all workflow IDs for circular reference check
    const _allWorkflowIds = new Set(Object.keys(definition.workflows))

    // Check for break/continue outside loops
    const checkBreakOutsideLoop = (steps: WorkflowControlFlowStep[], inLoop: boolean, path: string): void => {
      for (const step of steps) {
        if (isBreakStep(step) || isContinueStep(step)) {
          if (!inLoop) {
            errors.push(`${path} has break/continue outside of a loop`)
          }
        }
        if (isWhileLoopStep(step)) {
          const whileStep = step as any
          checkBreakOutsideLoop(whileStep.while.steps, true, `${path}/${whileStep.id}`)
        }
        if (isIfElseStep(step)) {
          const ifElseStep = step as any
          if (ifElseStep.if.thenBranch) {
            checkBreakOutsideLoop(ifElseStep.if.thenBranch, inLoop, `${path}/${ifElseStep.id}/then`)
          }
          if (ifElseStep.if.elseBranch) {
            checkBreakOutsideLoop(ifElseStep.if.elseBranch, inLoop, `${path}/${ifElseStep.id}/else`)
          }
        }
        if (isTryCatchStep(step)) {
          const tryCatchStep = step as any
          checkBreakOutsideLoop(tryCatchStep.try.trySteps, inLoop, `${path}/${tryCatchStep.id}/try`)
          checkBreakOutsideLoop(tryCatchStep.try.catchSteps, inLoop, `${path}/${tryCatchStep.id}/catch`)
        }
      }
    }

    checkBreakOutsideLoop(workflow.steps, false, workflowId)

    // Check for runWorkflow calls to non-existent workflows
    const findRunWorkflowCalls = (steps: WorkflowControlFlowStep[], path: string): void => {
      for (const step of steps) {
        if (isWhileLoopStep(step)) {
          const whileStep = step as any
          findRunWorkflowCalls(whileStep.while.steps, `${path}/${whileStep.id}`)
        }
        if (isIfElseStep(step)) {
          const ifElseStep = step as any
          if (ifElseStep.if.thenBranch) {
            findRunWorkflowCalls(ifElseStep.if.thenBranch, `${path}/${ifElseStep.id}/then`)
          }
          if (ifElseStep.if.elseBranch) {
            findRunWorkflowCalls(ifElseStep.if.elseBranch, `${path}/${ifElseStep.id}/else`)
          }
        }
        if (isTryCatchStep(step)) {
          const tryCatchStep = step as any
          findRunWorkflowCalls(tryCatchStep.try.trySteps, `${path}/${tryCatchStep.id}/try`)
          findRunWorkflowCalls(tryCatchStep.try.catchSteps, `${path}/${tryCatchStep.id}/catch`)
        }
      }
    }

    findRunWorkflowCalls(workflow.steps, workflowId)
  }

  if (errors.length > 0) {
    return { success: false, errors }
  }

  return { success: true }
}

export function parseDynamicWorkflowDefinition(source: string): DynamicWorkflowParseResult {
  try {
    const raw = parse(source)
    const validated = WorkflowFileSchema.safeParse(raw)
    if (!validated.success) {
      return { success: false, error: z.prettifyError(validated.error) }
    }

    // Additional validation for structural issues
    const validation = validateWorkflowFile(validated.data)
    if (!validation.success) {
      return { success: false, error: `Workflow validation failed:\n${validation.errors.map((e: string) => `  - ${e}`).join('\n')}` }
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
  toolInfo: Readonly<FullToolInfo[]> | undefined
  agentTools: Record<string, (input: any) => Promise<any>>
}

export type DynamicWorkflowRunnerOptions = {
  /**
   * Tool definitions used when a step does not have persisted `code`
   * and needs to be executed via `agentWorkflow`.
   */
  toolInfo?: Readonly<FullToolInfo[]>
  /**
   * Model id forwarded to `agentWorkflow` for agent-executed steps.
   */
  model?: string
  /**
   * Maximum round trips for agent-executed steps.
   */
  maxToolRoundTrips?: number
  /**
   * Customize per-step system prompt for agent-executed steps.
   */
  stepSystemPrompt?: (args: { workflowId: string; step: WorkflowStepDefinition; input: any; state: any }) => string
  /**
   * Whether to wrap plain text agent responses in an object { result: ... }.
   * Defaults to false.
   */
  wrapAgentResultInObject?: boolean
  /**
   * Built-in workflows that can be called by name if not found in the definition.
   */
  builtInWorkflows?: Record<string, WorkflowFn<any, any, any>>
}

function validateAndApplyDefaults(workflowId: string, workflow: WorkflowDefinition, input: Record<string, any>): Record<string, any> {
  if (!workflow.inputs || workflow.inputs.length === 0) {
    return input
  }

  const validatedInput: Record<string, any> = { ...input }
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

/**
 * Safely evaluate a condition expression with access to input and state
 */
function evaluateCondition(condition: string, input: Record<string, any>, state: Record<string, any>): boolean {
  const functionBody = `
    try {
      return ${condition};
    } catch (error) {
      throw new Error('Condition evaluation failed: ' + (error instanceof Error ? error.message : String(error)));
    }
  `

  try {
    const fn = new Function('input', 'state', functionBody)
    const result = fn(input, state)
    return Boolean(result)
  } catch (error) {
    throw new Error(`Failed to evaluate condition: ${condition}. Error: ${error instanceof Error ? error.message : String(error)}`)
  }
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
  let toolsForAgent: FullToolInfo[]

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
        return { success: false, message: { type: 'error-text', value: 'runWorkflow is virtual.' } }
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
          success: false,
          message: { type: 'error-text', value: `Tool '${toolName}' is not allowed in this step.` },
        }
      }

      if (toolName === 'runWorkflow') {
        const subWorkflowId = toolInput?.workflowId
        const subInput = toolInput?.input
        if (typeof subWorkflowId !== 'string') {
          return {
            success: false,
            message: { type: 'error-text', value: 'runWorkflow.workflowId must be a string.' },
          }
        }
        try {
          const output = await runWorkflow(subWorkflowId, subInput)
          const jsonResult: ToolResponseResult = { type: 'json', value: output as any }
          return { success: true, message: jsonResult }
        } catch (error) {
          return {
            success: false,
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
  runInternal: (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ) => Promise<any>,
): Promise<any> {
  const executeStepLogic = async (): Promise<any> => {
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
  runInternal: (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ) => Promise<any>,
): Promise<any> {
  const result = await executeStepWithTimeout(stepDef, workflowId, input, state, context, options, runInternal)

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

/**
 * Check if a step is a break statement
 */
function isBreakStep(step: WorkflowControlFlowStep): boolean {
  return typeof step === 'object' && step !== null && 'break' in step && (step as any).break === true
}

/**
 * Check if a step is a continue statement
 */
function isContinueStep(step: WorkflowControlFlowStep): boolean {
  return typeof step === 'object' && step !== null && 'continue' in step && (step as any).continue === true
}

/**
 * Check if a step is a while loop
 */
function isWhileLoopStep(step: WorkflowControlFlowStep): boolean {
  return typeof step === 'object' && step !== null && 'while' in step
}

/**
 * Check if a step is an if/else branch
 */
function isIfElseStep(step: WorkflowControlFlowStep): boolean {
  return typeof step === 'object' && step !== null && 'if' in step
}

/**
 * Check if a step is a try/catch block
 */
function isTryCatchStep(step: WorkflowControlFlowStep): boolean {
  return typeof step === 'object' && step !== null && 'try' in step
}

/**
 * Store step output in state if output key is specified
 */
function storeStepOutput(step: WorkflowControlFlowStep, result: any, state: Record<string, any>): void {
  if ('id' in step && step.output) {
    const outputKey = step.output
    state[outputKey] = result
  }
}

/**
 * Get step ID for logging purposes
 */
function getStepId(step: WorkflowControlFlowStep): string {
  if ('id' in step && step.id) {
    return step.id
  }
  if (isWhileLoopStep(step)) {
    return 'while'
  }
  if (isIfElseStep(step)) {
    return 'if'
  }
  if (isTryCatchStep(step)) {
    return 'try'
  }
  return 'control'
}

/**
 * Execute a single control flow step (basic step, while loop, if/else, break, continue)
 */
async function executeControlFlowStep<TTools extends ToolRegistry>(
  step: WorkflowControlFlowStep,
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
  loopDepth: number,
  breakFlag: { value: boolean },
  continueFlag: { value: boolean },
): Promise<{ result: any; shouldBreak: boolean; shouldContinue: boolean }> {
  // Handle break statement
  if (isBreakStep(step)) {
    if (loopDepth === 0) {
      throw new Error(`'break' statement found outside of a loop in workflow '${workflowId}'`)
    }
    context.logger.debug(`[ControlFlow] Executing break statement (loop depth: ${loopDepth})`)
    return { result: undefined, shouldBreak: true, shouldContinue: false }
  }

  // Handle continue statement
  if (isContinueStep(step)) {
    if (loopDepth === 0) {
      throw new Error(`'continue' statement found outside of a loop in workflow '${workflowId}'`)
    }
    context.logger.debug(`[ControlFlow] Executing continue statement (loop depth: ${loopDepth})`)
    return { result: undefined, shouldBreak: false, shouldContinue: true }
  }

  // Handle while loop
  if (isWhileLoopStep(step)) {
    const whileStep = step as any
    context.logger.info(`[ControlFlow] Executing while loop '${whileStep.id}'`)
    context.logger.debug(`[ControlFlow] Condition: ${whileStep.while.condition}`)
    context.logger.debug(`[ControlFlow] Loop body has ${whileStep.while.steps.length} step(s)`)

    let iterationCount = 0
    const maxIterations = 1000 // Safety limit to prevent infinite loops
    let loopResult: any

    while (true) {
      iterationCount++
      if (iterationCount > maxIterations) {
        throw new Error(`While loop '${whileStep.id}' in workflow '${workflowId}' exceeded maximum iteration limit of ${maxIterations}`)
      }

      // Evaluate condition
      const conditionResult = evaluateCondition(whileStep.while.condition, input, state)
      context.logger.debug(`[ControlFlow] While loop '${whileStep.id}' iteration ${iterationCount}: condition = ${conditionResult}`)

      if (!conditionResult) {
        context.logger.info(`[ControlFlow] While loop '${whileStep.id}' terminated after ${iterationCount - 1} iteration(s)`)
        break
      }

      // Execute loop body steps
      for (const bodyStep of whileStep.while.steps) {
        const { result, shouldBreak, shouldContinue } = await executeControlFlowStep(
          bodyStep,
          workflowId,
          input,
          state,
          context,
          options,
          runInternal,
          loopDepth + 1,
          breakFlag,
          continueFlag,
        )

        if (shouldBreak) {
          context.logger.debug(`[ControlFlow] Breaking from while loop '${whileStep.id}'`)
          breakFlag.value = false
          return { result: loopResult, shouldBreak: false, shouldContinue: false }
        }

        if (shouldContinue) {
          context.logger.debug(`[ControlFlow] Continuing to next iteration of while loop '${whileStep.id}'`)
          continueFlag.value = false
          break
        }

        // Store output if specified
        storeStepOutput(bodyStep, result, state)

        // Last result becomes loop result
        loopResult = result
      }
    }

    // Store loop output if specified
    const outputKey = whileStep.output ?? whileStep.id
    state[outputKey] = loopResult
    context.logger.debug(`[ControlFlow] While loop '${whileStep.id}' stored output as '${outputKey}'`)

    return { result: loopResult, shouldBreak: false, shouldContinue: false }
  }

  // Handle if/else branch
  if (isIfElseStep(step)) {
    const ifElseStep = step as any
    context.logger.info(`[ControlFlow] Executing if/else branch '${ifElseStep.id}'`)
    context.logger.debug(`[ControlFlow] Condition: ${ifElseStep.if.condition}`)
    context.logger.debug(`[ControlFlow] Then branch has ${ifElseStep.if.thenBranch.length} step(s)`)
    if (ifElseStep.if.elseBranch) {
      context.logger.debug(`[ControlFlow] Else branch has ${ifElseStep.if.elseBranch.length} step(s)`)
    }

    const conditionResult = evaluateCondition(ifElseStep.if.condition, input, state)
    context.logger.debug(`[ControlFlow] If/else '${ifElseStep.id}' condition = ${conditionResult}`)

    const branchSteps = conditionResult ? ifElseStep.if.thenBranch : (ifElseStep.if.elseBranch ?? [])
    const branchName = conditionResult ? 'then' : ifElseStep.if.elseBranch ? 'else' : 'else (empty)'

    context.logger.info(`[ControlFlow] Taking '${branchName}' branch of '${ifElseStep.id}'`)

    let branchResult: any

    for (const branchStep of branchSteps) {
      const { result, shouldBreak, shouldContinue } = await executeControlFlowStep(
        branchStep,
        workflowId,
        input,
        state,
        context,
        options,
        runInternal,
        loopDepth,
        breakFlag,
        continueFlag,
      )

      // Propagate break/continue from within branches
      if (shouldBreak || shouldContinue) {
        return { result, shouldBreak, shouldContinue }
      }

      // Store output if specified
      storeStepOutput(branchStep, result, state)

      // Last result becomes branch result
      branchResult = result
    }

    // Store branch output if specified
    const outputKey = ifElseStep.output ?? ifElseStep.id
    state[outputKey] = branchResult
    context.logger.debug(`[ControlFlow] If/else '${ifElseStep.id}' stored output as '${outputKey}'`)

    return { result: branchResult, shouldBreak: false, shouldContinue: false }
  }

  // Handle try/catch block
  if (isTryCatchStep(step)) {
    const tryCatchStep = step as any
    context.logger.info(`[ControlFlow] Executing try/catch block '${tryCatchStep.id}'`)
    context.logger.debug(`[ControlFlow] Try block has ${tryCatchStep.try.trySteps.length} step(s)`)
    context.logger.debug(`[ControlFlow] Catch block has ${tryCatchStep.try.catchSteps.length} step(s)`)

    let tryResult: any
    let caughtError: Error | undefined

    try {
      // Execute try steps
      for (const tryStep of tryCatchStep.try.trySteps) {
        const { result } = await executeControlFlowStep(
          tryStep,
          workflowId,
          input,
          state,
          context,
          options,
          runInternal,
          loopDepth,
          breakFlag,
          continueFlag,
        )

        // Store output if specified
        storeStepOutput(tryStep, result, state)

        // Last result becomes try result
        tryResult = result
      }

      // Store try/catch output if specified
      const outputKey = tryCatchStep.output ?? tryCatchStep.id
      state[outputKey] = tryResult
      context.logger.debug(`[ControlFlow] Try/catch '${tryCatchStep.id}' completed successfully`)

      return { result: tryResult, shouldBreak: false, shouldContinue: false }
    } catch (error) {
      caughtError = error instanceof Error ? error : new Error(String(error))
      context.logger.warn(`[ControlFlow] Try/catch '${tryCatchStep.id}' caught error: ${caughtError.message}`)

      // Execute catch steps
      let catchResult: any
      for (const catchStep of tryCatchStep.try.catchSteps) {
        const { result } = await executeControlFlowStep(
          catchStep,
          workflowId,
          input,
          state,
          context,
          options,
          runInternal,
          loopDepth,
          breakFlag,
          continueFlag,
        )

        // Store output if specified
        storeStepOutput(catchStep, result, state)

        // Last result becomes catch result
        catchResult = result
      }

      // Store try/catch output if specified
      const outputKey = tryCatchStep.output ?? tryCatchStep.id
      state[outputKey] = catchResult
      context.logger.debug(`[ControlFlow] Try/catch '${tryCatchStep.id}' stored catch result as '${outputKey}'`)

      return { result: catchResult, shouldBreak: false, shouldContinue: false }
    }
  }

  // Handle basic step (must be WorkflowStepDefinition at this point)
  const stepDef = step as WorkflowStepDefinition
  const stepResult = await executeStep(stepDef, workflowId, input, state, context, options, runInternal)

  return { result: stepResult, shouldBreak: false, shouldContinue: false }
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

  const runInternal = async (
    workflowId: string,
    input: Record<string, any>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, any>,
  ): Promise<any> => {
    const workflow = definition.workflows[workflowId]
    if (!workflow) {
      const builtIn = options.builtInWorkflows?.[workflowId]
      if (builtIn) {
        context.logger.info(`[Workflow] Delegating to built-in workflow '${workflowId}'`)
        return await builtIn(input, context as any)
      }
      throw new Error(`Workflow '${workflowId}' not found`)
    }

    // Validate inputs and apply defaults
    const validatedInput = validateAndApplyDefaults(workflowId, workflow, input)

    context.logger.info(`[Workflow] Starting workflow '${workflowId}'`)
    context.logger.debug(`[Workflow] Input: ${JSON.stringify(validatedInput)}`)
    context.logger.debug(`[Workflow] Inherited state: ${JSON.stringify(inheritedState)}`)
    context.logger.debug(`[Workflow] Steps: ${workflow.steps.map((s) => ('id' in s ? s.id : '<control flow>')).join(', ')}`)

    const state: Record<string, any> = { ...inheritedState }
    let lastOutput: any

    const breakFlag = { value: false }
    const continueFlag = { value: false }

    for (let i = 0; i < workflow.steps.length; i++) {
      const stepDef = workflow.steps[i]
      const stepId = getStepId(stepDef)

      context.logger.info(`[Workflow] Step ${i + 1}/${workflow.steps.length}: ${stepId}`)

      // Execute control flow step
      const { result } = await executeControlFlowStep(
        stepDef,
        workflowId,
        validatedInput,
        state,
        context,
        options,
        runInternal,
        0, // loop depth
        breakFlag,
        continueFlag,
      )

      lastOutput = result

      // Store output if specified
      storeStepOutput(stepDef, result, state)

      if ('id' in stepDef && stepDef.output) {
        context.logger.debug(
          `[Workflow] Step output stored as '${stepDef.output}': ${typeof lastOutput === 'object' ? JSON.stringify(lastOutput).substring(0, 200) : lastOutput}`,
        )
      }
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
