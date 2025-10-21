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

export type ToolHandler<TTools extends ToolRegistry> = {
  [K in keyof TTools]: (input: TTools[K]['input']) => Promise<TTools[K]['output']>
}

export type WorkflowContext<TTools extends ToolRegistry> = {
  step: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  logger: Logger
  toolHandler: ToolHandler<TTools>
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
  toolHandler: ToolHandler<TTools>,
  stepFn?: <T>(name: string, fn: () => Promise<T>) => Promise<T>,
  logger: Logger = silentLogger,
): WorkflowContext<TTools> {
  if (!stepFn) {
    // simple default step function
    stepFn = async <T>(_name: string, fn: () => Promise<T>) => fn()
  }

  return { step: stepFn, logger, toolHandler }
}

export const makeStepFn = (): (<T>(name: string, fn: () => Promise<T>) => Promise<T>) => {
  const results: Map<string, any> = new Map()
  const callStack: string[] = []

  return async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    callStack.push(name)
    const key = callStack.join('>')

    try {
      if (results.has(key)) {
        return results.get(key) as T
      }

      const result = await fn()
      results.set(key, result)
      return result
    } finally {
      callStack.pop()
    }
  }
}
