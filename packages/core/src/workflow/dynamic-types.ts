import { z } from 'zod'

export const WorkflowInputDefinitionSchema = z.object({
  id: z.string(),
  description: z.string().nullish(),
  default: z.any().nullish(),
})

/**
 * Basic workflow step - executes a task
 */
export const WorkflowStepDefinitionSchema = z.object({
  id: z.string(),
  tools: z.array(z.string()).nullish(),
  task: z.string(),
  output: z.string().nullish(),
  expected_outcome: z.string().nullish(),
  /**
   * Optional JSON schema or other metadata for future structured outputs.
   * Not interpreted by core today.
   */
  outputSchema: z.any().nullish(),
  /**
   * Optional timeout in milliseconds. Step execution will be aborted if it exceeds this duration.
   */
  timeout: z.number().positive().nullish(),
})

/**
 * Control flow step types
 */

/**
 * While loop - repeats steps while condition is true
 */
export const WhileLoopStepSchema = z.object({
  id: z.string(),
  while: z.object({
    condition: z.string().describe('JavaScript expression that evaluates to true/false'),
    steps: z.array(z.lazy(() => WorkflowControlFlowStepSchema)),
  }),
  output: z.string().nullish(),
})

/**
 * If/else branch - conditionally executes steps
 */
export const IfElseStepSchema = z.object({
  id: z.string(),
  if: z.object({
    condition: z.string().describe('JavaScript expression that evaluates to true/false'),
    thenBranch: z.array(z.lazy(() => WorkflowControlFlowStepSchema)),
    elseBranch: z.array(z.lazy(() => WorkflowControlFlowStepSchema)).optional(),
  }),
  output: z.string().nullish(),
})

/**
 * Break statement - exits the nearest enclosing loop
 */
export const BreakStepSchema = z.object({
  break: z.literal(true),
})

/**
 * Continue statement - skips to next iteration of nearest enclosing loop
 */
export const ContinueStepSchema = z.object({
  continue: z.literal(true),
})

/**
 * Any step that can appear in a workflow's steps array
 * Can be a basic step, control flow, or jump statement
 */
export const WorkflowControlFlowStepSchema: any = z.union([
  WorkflowStepDefinitionSchema,
  WhileLoopStepSchema,
  IfElseStepSchema,
  BreakStepSchema,
  ContinueStepSchema,
])

/**
 * Workflow definition - now supports control flow in steps
 */
export const WorkflowDefinitionSchema = z.object({
  task: z.string(),
  inputs: z.array(WorkflowInputDefinitionSchema).nullish(),
  steps: z.array(WorkflowControlFlowStepSchema),
  output: z.string().nullish(),
})

export const WorkflowFileSchema = z.object({
  workflows: z.record(z.string(), WorkflowDefinitionSchema),
})

export type WorkflowInputDefinition = z.infer<typeof WorkflowInputDefinitionSchema>
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>
export type WhileLoopStep = z.infer<typeof WhileLoopStepSchema>
export type IfElseStep = z.infer<typeof IfElseStepSchema>
export type BreakStep = z.infer<typeof BreakStepSchema>
export type ContinueStep = z.infer<typeof ContinueStepSchema>
export type WorkflowControlFlowStep = z.infer<typeof WorkflowControlFlowStepSchema>
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>
export type WorkflowFile = z.infer<typeof WorkflowFileSchema>
