import { parse } from 'yaml'
import { z } from 'zod'
import { parseJsonFromMarkdown } from '../Agent/parseJsonFromMarkdown'
import type { FullToolInfo, ToolResponseResult } from '../tool'
import { type AgentToolRegistry, agentWorkflow } from './agent.workflow'
import {
  type BreakStep,
  type ContinueStep,
  type IfElseStep,
  type TryCatchStep,
  type ValidationResult,
  type WhileLoopStep,
  type WorkflowControlFlowStep,
  type WorkflowDefinition,
  type WorkflowFile,
  WorkflowFileSchema,
  type WorkflowStepDefinition,
} from './dynamic-types'
import type { Logger, StepFn, ToolRegistry, WorkflowContext, WorkflowFn, WorkflowTools } from './workflow'

/**
 * Maximum iterations for while loops to prevent infinite loops
 */
const MAX_WHILE_LOOP_ITERATIONS = 1000

/**
 * JSON Schema type to Zod type mapping
 */
type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'object' | 'array' | 'null'

/**
 * JSON Schema enum values - can be string, number, or boolean
 */
type JsonSchemaEnum = (string | number | boolean)[]

interface JsonSchema {
  type?: JsonSchemaType | JsonSchemaType[]
  enum?: JsonSchemaEnum
  properties?: Record<string, JsonSchema>
  required?: string[]
  items?: JsonSchema
  additionalProperties?: boolean | JsonSchema
  description?: string
  [key: string]: unknown // Allow additional JSON Schema fields
}

/**
 * Convert a JSON Schema to a Zod schema
 * Supports a subset of JSON SchemaDraft 7
 *
 * This is exported to allow reuse in other parts of the codebase that need to
 * convert JSON schemas to Zod schemas (e.g., MCP server tool schema conversion).
 */
export function convertJsonSchemaToZod(schema: JsonSchema): z.ZodTypeAny {
  // Handle enum types
  if (schema.enum) {
    // JSON Schema enums can contain strings, numbers, or booleans
    // For non-string or mixed enums, use z.union with z.literal
    // For string-only enums, use z.enum for better performance
    const enumValues = schema.enum

    // Handle empty enum - no valid values
    if (enumValues.length === 0) {
      return z.never()
    }

    // Check if all values are strings
    if (enumValues.every((v) => typeof v === 'string')) {
      return z.enum(enumValues as [string, ...string[]])
    }

    // Mixed or non-string enums: use z.union with z.literal
    const literals = enumValues.map((v) => z.literal(v as any))
    if (literals.length === 1) {
      return literals[0]
    }
    // z.union can take an array of schemas
    // Cast to any because Zod's union type inference is complex
    return z.union([literals[0], literals[1], ...literals.slice(2)]) as any
  }

  // Handle union types (type: ["string", "null"])
  if (Array.isArray(schema.type)) {
    const types = schema.type
    if (types.includes('null') && types.length === 2) {
      const nonNullType = types.find((t) => t !== 'null')
      if (nonNullType === 'string') return z.string().nullable()
      if (nonNullType === 'number') return z.number().nullable()
      if (nonNullType === 'integer')
        return z
          .number()
          .refine((val) => Number.isInteger(val))
          .nullable()
      if (nonNullType === 'boolean') return z.boolean().nullable()
      if (nonNullType === 'object') {
        // Handle object with nullable - need to preserve properties
        const shape: Record<string, z.ZodTypeAny> = {}
        if (schema.properties) {
          for (const [propName, propSchema] of Object.entries(schema.properties)) {
            const propZod = convertJsonSchemaToZod(propSchema as JsonSchema)
            const isRequired = schema.required?.includes(propName)
            shape[propName] = isRequired ? propZod : propZod.optional()
          }
        }
        return z.object(shape).nullable()
      }
      if (nonNullType === 'array') return z.array(z.any()).nullable()
    }
    // Fallback for complex unions
    return z.any()
  }

  const type = schema.type as JsonSchemaType

  switch (type) {
    case 'string':
      return z.string()
    case 'number':
      return z.number()
    case 'integer':
      // Zod v4 doesn't have .int(), use custom validation
      return z.number().refine((val) => Number.isInteger(val), { message: 'Expected an integer' })
    case 'boolean':
      return z.boolean()
    case 'null':
      return z.null()
    case 'object': {
      const shape: Record<string, z.ZodTypeAny> = {}

      // Convert properties
      if (schema.properties) {
        for (const [propName, propSchema] of Object.entries(schema.properties)) {
          const propZod = convertJsonSchemaToZod(propSchema as JsonSchema)
          // Check if property is required
          const isRequired = schema.required?.includes(propName)
          shape[propName] = isRequired ? propZod : propZod.optional()
        }
      }

      // Handle additionalProperties
      if (schema.additionalProperties === true) {
        // Use passthrough to allow additional properties without validation
        return z.object(shape).passthrough()
      }

      if (typeof schema.additionalProperties === 'object') {
        const additionalSchema = convertJsonSchemaToZod(schema.additionalProperties as JsonSchema)
        // Use explicit intersection for additional properties
        // Note: We use z.intersection() instead of .and() for better readability
        // The cast to z.ZodTypeAny is necessary because Zod's intersection types
        // have complex type inference that TypeScript cannot always resolve correctly.
        // This is a known limitation of Zod's type system.
        return z.intersection(z.object(shape), z.record(z.string(), additionalSchema)) as z.ZodTypeAny
      }

      // No additionalProperties (defaults to false) - strict object
      return z.object(shape)
    }
    case 'array': {
      if (!schema.items) {
        return z.array(z.any())
      }
      const itemSchema = convertJsonSchemaToZod(schema.items as JsonSchema)
      return z.array(itemSchema)
    }
    default:
      return z.any()
  }
}

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

/**
 * Type for the runWorkflow tool that allows workflows to call other workflows
 */
export type RunWorkflowTool = {
  input: { workflowId: string; input?: Record<string, unknown> }
  output: unknown
}

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

    // Check for break/continue outside loops
    const checkBreakOutsideLoop = (steps: WorkflowControlFlowStep[], inLoop: boolean, path: string): void => {
      for (const step of steps) {
        if (isBreakStep(step) || isContinueStep(step)) {
          if (!inLoop) {
            errors.push(`${path} has break/continue outside of a loop`)
          }
        }
        if (isWhileLoopStep(step)) {
          checkBreakOutsideLoop(step.while.steps, true, `${path}/${step.id}`)
        }
        if (isIfElseStep(step)) {
          if (step.if.thenBranch) {
            checkBreakOutsideLoop(step.if.thenBranch, inLoop, `${path}/${step.id}/then`)
          }
          if (step.if.elseBranch) {
            checkBreakOutsideLoop(step.if.elseBranch, inLoop, `${path}/${step.id}/else`)
          }
        }
        if (isTryCatchStep(step)) {
          checkBreakOutsideLoop(step.try.trySteps, inLoop, `${path}/${step.id}/try`)
          checkBreakOutsideLoop(step.try.catchSteps, inLoop, `${path}/${step.id}/catch`)
        }
      }
    }

    checkBreakOutsideLoop(workflow.steps, false, workflowId)

    // Check for runWorkflow calls to non-existent workflows
    const findRunWorkflowCalls = (steps: WorkflowControlFlowStep[], path: string): void => {
      for (const step of steps) {
        if (isWhileLoopStep(step)) {
          findRunWorkflowCalls(step.while.steps, `${path}/${step.id}`)
        }
        if (isIfElseStep(step)) {
          if (step.if.thenBranch) {
            findRunWorkflowCalls(step.if.thenBranch, `${path}/${step.id}/then`)
          }
          if (step.if.elseBranch) {
            findRunWorkflowCalls(step.if.elseBranch, `${path}/${step.id}/else`)
          }
        }
        if (isTryCatchStep(step)) {
          findRunWorkflowCalls(step.try.trySteps, `${path}/${step.id}/try`)
          findRunWorkflowCalls(step.try.catchSteps, `${path}/${step.id}/catch`)
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
  input: Record<string, unknown>
  state: Record<string, unknown>
  tools: WorkflowTools<TTools>
  logger: Logger
  step: StepFn
  runWorkflow: (workflowId: string, input?: Record<string, unknown>) => Promise<unknown>
  toolInfo: Readonly<FullToolInfo[]> | undefined
  agentTools: Record<string, (input: unknown) => Promise<unknown>>
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
  stepSystemPrompt?: (args: {
    workflowId: string
    step: WorkflowStepDefinition
    input: Record<string, unknown>
    state: Record<string, unknown>
  }) => string
  /**
   * Whether to wrap plain text agent responses in an object { result: ... }.
   * Defaults to false.
   */
  wrapAgentResultInObject?: boolean
  /**
   * Built-in workflows that can be called by name if not found in the definition.
   */
  builtInWorkflows?: Record<string, WorkflowFn<any, any, any>>
  /**
   * Allow unsafe code execution in condition expressions.
   * When false (default), only simple comparisons and property access are allowed.
   * When true, arbitrary JavaScript code can be executed in conditions.
   * WARNING: Setting to true with untrusted workflow definitions is a security risk.
   * @default false
   */
  allowUnsafeCodeExecution?: boolean
}

function validateAndApplyDefaults(
  workflowId: string,
  workflow: WorkflowDefinition,
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (!workflow.inputs || workflow.inputs.length === 0) {
    return input
  }

  const validatedInput: Record<string, unknown> = { ...input }
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
 *
 * Security: When allowUnsafeCodeExecution is false (default), only supports:
 * - Property access: input.foo, state.bar
 * - Comparisons: ==, !=, ===, !==, <, >, <=, >=
 * - Logical operators: &&, ||, !
 * - Parentheses for grouping
 * - Literals: strings, numbers, booleans, null
 *
 * When allowUnsafeCodeExecution is true, arbitrary JavaScript is executed.
 * WARNING: Only set to true for trusted workflow definitions!
 */
function evaluateCondition(
  condition: string,
  input: Record<string, unknown>,
  state: Record<string, unknown>,
  // SECURITY: Default must remain false for safe evaluation of untrusted workflows
  // Only set to true for trusted, vetted workflow definitions
  allowUnsafeCodeExecution = false,
  logger?: { warn: (message: string) => void },
): boolean {
  if (allowUnsafeCodeExecution) {
    // SECURITY WARNING: Unsafe code execution allows arbitrary JavaScript execution
    // This should only be used for trusted, vetted workflow definitions
    if (logger) {
      logger.warn(
        `[SECURITY] Executing unsafe code evaluation for condition: ${condition}. This allows arbitrary JavaScript execution and should only be used for trusted workflows.`,
      )
    }

    // Unsafe mode: use new Function for full JavaScript support
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
  } else {
    // Safe mode: use a simple, restricted evaluator
    return evaluateConditionSafe(condition, input, state)
  }
}

/**
 * Safe condition evaluator that supports a restricted subset of JavaScript
 * Prevents code injection by not using eval or new Function
 *
 * Operator precedence (from lowest to highest):
 * 1. || (logical OR)
 * 2. && (logical AND)
 * 3. ===, !==, ==, !=, >=, <=, >, < (comparisons)
 * 4. ! (negation)
 * 5. (...) (parentheses - highest precedence, evaluated first)
 */
function evaluateConditionSafe(condition: string, input: Record<string, unknown>, state: Record<string, unknown>): boolean {
  // Trim whitespace
  condition = condition.trim()

  // Handle simple boolean literals
  if (condition === 'true') return true
  if (condition === 'false') return false

  // Handle logical OR (lowest precedence)
  const orIndex = findTopLevelOperator(condition, '||')
  if (orIndex !== -1) {
    const left = condition.slice(0, orIndex).trim()
    const right = condition.slice(orIndex + 2).trim()
    return evaluateConditionSafe(left, input, state) || evaluateConditionSafe(right, input, state)
  }

  // Handle logical AND
  const andIndex = findTopLevelOperator(condition, '&&')
  if (andIndex !== -1) {
    const left = condition.slice(0, andIndex).trim()
    const right = condition.slice(andIndex + 2).trim()
    return evaluateConditionSafe(left, input, state) && evaluateConditionSafe(right, input, state)
  }

  // Handle comparisons
  const comparisonOps = ['===', '!==', '==', '!=', '>=', '<=', '>', '<']
  for (const op of comparisonOps) {
    const opIndex = findTopLevelOperator(condition, op)
    if (opIndex !== -1) {
      const left = evaluateValue(condition.slice(0, opIndex).trim(), input, state)
      const right = evaluateValue(condition.slice(opIndex + op.length).trim(), input, state)
      return compareValues(left, right, op)
    }
  }

  // Handle negation (higher precedence than comparisons)
  if (condition.startsWith('!')) {
    return !evaluateConditionSafe(condition.slice(1).trim(), input, state)
  }

  // Handle parentheses (highest precedence)
  if (hasEnclosingParens(condition)) {
    const inner = condition.slice(1, -1)
    return evaluateConditionSafe(inner, input, state)
  }

  // If we get here, it's a simple value
  const value = evaluateValue(condition, input, state)
  return Boolean(value)
}

/**
 * Find index of operator at top level (not inside parentheses or string literals)
 */
function findTopLevelOperator(expr: string, op: string): number {
  let parenDepth = 0
  let inString = false
  let stringChar = ''
  let escapeNext = false

  for (let i = 0; i <= expr.length - op.length; i++) {
    const char = expr[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (!inString && (char === '"' || char === "'")) {
      inString = true
      stringChar = char
      continue
    }

    if (inString && char === stringChar) {
      inString = false
      stringChar = ''
      continue
    }

    if (inString) continue

    if (char === '(') parenDepth++
    if (char === ')') parenDepth--

    if (parenDepth === 0 && expr.slice(i, i + op.length) === op) {
      return i
    }
  }
  return -1
}

/**
 * Check if expression is wrapped in enclosing parentheses
 * (e.g., "(A && B)" returns true, "(A) && (B)" returns false)
 */
function hasEnclosingParens(expr: string): boolean {
  expr = expr.trim()

  if (!expr.startsWith('(') || !expr.endsWith(')')) {
    return false
  }

  // Check if the opening and closing parentheses enclose the entire expression
  let depth = 0
  let inString = false
  let stringChar = ''
  let escapeNext = false

  for (let i = 0; i < expr.length; i++) {
    const char = expr[i]

    if (escapeNext) {
      escapeNext = false
      continue
    }

    if (char === '\\') {
      escapeNext = true
      continue
    }

    if (!inString && (char === '"' || char === "'")) {
      inString = true
      stringChar = char
      continue
    }

    if (inString && char === stringChar) {
      inString = false
      stringChar = ''
      continue
    }

    if (inString) continue

    if (char === '(') {
      depth++
      // First paren is at index 0
      if (i === 0) depth = 1
    }
    if (char === ')') {
      depth--
      // Last paren should be at the last index
      if (depth === 0 && i === expr.length - 1) {
        return true
      }
      if (depth === 0 && i < expr.length - 1) {
        // Found closing paren before end of expression
        return false
      }
    }
  }

  return false
}

/**
 * Evaluate a simple value (property access or literal)
 */
function evaluateValue(expr: string, input: Record<string, unknown>, state: Record<string, unknown>): unknown {
  expr = expr.trim()

  // String literals (with proper handling of escaped quotes)
  // Use stricter check - ensure entire expression is a quoted string
  const stringMatch = expr.match(/^(["'])(?:(?=(\\?))\2.)*?\1$/)
  if (stringMatch) {
    const quote = stringMatch[1]
    if (quote === '"') {
      // Use JSON.parse for double-quoted strings (handles all JSON escape sequences correctly)
      try {
        return JSON.parse(expr)
      } catch (error) {
        throw new Error(`Invalid string literal: "${expr}". Error: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      // Single-quoted strings: convert to double-quoted and use JSON.parse
      // Need to handle both \' and \" escape sequences
      let inner = expr.slice(1, -1)
      // Replace \' with ' (unescape single quotes)
      inner = inner.replace(/\\'/g, "'")
      // Replace \" with " (unescape double quotes)
      inner = inner.replace(/\\"/g, '"')
      // Now escape any double quotes and backslashes for JSON
      const converted = `"${inner.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      try {
        return JSON.parse(converted)
      } catch (error) {
        throw new Error(`Invalid string literal: "${expr}". Error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // Number literals (more permissive regex)
  if (/^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(expr)) {
    return Number.parseFloat(expr)
  }

  // Boolean literals
  if (expr === 'true') return true
  if (expr === 'false') return false
  if (expr === 'null') return null

  // Property access: input.foo or state.bar.baz
  if (expr.startsWith('input.')) {
    return getNestedProperty(input, expr.slice(6))
  }
  if (expr.startsWith('state.')) {
    return getNestedProperty(state, expr.slice(6))
  }

  // If we get here, the expression is not recognized
  throw new Error(
    `Unrecognized expression in condition: "${expr}". Valid expressions are: string literals, numbers, boolean literals, null, or property access like "input.foo" or "state.bar"`,
  )
}

/**
 * Get nested property from object
 */
function getNestedProperty(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.')
  let current: unknown = obj
  for (const part of parts) {
    if (current == null) return undefined
    if (typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

/**
 * Compare two values using the specified operator
 * For comparison operators, we assume the values are comparable (strings, numbers, etc.)
 *
 * NOTE: Using 'as any' for comparisons because values are typed as 'unknown'
 * This is an unsafe operation that relies on runtime behavior (string/number comparisons work)
 * but violates type safety. Using 'as any' explicitly acknowledges this limitation.
 */
function compareValues(left: unknown, right: unknown, op: string): boolean {
  switch (op) {
    case '===':
      return left === right
    case '!==':
      return left !== right
    case '==':
      return Object.is(left, right)
    case '!=':
      return !Object.is(left, right)
    case '>=':
      return (left as any) >= (right as any)
    case '<=':
      return (left as any) <= (right as any)
    case '>':
      return (left as any) > (right as any)
    case '<':
      return (left as any) < (right as any)
    default:
      throw new Error(`Unknown comparison operator: ${op}`)
  }
}

function createRunWorkflowFn<TTools extends ToolRegistry>(args: {
  input: Record<string, unknown>
  state: Record<string, unknown>
  context: WorkflowContext<TTools>
  runInternal: (
    workflowId: string,
    input: Record<string, unknown>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, unknown>,
  ) => Promise<unknown>
}) {
  return async (subWorkflowId: string, subInput?: Record<string, unknown>) => {
    const mergedInput = { ...args.input, ...args.state, ...(subInput ?? {}) }
    return await args.runInternal(subWorkflowId, mergedInput, args.context, args.state)
  }
}

async function executeStepWithAgent<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  workflowId: string,
  input: Record<string, unknown>,
  state: Record<string, unknown>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  runInternal: (
    workflowId: string,
    input: Record<string, unknown>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<unknown> {
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
    invokeTool: async ({ toolName, input: toolInput }: { toolName: string; input: unknown }) => {
      if (!allowedToolNameSet.has(toolName)) {
        return {
          success: false,
          message: { type: 'error-text', value: `Tool '${toolName}' is not allowed in this step.` },
        }
      }

      if (toolName === 'runWorkflow') {
        // Type guard for runWorkflow input
        const runWorkflowInput = toolInput as Record<string, unknown> | undefined
        const subWorkflowId = runWorkflowInput?.workflowId
        const subInput = runWorkflowInput?.input as Record<string, unknown> | undefined
        if (typeof subWorkflowId !== 'string') {
          return {
            success: false,
            message: { type: 'error-text', value: 'runWorkflow.workflowId must be a string.' },
          }
        }
        try {
          const output = await runWorkflow(subWorkflowId, subInput)
          const jsonResult: ToolResponseResult = { type: 'json', value: output as never }
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

  // Exhaustive check: TypeScript should ensure all result types are handled above
  const _exhaustiveCheck: never = result
  throw new Error(`Agent step '${stepDef.id}' in workflow '${workflowId}' exited unexpectedly with unhandled type`)
}

async function executeStepWithTimeout<TTools extends ToolRegistry>(
  stepDef: WorkflowStepDefinition,
  workflowId: string,
  input: Record<string, unknown>,
  state: Record<string, unknown>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  runInternal: (
    workflowId: string,
    input: Record<string, unknown>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<unknown> {
  const executeStepLogic = async (): Promise<unknown> => {
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
  input: Record<string, unknown>,
  state: Record<string, unknown>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  runInternal: (
    workflowId: string,
    input: Record<string, unknown>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, unknown>,
  ) => Promise<unknown>,
): Promise<unknown> {
  const result = await executeStepWithTimeout(stepDef, workflowId, input, state, context, options, runInternal)

  // Validate output against schema if provided
  if (stepDef.outputSchema) {
    try {
      context.logger.debug(`[Step] Validating output for step '${stepDef.id}' against schema`)

      // Convert JSON Schema to Zod schema
      const zodSchema = convertJsonSchemaToZod(stepDef.outputSchema)

      // Validate the result
      const validationResult = zodSchema.safeParse(result)

      if (!validationResult.success) {
        const errorDetails = validationResult.error.issues.map((e) => `  - ${e.path.join('.') || 'root'}: ${e.message}`).join('\n')
        throw new Error(`Output does not match expected schema:\n${errorDetails}`)
      }

      context.logger.debug(`[Step] Output validation successful for step '${stepDef.id}'`)
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
function isBreakStep(step: WorkflowControlFlowStep): step is BreakStep {
  return typeof step === 'object' && step !== null && 'break' in step && step.break === true
}

/**
 * Check if a step is a continue statement
 */
function isContinueStep(step: WorkflowControlFlowStep): step is ContinueStep {
  return typeof step === 'object' && step !== null && 'continue' in step && step.continue === true
}

/**
 * Check if a step is a while loop
 */
function isWhileLoopStep(step: WorkflowControlFlowStep): step is WhileLoopStep {
  return typeof step === 'object' && step !== null && 'while' in step
}

/**
 * Check if a step is an if/else branch
 */
function isIfElseStep(step: WorkflowControlFlowStep): step is IfElseStep {
  return typeof step === 'object' && step !== null && 'if' in step
}

/**
 * Check if a step is a try/catch block
 */
function isTryCatchStep(step: WorkflowControlFlowStep): step is TryCatchStep {
  return typeof step === 'object' && step !== null && 'try' in step
}

/**
 * Store step output in state if output key is specified
 */
function storeStepOutput(step: WorkflowControlFlowStep, result: unknown, state: Record<string, unknown>): void {
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
  input: Record<string, unknown>,
  state: Record<string, unknown>,
  context: WorkflowContext<TTools>,
  options: DynamicWorkflowRunnerOptions,
  runInternal: (
    workflowId: string,
    input: Record<string, unknown>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, unknown>,
  ) => Promise<unknown>,
  loopDepth: number,
  breakFlag: { value: boolean },
  continueFlag: { value: boolean },
): Promise<{ result: unknown; shouldBreak: boolean; shouldContinue: boolean }> {
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
    context.logger.info(`[ControlFlow] Executing while loop '${step.id}'`)
    context.logger.debug(`[ControlFlow] Condition: ${step.while.condition}`)
    context.logger.debug(`[ControlFlow] Loop body has ${step.while.steps.length} step(s)`)

    let iterationCount = 0
    let loopResult: unknown

    while (true) {
      iterationCount++
      if (iterationCount > MAX_WHILE_LOOP_ITERATIONS) {
        throw new Error(
          `While loop '${step.id}' in workflow '${workflowId}' exceeded maximum iteration limit of ${MAX_WHILE_LOOP_ITERATIONS}`,
        )
      }

      // Evaluate condition
      const conditionResult = evaluateCondition(step.while.condition, input, state, options.allowUnsafeCodeExecution)
      context.logger.debug(`[ControlFlow] While loop '${step.id}' iteration ${iterationCount}: condition = ${conditionResult}`)

      if (!conditionResult) {
        context.logger.info(`[ControlFlow] While loop '${step.id}' terminated after ${iterationCount - 1} iteration(s)`)
        break
      }

      // Execute loop body steps
      for (const bodyStep of step.while.steps) {
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
          context.logger.debug(`[ControlFlow] Breaking from while loop '${step.id}'`)
          breakFlag.value = false
          return { result: loopResult, shouldBreak: false, shouldContinue: false }
        }

        if (shouldContinue) {
          context.logger.debug(`[ControlFlow] Continuing to next iteration of while loop '${step.id}'`)
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
    const outputKey = step.output ?? step.id
    state[outputKey] = loopResult
    context.logger.debug(`[ControlFlow] While loop '${step.id}' stored output as '${outputKey}'`)

    return { result: loopResult, shouldBreak: false, shouldContinue: false }
  }

  // Handle if/else branch
  if (isIfElseStep(step)) {
    const ifStep = step as IfElseStep
    context.logger.info(`[ControlFlow] Executing if/else branch '${ifStep.id}'`)
    context.logger.debug(`[ControlFlow] Condition: ${ifStep.if.condition}`)
    context.logger.debug(`[ControlFlow] Then branch has ${ifStep.if.thenBranch.length} step(s)`)
    if (ifStep.if.elseBranch) {
      context.logger.debug(`[ControlFlow] Else branch has ${ifStep.if.elseBranch.length} step(s)`)
    }

    const conditionResult = evaluateCondition(ifStep.if.condition, input, state, options.allowUnsafeCodeExecution)
    context.logger.debug(`[ControlFlow] If/else '${ifStep.id}' condition = ${conditionResult}`)

    const branchSteps = conditionResult ? ifStep.if.thenBranch : (ifStep.if.elseBranch ?? [])
    const branchName = conditionResult ? 'then' : ifStep.if.elseBranch ? 'else' : 'else (empty)'

    context.logger.info(`[ControlFlow] Taking '${branchName}' branch of '${ifStep.id}'`)

    let branchResult: unknown

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
    const outputKey = ifStep.output ?? ifStep.id
    state[outputKey] = branchResult
    context.logger.debug(`[ControlFlow] If/else '${ifStep.id}' stored output as '${outputKey}'`)

    return { result: branchResult, shouldBreak: false, shouldContinue: false }
  }

  // Handle try/catch block
  if (isTryCatchStep(step)) {
    const tryStep = step as TryCatchStep
    context.logger.info(`[ControlFlow] Executing try/catch block '${tryStep.id}'`)
    context.logger.debug(`[ControlFlow] Try block has ${tryStep.try.trySteps.length} step(s)`)
    context.logger.debug(`[ControlFlow] Catch block has ${tryStep.try.catchSteps.length} step(s)`)

    let tryResult: unknown
    let caughtError: Error | undefined

    try {
      // Execute try steps
      for (const tryStepItem of tryStep.try.trySteps) {
        const { result } = await executeControlFlowStep(
          tryStepItem,
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
        storeStepOutput(tryStepItem, result, state)

        // Last result becomes try result
        tryResult = result
      }

      // Store try/catch output if specified
      const outputKey = tryStep.output ?? tryStep.id
      state[outputKey] = tryResult
      context.logger.debug(`[ControlFlow] Try/catch '${tryStep.id}' completed successfully`)

      return { result: tryResult, shouldBreak: false, shouldContinue: false }
    } catch (error) {
      caughtError = error instanceof Error ? error : new Error(String(error))
      context.logger.warn(`[ControlFlow] Try/catch '${tryStep.id}' caught error: ${caughtError.message}`)

      // Execute catch steps
      let catchResult: unknown
      for (const catchStepItem of tryStep.try.catchSteps) {
        const { result } = await executeControlFlowStep(
          catchStepItem,
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
        storeStepOutput(catchStepItem, result, state)

        // Last result becomes catch result
        catchResult = result
      }

      // Store try/catch output if specified
      const outputKey = tryStep.output ?? tryStep.id
      state[outputKey] = catchResult
      context.logger.debug(`[ControlFlow] Try/catch '${tryStep.id}' caught error and executed catch block`)

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
    input: Record<string, unknown>,
    context: WorkflowContext<TTools>,
    inheritedState: Record<string, unknown>,
  ): Promise<unknown> => {
    const workflow = definition.workflows[workflowId]
    if (!workflow) {
      const builtIn = options.builtInWorkflows?.[workflowId]
      if (builtIn) {
        context.logger.info(`[Workflow] Delegating to built-in workflow '${workflowId}'`)
        // Built-in workflows are typed as WorkflowFn<any, any, any>, so we need to cast context
        // TODO: Improve built-in workflow typing to preserve context type constraints
        return await builtIn(input, context as WorkflowContext<ToolRegistry>)
      }
      throw new Error(`Workflow '${workflowId}' not found`)
    }

    // Validate inputs and apply defaults
    const validatedInput = validateAndApplyDefaults(workflowId, workflow, input)

    context.logger.info(`[Workflow] Starting workflow '${workflowId}'`)
    context.logger.debug(`[Workflow] Input: ${JSON.stringify(validatedInput)}`)
    context.logger.debug(`[Workflow] Inherited state: ${JSON.stringify(inheritedState)}`)
    context.logger.debug(`[Workflow] Steps: ${workflow.steps.map((s) => ('id' in s ? s.id : '<control flow>')).join(', ')}`)

    const state: Record<string, unknown> = { ...inheritedState }
    let lastOutput: unknown

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

  return async (workflowId: string, input: Record<string, unknown>, context: WorkflowContext<TTools>) => {
    return await runInternal(workflowId, input, context, {})
  }
}
