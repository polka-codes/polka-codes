/**
 * Shared prompt components for dynamic workflow generation.
 * These are used by both code generation and code review workflows.
 */

/**
 * TypeScript type definitions for the runtime context available in dynamic workflow steps.
 */
export const RUNTIME_CONTEXT_TYPES = `## Runtime context (ctx)
\`\`\`ts
// Runtime types (for reference)
type Logger = {
  debug: (...args: any[]) => void
  info: (...args: any[]) => void
  warn: (...args: any[]) => void
  error: (...args: any[]) => void
}

type StepFn = {
  <T>(name: string, fn: () => Promise<T>): Promise<T>
  <T>(name: string, options: { retry?: number }, fn: () => Promise<T>): Promise<T>
}

type JsonModelMessage = { role: 'system' | 'user' | 'assistant' | 'tool'; content: any }
type JsonResponseMessage = { role: 'assistant' | 'tool'; content: any }
type ToolSet = Record<string, any>

type ToolResponseResult =
  | { type: 'text'; value: string }
  | { type: 'json'; value: any }
  | { type: 'error-text'; value: string }
  | { type: 'error-json'; value: any }
  | { type: 'content'; value: any[] }

type AgentToolResponse =
  | { type: 'Reply'; message: ToolResponseResult }
  | { type: 'Exit'; message: string; object?: any }
  | { type: 'Error'; message: ToolResponseResult }

type ExitReason =
  | { type: 'UsageExceeded' }
  | { type: 'Exit'; message: string; object?: any }
  | { type: 'Error'; error: { message: string; stack?: string } }

type FullToolInfo = { name: string; description: string; parameters: any; handler: any }

type AgentTools = {
  readFile: (input: { path: string }) => Promise<string | null>
  writeToFile: (input: { path: string; content: string }) => Promise<void>
  executeCommand: (input: { command: string; pipe?: boolean; requiresApproval?: boolean } & ({ args: string[]; shell?: false } | { shell: true })) => Promise<{
    exitCode: number
    stdout: string
    stderr: string
  }>
  searchFiles: (input: { path: string; regex: string; filePattern?: string }) => Promise<string>
  listFiles: (input: { path: string; recursive?: boolean; maxCount?: number; includeIgnored?: boolean }) => Promise<string>
  fetchUrl: (input: { url: string[] }) => Promise<string>
  askFollowupQuestion: (input: { questions: { prompt: string; options?: string[] }[] }) => Promise<any>
  // ... and other tools available in the environment
}

// Tools available on ctx.tools in dynamic steps
type DynamicWorkflowTools = {
  // LLM + agent helpers
  runAgent: (input: {
    tools: Readonly<FullToolInfo[]>
    maxToolRoundTrips?: number
    userMessage: readonly JsonModelMessage[]
  } & ({ messages: JsonModelMessage[] } | { systemPrompt: string })) => Promise<ExitReason>

  // CLI UX helpers
  confirm: (input: { message: string }) => Promise<boolean>
  input: (input: { message: string; default?: string }) => Promise<string>
  select: (input: { message: string; choices: { name: string; value: string }[] }) => Promise<string>
}

type DynamicStepRuntimeContext = {
  workflowId: string
  stepId: string
  input: Record<string, any>
  state: Record<string, any>
  tools: DynamicWorkflowTools
  agentTools: AgentTools
  logger: Logger
  step: StepFn
  runWorkflow: (workflowId: string, input?: Record<string, any>) => Promise<any>
  toolInfo?: ReadonlyArray<FullToolInfo>
}
\`\`\`

- \`ctx.input\`: workflow inputs (read-only).
- \`ctx.state\`: shared state between steps (previous step outputs are stored here).
- \`ctx.agentTools\`: standard tools (readFile, executeCommand, etc.). Call as \`await ctx.agentTools.someTool({ ... })\`.
- \`ctx.tools\`: workflow helpers (runAgent, confirm, input, select).
- \`ctx.runWorkflow\`: run a sub-workflow by id.`

/**
 * Guidelines for accessing context and returning values.
 */
export const CONTEXT_USAGE_GUIDELINES = `## Guidelines
- Use \`await\` for all async operations.
- Return the output value for the step (this becomes the step output).
- Access inputs via \`ctx.input.<inputId>\`.
- Access previous step outputs via \`ctx.state.<stepOutputKey>\` (defaults to the step \`output\` or \`id\`).`

/**
 * Quality guidelines for error handling, logging, validation, and best practices.
 */
export const QUALITY_GUIDELINES = `## Quality Guidelines for Code Implementation

### Error Handling
- ALWAYS validate inputs at the start of steps
- Use try-catch for operations that might fail (file I/O, parsing, API calls)
- Preserve stack traces: re-throw original errors rather than creating new ones
- Use error type guards: \`const err = error instanceof Error ? error : new Error(String(error))\`
- Check for null/undefined before using values
- Handle edge cases (empty arrays, missing files, invalid data)

### Logging
- Use \`ctx.logger.info()\` for important progress updates
- Use \`ctx.logger.debug()\` for detailed information
- Use \`ctx.logger.warn()\` for recoverable issues
- Use \`ctx.logger.error()\` before throwing errors
- Log when starting and completing significant operations
- Use template literals for readability: \`ctx.logger.info(\\\`Processing \${items.length} items...\\\`)\`

### User Experience
- Provide progress feedback for long operations
- Return structured data (objects/arrays), not strings when possible
- Include helpful metadata in results (counts, timestamps, status)
- For batch operations, report progress: \`Processed 5/10 items\`

### Data Validation
- Validate required fields exist before accessing
- Check data types match expectations
- Validate array lengths before iteration
- Example: \`if (!data?.users || !Array.isArray(data.users)) throw new Error('Invalid data format')\`

### Best Practices
- Use meaningful variable names
- Avoid nested callbacks - use async/await
- Clean up resources (close files, clear timeouts)
- Return consistent data structures across similar steps
- For iteration, consider batching or rate limiting

### When to Simplify
- Simple transformation steps (e.g., formatting strings) need only basic error handling
- Internal sub-workflow steps with validated inputs from parent can skip redundant validation
- Minimal logging is fine for fast steps (<100ms) that don't perform I/O or external calls
- Use judgment: match error handling complexity to the step's failure risk and impact`

export const TOOL_CALLING_EXAMPLES = `## Tool calling examples

### Standard tools (ctx.agentTools)
\`\`\`ts
// readFile
const readme = await ctx.agentTools.readFile({ path: 'README.md' })
if (readme == null) throw new Error('README.md not found')

// writeToFile
await ctx.agentTools.writeToFile({ path: 'notes.txt', content: 'hello\\n' })

// executeCommand (args form)
const rg = await ctx.agentTools.executeCommand({ command: 'rg', args: ['-n', 'TODO', '.'] })
if (rg.exitCode !== 0) throw new Error(rg.stderr)

// executeCommand (shell form)
await ctx.agentTools.executeCommand({ command: 'ls -la', shell: true, pipe: true })
\`\`\`

### Workflow helpers (ctx.tools)
\`\`\`ts
// runAgent (nested agent; use ctx.toolInfo as the tool list)
const agentRes = await ctx.tools.runAgent({
  systemPrompt: 'You are a helpful assistant.',
  userMessage: [{ role: 'user', content: 'Summarize README.md in 3 bullets.' }],
  tools: (ctx.toolInfo ?? []) as any,
})
if (agentRes.type !== 'Exit') throw new Error('runAgent failed')

// confirm / input / select (interactive)
const ok = await ctx.tools.confirm({ message: 'Proceed?' })
const name = await ctx.tools.input({ message: 'Name?', default: 'main' })
const flavor = await ctx.tools.select({
  message: 'Pick one',
  choices: [
    { name: 'A', value: 'a' },
    { name: 'B', value: 'b' },
  ],
})
\`\`\`

### Sub-workflow example (ctx.runWorkflow)
\`\`\`ts
const results: any[] = []
for (const pr of ctx.state.prs ?? []) {
  results.push(await ctx.runWorkflow('reviewPR', { prId: pr.id }))
}
return results
\`\`\``

/**
 * Complete example demonstrating all quality guidelines in a single step.
 */
export const COMPLETE_STEP_EXAMPLE = `## Complete Example: High-Quality Step Implementation

This example demonstrates all quality guidelines in a single step:

\`\`\`ts
// Step: processUserData
// Task: Read, validate, and process user data from a file

// Input validation
if (!ctx.input.dataFile) {
  throw new Error('Missing required input: dataFile')
}

ctx.logger.info(\`Starting user data processing for: \${ctx.input.dataFile}\`)

// Read file with error handling
let rawData
try {
  ctx.logger.debug(\`Reading file: \${ctx.input.dataFile}\`)
  rawData = await ctx.agentTools.readFile({ path: ctx.input.dataFile })

  if (!rawData) {
    throw new Error(\`File not found or empty: \${ctx.input.dataFile}\`)
  }
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error))
  ctx.logger.error(\`Failed to read file: \${err.message}\`)
  throw err  // Preserve original stack trace
}

// Parse and validate data
let users
try {
  ctx.logger.debug('Parsing JSON data')
  const parsed = JSON.parse(rawData)

  if (!parsed?.users || !Array.isArray(parsed.users)) {
    throw new Error('Invalid data format: expected {users: [...]}')
  }

  users = parsed.users
  ctx.logger.info(\`Found \${users.length} users to process\`)
} catch (error) {
  const err = error instanceof Error ? error : new Error(String(error))
  ctx.logger.error(\`Data parsing failed: \${err.message}\`)
  throw err  // Preserve original stack trace
}

// Process each user with progress reporting
const results = []
for (let i = 0; i < users.length; i++) {
  const user = users[i]

  // Validate each user object
  if (!user?.id || !user?.email) {
    ctx.logger.warn(\`Skipping invalid user at index \${i}: missing id or email\`)
    continue
  }

  // Process user
  const processed = {
    id: user.id,
    email: user.email.toLowerCase().trim(),
    name: user.name?.trim() || 'Unknown',
    processedAt: new Date().toISOString(),
    status: 'active'
  }

  results.push(processed)

  // Progress feedback every 10 items
  if ((i + 1) % 10 === 0) {
    ctx.logger.info(\`Processed \${i + 1}/\${users.length} users\`)
  }
}

ctx.logger.info(\`Successfully processed \${results.length}/\${users.length} users\`)

// Return structured result with metadata
return {
  users: results,
  metadata: {
    totalInput: users.length,
    totalProcessed: results.length,
    skipped: users.length - results.length,
    processedAt: new Date().toISOString()
  }
}
\`\`\`

Key features demonstrated:
- Input validation at start
- Comprehensive error handling with try-catch that preserves stack traces
- Logging at info, debug, warn, and error levels
- Progress reporting for long operations (every 10 items)
- Data validation throughout (null checks, type checks, array validation)
- Structured return value with metadata for observability
- Descriptive error messages with context
- Meaningful variable names (rawData, users, processed)
- Clean async/await usage
- Template literals for readable string interpolation
- Proper error type guards (error instanceof Error)`

/**
 * Instructions about code field format constraints.
 */
export const CODE_FIELD_CONSTRAINTS = `REMEMBER: The "code" field must be ONLY the function body statements.
- DO NOT wrap code in arrow functions: \`(ctx) => { ... }\`
- DO NOT wrap code in async functions: \`async (ctx) => { ... }\`
- DO NOT include outer curly braces
- DO include a return statement if the step should produce output
- Each "code" field should be a string containing multiple statements separated by newlines`

/**
 * Compose the full implementation guidelines from individual components.
 */
export function composeImplementationGuidelines(): string {
  return [
    RUNTIME_CONTEXT_TYPES,
    '',
    CONTEXT_USAGE_GUIDELINES,
    '',
    QUALITY_GUIDELINES,
    '',
    TOOL_CALLING_EXAMPLES,
    '',
    COMPLETE_STEP_EXAMPLE,
  ].join('\n')
}
