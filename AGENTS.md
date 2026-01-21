# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Overview

Polka Codes is an AI-powered coding assistant framework built with TypeScript and Bun. It provides a CLI tool that helps developers with task planning, code generation, debugging, and git workflows through natural language interactions and a multi-agent system.

## Development Commands

### Building
```bash
bun build                 # Build all packages
bun clean                 # Remove build artifacts and tsconfig.tsbuildinfo files
```

### Testing
```bash
AGENT=1 bun test -u      # Run tests with snapshot updates (from .polkacodes.yml)
bun test                  # Run tests in normal mode
```

### Type Checking and Linting
```bash
bun typecheck            # Type check only (tsc --noEmit)
bun lint                 # Check for linting/formatting errors (biome)
bun fix                  # Auto-fix linting/formatting issues (biome --write --unsafe)
bun check                # Run both typecheck and lint
```

### Running the CLI in Development
```bash
bun cli <command>        # Run CLI in development mode
bun pr                   # Shortcut for creating PRs
bun commit               # Shortcut for commits
```

### GraphQL Code Generation
```bash
bun codegen              # Generate GraphQL types for the GitHub package
```

## Project Architecture

### Monorepo Structure

This is a Bun workspace monorepo with the following packages:

- **`packages/core`**: Core AI services, workflow engine, agent implementations, and tooling
- **`packages/cli`**: Command-line interface for interacting with AI services
- **`packages/cli-shared`**: Shared utilities and types for CLI packages
- **`packages/github`**: GitHub integration including the GitHub Action
- **`packages/runner`**: Service for running agents and managing tasks

### Workflow System

The workflow system is the foundation of how tasks are orchestrated:

**Core Workflow Primitives** (`packages/core/src/workflow/`):
- `workflow.ts`: Defines `WorkflowFn<TInput, TOutput, TTools>` - the core workflow type
- `WorkflowContext<TTools>`: Provides `step`, `logger`, and `tools` to workflow functions
- `step` function: Named execution units with built-in retry support and result caching
- `ToolRegistry`: Type-safe registry mapping tool names to input/output types
- `WorkflowTools<TTools>`: Typed tool interface derived from the registry

**Agent Workflow** (`packages/core/src/workflow/agent.workflow.ts`):
- Core agentic execution loop that handles tool calling and message flow
- Implements the request-response cycle with AI models
- Handles tool execution, validation, and exit conditions
- Supports JSON output schemas for structured responses
- Maximum round trips configurable to prevent infinite loops

**Dynamic Workflow System** (`packages/core/src/workflow/dynamic.ts`):
- Allows workflow definitions in YAML format
- Steps can either execute compiled code or be AI-agent-executed
- Supports sub-workflow calls via `runWorkflow` tool
- State management across workflow steps
- Safe code execution with `allowUnsafeCodeExecution` option

**CLI Workflow Implementations** (`packages/cli/src/workflows/`):
- Each CLI command maps to a workflow (e.g., `plan.workflow.ts`, `code.workflow.ts`)
- Workflows compose together (e.g., `plan` → `code` → `fix` → `commit`)
- `runWorkflow()` in `packages/cli/src/runWorkflow.ts` orchestrates workflow execution with provider setup

### Tool System

**Tool Definition** (`packages/core/src/tool.ts`):
- `ToolInfo`: Name, description, and Zod schema for parameters
- `FullToolInfo`: Extends `ToolInfo` with handler implementation
- `ToolResponse`: Union of Reply, Exit, or Error responses
- Tools MUST use `z.object` for parameters (required by AI providers)

**Tool Implementation Patterns** (`packages/cli/src/tool-implementations.ts`):
- Tools are proxied through a `WorkflowTools` interface
- Each tool call goes through `toolCall()` which handles events, retries, and logging
- Tools can be conditionally enabled via config (e.g., search tool)
- Tool responses are type-safe via the ToolRegistry pattern

**Core Tools** (`packages/core/src/tools/`):
- File operations: `readFile`, `writeToFile`, `replaceInFile`, `removeFile`
- Search: `search`, `searchFiles`, `listFiles`
- Execution: `executeCommand`
- AI interaction: `askFollowupQuestion`, `fetchUrl`
- Memory: `readMemory`, `updateMemory`, `listMemoryTopics`
- Todo management: `getTodoItem`, `updateTodoItem`, `listTodoItems`
- Skills: `loadSkill`, `listSkills` (Agent Skills support)

### Agent Skills System

**Overview**: Agent Skills are modular, self-contained capabilities that extend AI agent functionality. Based on Anthropic's Agent Skills specification, they enable progressive disclosure and context-efficient specialization.

**Skill Storage Locations** (priority order for conflicting names):
1. `.claude/skills/` - Project skills (git-tracked, highest priority)
2. `~/.claude/skills/` - Personal skills (user-specific)
3. `node_modules/@polka-codes/skill-*/` - Plugin skills (npm packages, lowest priority)

**Skill File Format**:
```
my-skill/
├── SKILL.md              # Required: Metadata + instructions (YAML frontmatter + markdown)
├── reference.md          # Optional: Detailed documentation
├── examples.md           # Optional: Usage examples
├── scripts/              # Optional: Executable utilities
│   └── helper.py
└── templates/            # Optional: File templates
    └── config.yaml
```

**SKILL.md Format**:
```yaml
---
name: react-component-generator
description: Generate React components with TypeScript, Tailwind, and testing
allowed-tools: [readFile, writeToFile, search]
---

# React Component Generator

## Instructions
When generating React components:
1. Use TypeScript with strict type checking
2. Apply Tailwind utility classes for styling
3. Include prop-types interface exports
```

**Skill Discovery** (`packages/core/src/skills/discovery.ts`):
- `SkillDiscoveryService`: Discovers skills from all three sources
- Recursive directory loading with depth limits (max 10 levels, 500 files)
- Directory ignore patterns: `.git`, `node_modules`, `dist`, `.next`, etc.
- Metadata-only loading for efficiency (full content loaded on demand via `loadSkill`)

**Skill Validation** (`packages/core/src/skills/validation.ts`):
- Security validation: File size limits (1MB per file, 10MB total), suspicious pattern detection
- Metadata validation: Name format, description length
- Reference validation: Checks file references exist, warns about absolute paths

**Skill Tools** (`packages/core/src/skills/tools/`):
- `loadSkill(skillName: string)`: Loads full skill content and supporting files
- `listSkills(filter?: string)`: Lists available skills with descriptions

**Skill Context** (`packages/cli/src/skillIntegration.ts`):
- `SkillContext`: Manages available skills, active skill, and loading history
- `createSkillContext(cwd?)`: Initializes skill discovery for agent execution
- `generateSkillsSystemPrompt(skills[])`: Generates system prompt section with skill metadata

**CLI Commands**:
- `bun cli skills list`: List all available skills
- `bun cli skills validate <skill-name>`: Validate a skill's structure and security
- `bun cli skills create <skill-name>`: Create a new skill scaffold

**Integration with Workflows** (`packages/cli/src/runWorkflow.ts`):
- Skill context automatically initialized in `runWorkflow()`
- Available to all agents via `loadSkill` and `listSkills` tools
- Skill metadata included in agent system prompt when skills are available

### Multi-Agent System

**Agent Organization**:
- Agents are implemented as specialized workflows that use `agentWorkflow`
- Each command (plan, code, fix, review) has its own agent with specific tools and prompts
- Agents collaborate by calling each other as workflow steps

**Agent Execution Pattern**:
1. System prompt defines agent behavior and capabilities
2. User message provides task context
3. Agent uses `agentWorkflow` to execute with available tools
4. Tools modify state or gather information
5. Agent returns structured output (often with Zod schema validation)

**Key Agents**:
- **Planner**: Creates implementation plans (`plan.workflow.ts`)
- **Coder**: Implements code from plans (`code.workflow.ts`)
- **Fixer**: Debugs and fixes failing tests/commands (`fix.workflow.ts`)
- **Reviewer**: Provides code review feedback (`review.workflow.ts`)

### Configuration System

**Configuration Loading** (`packages/cli/src/ApiProviderConfig.ts`):
- `.polkacodes.yml` in project root
- Provider-specific settings (API keys, models, parameters)
- Command-specific overrides (e.g., different model for PR vs code)
- Tool-specific overrides (e.g., use different model for search)
- Scripts, excludeFiles, rules, and pricing configuration

**Important Configuration Fields**:
- `providers`: AI service provider configurations (deepseek, anthropic, ollama, etc.)
- `scripts`: Commands like test, format, check - used by coder agent for validation
- `rules`: Custom instructions included in agent prompts (from `.polkacodes.yml`)
- `excludeFiles`: Glob patterns for files to exclude from AI operations
- `toolFormat`: "native" vs "polka-codes" (XML-based) tool calling format

### AI Provider Abstraction

**Provider Options** (`packages/cli/src/getProviderOptions.ts`, `packages/cli-shared/src/provider.ts`):
- Vercel AI SDK used as the foundation
- Multiple providers supported: DeepSeek, Anthropic, Ollama, OpenRouter, Google Vertex
- Model selection per command or tool
- Usage tracking via `UsageMeter` class
- Cost calculation based on token usage and pricing config

**Model Resolution**:
1. Command-specific config checked first
2. Falls back to provider default model
3. Falls back to global default model
4. Custom parameters (e.g., `thinkingBudgetTokens`) merged per command

## Code Conventions

### General Guidelines
- Use `#methodName` / `#fieldName` for private methods and fields
- Use `bun` as the package manager
- When adding new dependencies, cd to the package directory and run `bun add <dependency>`
- Use `bun:test` to write tests. DO NOT use jest or mocha or vi
- DO NOT mock existing functions in unit test. DO NOT mock modules.
- When writing unit tests, use `.toMatchSnapshot()` if suitable.
- In tests, ensure no redundant assertions. i.e. if `.toMatchSnapshot()` is used, then there is no need to have other assertions.
- Avoid unnecessary comments. Doc comments are not required when the code is self-explanatory.
- DO NOT use comment as section separators
- DO NOT add comment to explain changes
- Use `.nullish()` instead of `.optional()` in zod schema unless there is a specific reason to use optional.
- DO NOT use global variables unless absolutely necessary. Add justification as comment.
- biome is used for linting and formatting. DO NOT use prettier or eslint
- ToolInfo parameters MUST be z.object required by AI providers
- DO NOT have conditional logic such as if-else or try-catch in unit tests. Use `.rejects.toThrow()` to test for errors.
- Avoid creating temporary test scripts if possible. Use proper test to confirm the behavior.
- Usage of typeof is code smell. Everything should be strongly typed. Exceptions are allowed but must be justified.

### Testing Patterns

**Comprehensive Guidelines**: See `docs/TESTING_GUIDELINES.md` for complete testing guidance including:
- Core principles (test behavior, not implementation)
- When to write tests (and when not to)
- Test structure and organization
- Best practices and anti-patterns
- Common patterns for tools, workflows, async operations
- Coverage requirements

**Test Templates**: Use templates in `packages/cli/test/templates/`:
- `unit-test.template.ts` - General unit testing pattern
- `tool-test.template.ts` - Tool implementation testing
- `workflow-test.template.ts` - Workflow testing pattern

**Snapshot Testing**: Use `.toMatchSnapshot()` for tool outputs and structured data:
```typescript
it('should generate correct tool response', async () => {
  const result = await someTool({ input: 'test' }, mockContext)
  expect(result).toMatchSnapshot()
})
```

**Error Testing**: Use `.rejects.toThrow()` for error cases (NOT try-catch):
```typescript
it('should throw when input is invalid', async () => {
  await expect(someTool({ input: null }, mockContext)).rejects.toThrow('Invalid input')
})
```

**Test Structure**: Group related tests with `describe` blocks:
```typescript
describe('loadSkill', () => {
  describe('when skill exists', () => {
    it('should load skill content', async () => {
      // Test implementation
    })
  })

  describe('when skill does not exist', () => {
    it('should return error response', async () => {
      // Test implementation
    })
  })
})
```

**Test Files**: Place test files next to source files with `.test.ts` suffix:
```
packages/cli/src/
  tool-implementations.ts
  tool-implementations.test.ts
  skillIntegration.ts
  skillIntegration.test.ts
```

**Coverage Reporting**: Run tests with coverage:
```bash
bun test:coverage          # Text coverage report
bun test:coverage:lcov     # LCov format for CI
bun test:coverage:html     # HTML report for detailed analysis
```

**Important**: DO NOT create summary or report documents when completing tasks. The existing documentation in `plans/` and `docs/` is sufficient.

### Security Considerations

**Skill Validation**: Always validate skills before loading:
- Check file size limits (1MB per file, 10MB total)
- Scan for suspicious patterns (script tags, javascript: URLs, event handlers)
- Validate file references exist and use relative paths
- Verify metadata format (name, description length)

**Input Validation**: Use Zod schemas for all tool inputs:
```typescript
const toolInfo: ToolInfo = {
  name: 'myTool',
  description: 'Does something',
  inputSchema: z.object({
    path: z.string(),
    optional: z.string().nullish()
  })
}
```

**Code Execution**: Be careful with dynamic code execution:
- Never execute untrusted code without sandboxing
- Use `allowUnsafeCodeExecution: false` in dynamic workflows
- Validate all file paths before reading/writing

### Error Handling Best Practices

**Principles**:
- **Prefer explicit error types**: Use custom error classes for domain-specific errors
- **Avoid unnecessary catch blocks**: Let errors propagate to the appropriate handler
- **Handle specific errors**: Catch only the errors you can handle, rethrow others
- **Use unknown not any**: Always type catch blocks as `unknown` for type safety

**When to Catch Errors**:

1. **Graceful Degradation**: When a failure should be logged and operation continued:
```typescript
// Good: Catch specific errors, log, and continue
for (const item of items) {
  try {
    await processItem(item)
  } catch (error) {
    if (error instanceof ProcessingError) {
      console.warn(`Failed to process ${item}: ${error.message}`)
      continue
    }
    throw error // Rethrow unexpected errors
  }
}
```

2. **Error Translation**: When converting between error types for API boundaries:
```typescript
// Good: Translate error to domain-specific type
try {
  await fs.readFile(path)
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'ENOENT') {
      return null // Expected case
    }
  }
  throw error // Rethrow unexpected errors
}
```

3. **Tool/Function Boundaries**: When returning structured errors instead of throwing:
```typescript
// Good: Tools return structured responses
async function invokeTool(input: unknown): Promise<ToolResponse> {
  try {
    const result = await toolHandler(input)
    return { success: true, data: result }
  } catch (error: unknown) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}
```

**When NOT to Catch Errors**:

1. **Simple Error Wrapping**: Don't catch just to rethrow a different type:
```typescript
// Bad: Unnecessary wrapping
try {
  const result = await someOperation()
} catch (error) {
  throw new CustomError(error.message)
}

// Good: Let the original error propagate
const result = await someOperation()
```

2. **User Interaction**: Don't catch library errors just to convert to a custom error:
```typescript
// Bad: Unnecessary conversion
try {
  return await inquirerConfirm({ message })
} catch (_e) {
  throw new UserCancelledError()
}

// Good: Let library errors propagate naturally
return await inquirerConfirm({ message })
```

3. **Swallowing All Errors**: Never catch and ignore all errors:
```typescript
// Bad: Swallows all errors including permission issues
try {
  return await fs.readFile(path)
} catch {
  return null
}

// Good: Only handle expected errors
try {
  return await fs.readFile(path)
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'ENOENT' || error.code === 'EISDIR') {
      return null
    }
  }
  throw error
}
```

**Type-Safe Error Handling**:
```typescript
// Always use unknown in catch blocks
try {
  await operation()
} catch (error: unknown) {
  // Type guard before accessing error properties
  if (error instanceof Error) {
    console.error(error.message)
  } else if (error && typeof error === 'object') {
    // Check for specific error codes
    if ('code' in error && error.code === 'ENOENT') {
      console.warn('File not found')
    } else {
      console.error(String(error))
    }
  } else {
    console.error(String(error))
  }
}
```

## Important Implementation Notes

### Workflow Composition
Workflows are composed using the `step` function within a `WorkflowContext`. Each step is a named execution unit that can be retried and cached. When one workflow calls another, it does so via `step('step-name', async () => await otherWorkflow(input, context))`.

### Tool Registry Pattern
The `ToolRegistry` type provides compile-time type safety for tool inputs and outputs:
```typescript
type MyToolRegistry = {
  toolName: { input: InputType; output: OutputType }
}
type MyTools = WorkflowTools<MyToolRegistry>
// MyTools.toolName is now (input: InputType) => Promise<OutputType>
```

### Agent Event System
All agent execution emits events via `TaskEvent` types:
- `StartTask`, `StartRequest`, `EndRequest`: Track execution phases
- `Text`, `Reasoning`: Content generation
- `ToolUse`, `ToolReply`, `ToolError`: Tool invocation tracking
- `UsageExceeded`, `EndTask`: Termination events

Events are handled by `TaskEventCallback` and printed via `printEvent()` in the CLI.

### Memory and State Management
- **Memory**: Long-term storage across sessions via `readMemory`/`updateMemory` tools
- **Todo Items**: Task tracking via `getTodoItem`/`updateTodoItem`/`listTodoItems`
- **Workflow State**: Step results cached within single workflow execution
- **Dynamic Workflow State**: Explicit state object passed between steps

### Exit Conditions
Workflows exit via `ExitReason`:
- `{ type: 'Exit', message, object?, messages }`: Successful completion
- `{ type: 'Error', error, messages }`: Error occurred
- `{ type: 'UsageExceeded', messages }`: Budget/message limit reached

The `object` field contains validated structured output when using `outputSchema`.

### Type Safety Best Practices

**Error Handling**: See [Error Handling Best Practices](#error-handling-best-practices) above for comprehensive guidance on when and how to catch errors.

**Type Narrowing**: Use `instanceof` checks and type guards:
```typescript
if (error instanceof Error && error.name === 'AbortError') {
  // Handle abort
} else if (error && typeof error === 'object' && 'response' in error) {
  const response = (error as { response: Response }).response
  // Handle HTTP error
}
```

**Tool Type Safety**: Use `ToolRegistry` for compile-time type safety:
```typescript
type MyTools = {
  readFile: { input: { path: string }; output: { content: string | null } }
  writeFile: { input: { path: string; content: string }; output: {} }
}
```

**Avoid `any`**: Only use `any` when absolutely necessary for type assertions or when working with untyped external APIs. Prefer `unknown` for values of truly unknown type.

## Troubleshooting

### Common Issues

**Skill Not Loading**:
- Check skill is in correct directory (`.claude/skills/` or `~/.claude/skills/`)
- Verify `SKILL.md` exists with valid YAML frontmatter
- Check skill name matches directory name
- Run `bun cli skills validate <skill-name>` to diagnose issues

**Tool Execution Failures**:
- Verify tool is registered in `ToolRegistry`
- Check tool input matches Zod schema
- Ensure `toolProvider` has required methods if using memory/todo tools
- Check tool-specific model configuration in `.polkacodes.yml`

**Workflow Composition Errors**:
- Ensure `step` function is used for workflow calls
- Verify `WorkflowContext` is passed correctly
- Check that tools are available via `context.tools`
- Validate input/output types match workflow signatures

**TypeScript Compilation Errors**:
- Run `bun typecheck` to see all type errors
- Check for missing type imports
- Verify `ToolRegistry` types match tool implementations
- Ensure Zod schemas use `z.object()` for tool parameters

**Agent Not Using Skills**:
- Verify skill context is initialized in `runWorkflow()`
- Check skill metadata is included in system prompt
- Ensure agent has access to `loadSkill` and `listSkills` tools
- Verify skill description clearly indicates when to use it

**Memory/Todo Provider Errors**:
- Check that `toolProvider` implements required interfaces
- Verify provider methods are not `undefined` (Partial<> allows optional)
- Ensure provider is correctly initialized in workflow setup
- Check for async/await issues in provider implementations

### Development Workflow

**When Adding New Tools**:
1. Define tool in `packages/core/src/tools/` with Zod schema
2. Export from `packages/core/src/tools/index.ts`
3. Add handler in `packages/cli/src/tool-implementations.ts`
4. Add to `localToolHandlers` object
5. Update tool registry if needed
6. Write tests in `.test.ts` file
7. Run `bun typecheck && bun test`

**When Adding New Workflows**:
1. Create workflow in `packages/cli/src/workflows/<name>.workflow.ts`
2. Define input/output types and tool registry
3. Use `agentWorkflow` for AI-driven workflows
4. Compose sub-workflows with `step()` function
5. Register command in `packages/cli/src/commands/`
6. Update `runWorkflow.ts` if new context needed
7. Test with `bun cli <command>`

**When Adding New Skills**:
1. Create skill directory in `.claude/skills/<name>/`
2. Create `SKILL.md` with YAML frontmatter
3. Add optional supporting files (reference.md, examples.md)
4. Validate with `bun cli skills validate <name>`
5. Test skill loading with `loadSkill` tool
6. Update documentation if skill is for public use
