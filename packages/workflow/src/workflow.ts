export type JsonPrimitive = string | number | boolean | null

export type PlainJson = JsonPrimitive | readonly PlainJson[] | { readonly [K in string]?: PlainJson }

export type StepFn = <T extends PlainJson>(name: string, fn: () => Promise<T>) => Promise<T>

export type ToolSignature<I extends PlainJson, O extends PlainJson> = {
  input: I
  output: O
}

export type ToolRegistry = Record<string, ToolSignature<PlainJson, PlainJson>>

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

export function* useTool<TTools extends ToolRegistry, TName extends keyof TTools>(
  tool: TName,
  input: TTools[TName]['input'],
): Generator<ToolCall<TTools>, TTools[TName]['output'], TTools[TName]['output']> {
  return yield {
    type: 'tool',
    tool,
    input,
  }
}

export type WorkflowFn<TInput extends PlainJson, TOutput extends PlainJson, TTools extends ToolRegistry> = (
  input: TInput,
  step: StepFn,
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

  const gen = workflow.fn(input, stepFn)

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

// type Tools = {
//   askUser: ToolSignature<{ prompt: string }, string>
//   readFile: ToolSignature<{ path: string; encoding?: 'utf8' | 'base64' | 'hex' }, { content: string }>
// }

// const defaultExecutors: ToolsExecutor<Tools> = {
//   async askUser({ prompt }) {
//     // In a real host, wire this to UI and await user input.
//     // For this example, log and synthesize a reply.
//     console.log({ prompt })
//     return `|${prompt}|`
//   },
//   async readFile({ path, encoding = 'utf8' }) {
//     const fs = await import('node:fs/promises')
//     const content = await fs.readFile(path, { encoding })
//     return { content }
//   },
// }

// const testWorkflow: Workflow<string, string, Tools> = {
//   name: 'test',
//   description: 'test workflow',
//   async *fn(input, _step) {
//     const userName = yield* useTool('askUser', { prompt: 'Your name?' })

//     const file = yield* useTool('readFile', { path: './greeting.txt' })

//     return `hello ${userName} ${input} ${file}`
//   },
// }

// async function main() {
//   const result = await run(testWorkflow, 'input')
//   switch (result.status) {
//     case 'pending': {
//       switch (result.tool.type) {
//         case 'tool': {
//           switch (result.tool.tool) {
//             case 'askUser': {
//               const toolResult = await defaultExecutors[result.tool.tool](result.tool.input)
//               await result.next(toolResult)
//               break
//             }
//             case 'readFile': {
//               const toolResult = await defaultExecutors[result.tool.tool](result.tool.input)
//               await result.next(toolResult)
//               break
//             }
//           }
//           break
//         }
//       }
//       break
//     }
//     case 'completed':
//       console.log('completed')
//       break
//     case 'failed':
//       console.log('failed')
//       break
//   }
//   console.log(result)
// }

// main().catch(console.error)
