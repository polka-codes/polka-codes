import type { Json, StepRunResult, StepSpecRaw, WorkflowContext } from './types'

export const runStep = async (
  step: StepSpecRaw,
  input: Record<string, Json>,
  context: WorkflowContext,
  resumedState: any | undefined,
  allOutputs: Record<string, Record<string, Json>>,
): Promise<StepRunResult<Record<string, Json>>> => {
  try {
    const validatedInput = step.inputSchema?.parse(input) ?? input

    const result = await step.run({ ...validatedInput, $: allOutputs }, context, resumedState)

    if (result.type === 'success') {
      const validatedOutput = step.outputSchema?.parse(result.output) ?? result.output
      return {
        ...result,
        output: validatedOutput,
      }
    }

    return result
  } catch (error) {
    return { type: 'error', error }
  }
}
