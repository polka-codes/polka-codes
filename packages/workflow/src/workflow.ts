export type JsonPrimitive = string | number | boolean | null

export type PlainJson = JsonPrimitive | readonly PlainJson[] | { readonly [K in string]?: PlainJson }

export type StepFn = <T extends PlainJson>(name: string, fn: () => Promise<T>) => Promise<T>

export type ToolSignature<I, O extends PlainJson> = {
  input: I
  output: O
}

export type ToolRegistry = Record<string, ToolSignature<any, PlainJson>>

export type ToolCall<TTools extends ToolRegistry> = {
  [K in keyof TTools]: {
    type: 'tool'
    tool: K
    input: TTools[K]['input']
  }
}[keyof TTools]

export type ToolsExecutor<TTools extends ToolRegistry> = {
  [K in keyof TTools]: (input: TTools[K]['input']) => Promise<TTools[K]['output']>
}

export type WorkflowFn<TInput extends PlainJson, TOutput extends PlainJson, TTools extends ToolRegistry> = (
  input: TInput,
  step: StepFn,
  useTool: <TName extends keyof TTools>(
    tool: TName,
    input: TTools[TName]['input'],
  ) => Generator<ToolCall<TTools>, TTools[TName]['output'], TTools[TName]['output']>,
) => AsyncGenerator<ToolCall<TTools>, TOutput, TTools[keyof TTools]['output']>

export type Workflow<TInput extends PlainJson, TOutput extends PlainJson, TTools extends ToolRegistry> = {
  name: string
  description: string
  fn: WorkflowFn<TInput, TOutput, TTools>
}

export type WorkflowStatusPending<TTools extends ToolRegistry> = {
  status: 'pending'
  tool: ToolCall<TTools>
}

export type WorkflowStatusCompleted<TOutput extends PlainJson> = {
  status: 'completed'
  output: TOutput
}

export type WorkflowStatusFailed = {
  status: 'failed'
  error: unknown
}

export type WorkflowStatus<TTools extends ToolRegistry, TOutput extends PlainJson> =
  | WorkflowStatusPending<TTools>
  | WorkflowStatusCompleted<TOutput>
  | WorkflowStatusFailed

export async function run<TInput extends PlainJson, TOutput extends PlainJson, TTools extends ToolRegistry>(
  workflow: Workflow<TInput, TOutput, TTools>,
  input: TInput,
  stepFn?: StepFn,
) {
  if (!stepFn) {
    const results: Record<string, unknown> = {}
    const counts: Record<string, number> = {}
    stepFn = async <T extends PlainJson>(name: string, fn: () => Promise<T>) => {
      counts[name] = (counts[name] || 0) + 1
      const key = `${name}#${counts[name]}`
      if (key in results) {
        return results[key] as T
      }
      const result = await fn()
      results[key] = result
      return result
    }
  }

  const gen = workflow.fn(input, stepFn, function* useTool(tool, input) {
    return yield {
      type: 'tool',
      tool,
      input,
    }
  })

  let status: WorkflowStatus<TTools, TOutput>
  try {
    const { value, done } = await gen.next()
    if (done) {
      const status: WorkflowStatusCompleted<TOutput> = { status: 'completed', output: value }
      return status
    }
    status = { status: 'pending', tool: value }
  } catch (e) {
    status = { status: 'failed', error: e }
    return status
  }

  const next = async (toolResult: TTools[keyof TTools]['output']) => {
    switch (status.status) {
      case 'pending': {
        try {
          const { value, done } = await gen.next(toolResult)
          if (done) {
            status = { status: 'completed', output: value }
            return status
          }
          status = { status: 'pending', tool: value }
        } catch (e) {
          status = { status: 'failed', error: e }
          return status
        }
        return { ...status, next, stepFn }
      }
      case 'completed':
      case 'failed':
        return status
    }
  }

  return {
    ...status,
    next,
  }
}
