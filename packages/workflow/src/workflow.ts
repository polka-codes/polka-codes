type ValidJsonOrVoid<T> = T extends string | number | boolean | null | void
  ? T
  : T extends readonly (infer U)[]
    ? readonly ValidJsonOrVoid<U>[]
    : // biome-ignore lint/complexity/noBannedTypes: this is needed
      T extends Function | symbol | bigint | Date | Map<any, any> | Set<any> | WeakMap<any, any> | WeakSet<any>
      ? never
      : T extends object
        ? { readonly [K in keyof T]: ValidJsonOrVoid<T[K]> }
        : never

export type StepFn<TTools extends ToolRegistry = ToolRegistry> = <T>(
  name: string,
  fn: () => AsyncGenerator<ToolCall<TTools>, ValidJsonOrVoid<T>, TTools[keyof TTools]['output']>,
) => AsyncGenerator<ToolCall<TTools>, T, TTools[keyof TTools]['output']>

export type ToolSignature<I, O> = {
  input: I
  output: O
}

export type ToolRegistry = Record<string, ToolSignature<any, any>>

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
  [K in keyof TTools]: (input: TTools[K]['input']) => Generator<
    {
      type: 'tool'
      tool: K
      input: TTools[K]['input']
    },
    TTools[K]['output'],
    TTools[K]['output']
  >
}

export interface Logger {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

export type WorkflowContext<TTools extends ToolRegistry> = {
  step: StepFn<TTools>
  tools: WorkflowTools<TTools>
  logger: Logger
}

export type WorkflowFn<TInput, TOutput, TTools extends ToolRegistry> = (
  input: TInput,
  context: WorkflowContext<TTools>,
) => AsyncGenerator<ToolCall<TTools>, TOutput, TTools[keyof TTools]['output']>

export type Workflow<TInput, TOutput, TTools extends ToolRegistry> = {
  name: string
  description: string
  fn: WorkflowFn<TInput, TOutput, TTools>
}

export type WorkflowStatusPending<TTools extends ToolRegistry> = {
  status: 'pending'
  tool: ToolCall<TTools>
}

export type WorkflowStatusCompleted<TOutput> = {
  status: 'completed'
  output: TOutput
}

export type WorkflowStatusFailed = {
  status: 'failed'
  error: any
}

export type WorkflowStatus<TTools extends ToolRegistry, TOutput> =
  | WorkflowStatusPending<TTools>
  | WorkflowStatusCompleted<TOutput>
  | WorkflowStatusFailed

import { makeStepFn } from './helpers'

export type WorkflowResult<TInput, TOutput, TTools extends ToolRegistry> =
  | (WorkflowStatusPending<TTools> & {
      next: (toolResult: TTools[keyof TTools]['output']) => Promise<WorkflowResult<TInput, TOutput, TTools>>
      throw: (error: Error) => Promise<WorkflowResult<TInput, TOutput, TTools>>
    })
  | WorkflowStatusCompleted<TOutput>
  | WorkflowStatusFailed

// Create a default silent logger
const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export async function run<TInput, TOutput, TTools extends ToolRegistry>(
  workflow: Workflow<TInput, TOutput, TTools>,
  input: TInput,
  stepFn?: StepFn<TTools>,
  logger: Logger = silentLogger,
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

  const context: WorkflowContext<TTools> = { step: stepFn, tools, logger }
  const gen = workflow.fn(input, context)

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
