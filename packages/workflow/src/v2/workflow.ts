import type { Logger, ToolRegistry } from '../workflow'

export type ToolHandler<TTools extends ToolRegistry> = {
  [K in keyof TTools]: (input: TTools[K]['input']) => Promise<TTools[K]['output']>
}

export type WorkflowContextV2<TTools extends ToolRegistry> = {
  step: <T>(name: string, fn: () => Promise<T>) => Promise<T>
  logger: Logger
  toolHandler: ToolHandler<TTools>
}

export type WorkflowFnV2<TInput, TOutput, TTools extends ToolRegistry> = (
  input: TInput,
  context: WorkflowContextV2<TTools>,
) => Promise<TOutput>

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
): WorkflowContextV2<TTools> {
  if (!stepFn) {
    // simple default step function
    stepFn = async <T>(_name: string, fn: () => Promise<T>) => fn()
  }

  return { step: stepFn, logger, toolHandler }
}

export const makeStepFn = (): (<T>(name: string, fn: () => Promise<T>) => Promise<T>) => {
  const results: Map<string, any> = new Map()

  return async <T>(name: string, fn: () => Promise<T>): Promise<T> => {
    if (results.has(name)) {
      return results.get(name) as T
    }

    const result = await fn()
    results.set(name, result)
    return result
  }
}
