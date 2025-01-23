export type AiToolDefinition<Input, Output = string> = {
  name: string
  description: string
  prompt: string
  formatInput: (params: Input) => string
  parseOutput: (output: string) => Output
}

export type GetInput<T> = T extends AiToolDefinition<infer Input> ? Input : never
export type GetOutput<T> = T extends AiToolDefinition<any, infer Output> ? Output : never
