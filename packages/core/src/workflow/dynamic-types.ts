import { z } from 'zod'

export const WorkflowInputDefinitionSchema = z.object({
  id: z.string(),
  description: z.string().nullish(),
  default: z.any().nullish(),
})

export const WorkflowStepDefinitionSchema = z.object({
  id: z.string(),
  tools: z.array(z.string()).nullish(),
  task: z.string(),
  output: z.string().nullish(),
  expected_outcome: z.string().nullish(),
  /**
   * Persisted JavaScript/TypeScript (JS-compatible) async function body.
   * The code is wrapped as: `async (ctx) => { <code> }`.
   */
  code: z.string().nullish(),
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

export const WorkflowDefinitionSchema = z.object({
  task: z.string(),
  inputs: z.array(WorkflowInputDefinitionSchema).nullish(),
  steps: z.array(WorkflowStepDefinitionSchema),
  output: z.string().nullish(),
})

export const WorkflowFileSchema = z.object({
  workflows: z.record(z.string(), WorkflowDefinitionSchema),
})

export type WorkflowInputDefinition = z.infer<typeof WorkflowInputDefinitionSchema>
export type WorkflowStepDefinition = z.infer<typeof WorkflowStepDefinitionSchema>
export type WorkflowDefinition = z.infer<typeof WorkflowDefinitionSchema>
export type WorkflowFile = z.infer<typeof WorkflowFileSchema>
