export type JsonPrimitive = string | number | boolean | null

export type PlainJson = JsonPrimitive | readonly PlainJson[] | { readonly [K in string]?: PlainJson }

export type StepFn<TTools extends ToolRegistry = any> = {
  // biome-ignore lint/suspicious/noConfusingVoidType: void means no return
  <T extends PlainJson | void>(name: string, fn: () => Promise<T>): Promise<T>
  // biome-ignore lint/suspicious/noConfusingVoidType: void means no return
  <T extends PlainJson | void>(
    name: string,
    fn: () => AsyncGenerator<ToolCall<TTools>, T, TTools[keyof TTools]['output']>,
  ): AsyncGenerator<ToolCall<TTools>, T, TTools[keyof TTools]['output']>
}

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

export type WorkflowTools<TTools extends ToolRegistry> = {
  [K in keyof TTools]: (input: TTools[K]['input']) => Generator<ToolCall<TTools>, TTools[K]['output'], TTools[K]['output']>
}

export type WorkflowFn<TInput, TOutput extends PlainJson, TTools extends ToolRegistry> = (
  input: TInput,
  step: StepFn<TTools>,
  tools: WorkflowTools<TTools>,
) => AsyncGenerator<ToolCall<TTools>, TOutput, TTools[keyof TTools]['output']>

export type Workflow<TInput, TOutput extends PlainJson, TTools extends ToolRegistry> = {
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

import { makeStepFn } from './helpers'

export type WorkflowResult<TInput, TOutput extends PlainJson, TTools extends ToolRegistry> =
  | (WorkflowStatusPending<TTools> & {
      next: (toolResult: TTools[keyof TTools]['output']) => Promise<WorkflowResult<TInput, TOutput, TTools>>
      throw: (error: Error) => Promise<WorkflowResult<TInput, TOutput, TTools>>
    })
  | WorkflowStatusCompleted<TOutput>
  | WorkflowStatusFailed

export async function run<TInput, TOutput extends PlainJson, TTools extends ToolRegistry>(
  workflow: Workflow<TInput, TOutput, TTools>,
  input: TInput,
  stepFn?: StepFn<TTools>,
): Promise<WorkflowResult<TInput, TOutput, TTools>> {
  if (!stepFn) {
    stepFn = makeStepFn<TTools>()
  }

  const tools = new Proxy({} as WorkflowTools<TTools>, {
    get: (_target, tool: string) => {
      return function* (input: any): Generator<ToolCall<TTools>, any, any> {
        return yield {
          type: 'tool',
          tool,
          input,
        }
      }
    },
  })

  const gen = workflow.fn(input, stepFn, tools)

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

  const next: (toolResult: TTools[keyof TTools]['output']) => Promise<WorkflowResult<TInput, TOutput, TTools>> = async (
    toolResult: TTools[keyof TTools]['output'],
  ) => {
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
        return { ...status, next, throw: throwError }
      }
      case 'completed':
      case 'failed':
        return status
    }
  }

  const throwError: (error: Error) => Promise<WorkflowResult<TInput, TOutput, TTools>> = async (error: Error) => {
    switch (status.status) {
      case 'pending': {
        try {
          const { value, done } = await gen.throw(error)
          if (done) {
            status = { status: 'completed', output: value }
            return status
          }
          status = { status: 'pending', tool: value }
        } catch (e) {
          status = { status: 'failed', error: e }
          return status
        }
        return { ...status, next, throw: throwError }
      }
      case 'completed':
      case 'failed':
        return status
    }
  }

  if (status.status === 'pending') {
    return {
      ...status,
      next,
      throw: throwError,
    }
  }
  return status
}
