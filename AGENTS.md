# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Overview

Polka Codes is an AI-powered coding assistant framework built with TypeScript and Bun. It provides a CLI tool that helps developers with epic decomposition, task planning, code generation, debugging, and git workflows through natural language interactions and a multi-agent system.

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
- Each CLI command maps to a workflow (e.g., `epic.workflow.ts`, `code.workflow.ts`)
- Workflows compose together (e.g., `epic` → `plan` → `code` → `fix` → `commit`)
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

### Multi-Agent System

**Agent Organization**:
- Agents are implemented as specialized workflows that use `agentWorkflow`
- Each command (epic, plan, code, fix, review) has its own agent with specific tools and prompts
- Agents collaborate by calling each other as workflow steps

**Agent Execution Pattern**:
1. System prompt defines agent behavior and capabilities
2. User message provides task context
3. Agent uses `agentWorkflow` to execute with available tools
4. Tools modify state or gather information
5. Agent returns structured output (often with Zod schema validation)

**Key Agents**:
- **Epic/Planner**: Breaks down large features into tasks (`epic.workflow.ts`)
- **Code Planner**: Creates implementation plans (`plan.workflow.ts`)
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
- DO NOT have conditional logic such as if-else or try-catch in unit tests. Use .rejects.toThrow() to test for errors.
- Avoid creating temporary test scripts if possible. Use proper test to confirm the behavior.

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
