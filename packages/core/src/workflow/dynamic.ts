import { parse } from 'yaml'
import { z } from 'zod'
import { parseJsonFromMarkdown } from '../Agent/parseJsonFromMarkdown'
import type { FullToolInfo, ToolResponseResult } from '../tool'
import { ToolResponseType } from '../tool'
import { type AgentToolRegistry, agentWorkflow } from './agent.workflow'
import { type WorkflowFile, WorkflowFileSchema, type WorkflowStepDefinition } from './dynamic-types'
import type { Logger, StepFn, ToolRegistry, WorkflowContext, WorkflowTools } from './workflow'

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
  toolInfo: Readonly<FullToolInfo[]> | undefined
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
   * Opt-in to execute persisted step `code` strings.
   * When false, steps without code must be agent-executed.
   */
  allowUnsafeCodeExecution?: boolean
  /**
   * Customize per-step system prompt for agent-executed steps.
   */
  stepSystemPrompt?: (args: { workflowId: string; step: WorkflowStepDefinition; input: any; state: any }) => string
}

type CompiledStepFn<TTools extends ToolRegistry> = (ctx: DynamicStepRuntimeContext<TTools>) => Promise<any>

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (arg1: string, arg2: string) => (ctx: any) => Promise<any>

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
    throw new Error(
      `Failed to compile code for step '${stepDef.id}' in workflow '${workflowId}': ${error instanceof Error ? error.message : String(error)}`,
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

  const allowedToolNames = stepDef.tools
  const toolsForAgent: FullToolInfo[] = allowedToolNames
    ? options.toolInfo.filter((t) => allowedToolNames.includes(t.name))
    : [...options.toolInfo]

  if (!allowedToolNames || allowedToolNames.includes('runWorkflow')) {
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
    if (result.object !== undefined) {
      return result.object
    }

    const parsed = parseJsonFromMarkdown(result.message)
    if (parsed.success) {
      return parsed.data
    }
    return result.message
  }

  throw new Error(`Agent execution for step '${stepDef.id}' in workflow '${workflowId}' did not exit cleanly.`)
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
  if (stepDef.code && options.allowUnsafeCodeExecution) {
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

    return await fn(runtimeCtx)
  }

  return await executeStepWithAgent(stepDef, workflowId, input, state, context, options, runInternal)
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

    const state: Record<string, any> = { ...inheritedState }
    let lastOutput: any

    for (const stepDef of workflow.steps) {
      const stepName = `${workflowId}.${stepDef.id}`
      lastOutput = await context.step(stepName, async () => {
        return await executeStep(stepDef, workflowId, input, state, context, options, compiledSteps, runInternal)
      })

      const outputKey = stepDef.output ?? stepDef.id
      state[outputKey] = lastOutput
    }

    if (workflow.output) {
      return state[workflow.output]
    }
    return state
  }

  return async (workflowId: string, input: Record<string, any>, context: WorkflowContext<TTools>) => {
    return await runInternal(workflowId, input, context, {})
  }
}
