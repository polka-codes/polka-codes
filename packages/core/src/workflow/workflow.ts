export interface Logger {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

export type ToolSignature<I, O> = {
  input: I
  output: O
}

export type ToolRegistry = Record<string, ToolSignature<any, any>>

export type WorkflowTools<TTools extends ToolRegistry> = {
  [K in keyof TTools]: (input: TTools[K]['input']) => Promise<TTools[K]['output']>
}

export type StepOptions = {
  retry?: number
}

export interface StepFn {
  <T>(name: string, fn: () => Promise<T>): Promise<T>
  <T>(name: string, options: StepOptions, fn: () => Promise<T>): Promise<T>
}

export type WorkflowContext<TTools extends ToolRegistry> = {
  step: StepFn
  logger: Logger
  tools: WorkflowTools<TTools>
}

export type WorkflowFn<TInput, TOutput, TTools extends ToolRegistry> = (input: TInput, context: WorkflowContext<TTools>) => Promise<TOutput>

// Create a default silent logger
const silentLogger: Logger = {
  debug: () => {},
  info: () => {},
  warn: () => {},
  error: () => {},
}

export function createContext<TTools extends ToolRegistry>(
  tools: WorkflowTools<TTools>,
  stepFn?: StepFn,
  logger: Logger = silentLogger,
): WorkflowContext<TTools> {
  if (!stepFn) {
    // simple default step function
    stepFn = async <T>(_name: string, arg2: (() => Promise<T>) | StepOptions, arg3?: StepOptions | (() => Promise<T>)) => {
      const fn = typeof arg2 === 'function' ? arg2 : (arg3 as () => Promise<T>)
      return fn()
    }
  }

  return { step: stepFn, logger, tools }
}

export const makeStepFn = (): StepFn => {
  const results: Map<string, any> = new Map()
  const callStack: string[] = []

  return async <T>(name: string, arg2: (() => Promise<T>) | StepOptions, arg3?: StepOptions | (() => Promise<T>)): Promise<T> => {
    let fn: () => Promise<T>
    let options: StepOptions | undefined

    if (typeof arg2 === 'function') {
      fn = arg2 as () => Promise<T>
      options = arg3 as StepOptions | undefined
    } else {
      options = arg2 as StepOptions
      fn = arg3 as () => Promise<T>
    }

    callStack.push(name)
    const key = callStack.join('>')

    try {
      if (results.has(key)) {
        return results.get(key) as T
      }

      const maxRetryCount = options?.retry ?? 1
      let lastError: unknown

      for (let retryCount = 0; retryCount <= maxRetryCount; retryCount++) {
        try {
          const result = await fn()
          results.set(key, result)
          return result
        } catch (error) {
          lastError = error
        }
      }
      throw lastError
    } finally {
      callStack.pop()
    }
  }
}
