# AGENTS.md

This file provides guidance to AI agents when working with code in this repository.

## Overview

Polka Codes is an AI-powered coding assistant framework built with TypeScript and Bun. It provides a CLI tool that helps developers with task planning, code generation, debugging, and git workflows through natural language interactions and a multi-agent system.

## Development Commands

### Building
```bash
bun build                 # Build all packages
bun clean                 # Remove build artifacts
```

### Testing
```bash
bun test                  # Run tests
bun test:coverage         # Coverage report (see docs/TESTING_GUIDELINES.md)
```

### Type Checking and Linting
```bash
bun typecheck            # Type check only
bun lint                 # Check linting (biome)
bun fix                  # Auto-fix issues
bun check                # Type check + lint
```

### Running the CLI
```bash
bun cli <command>        # Run CLI in dev mode
bun pr                   # Create PRs
bun commit               # Create commits
```

## Project Architecture

### Monorepo Structure

- **`packages/core`**: AI services, workflow engine, agents, tools
- **`packages/cli`**: CLI interface
- **`packages/cli-shared`**: Shared utilities
- **`packages/github`**: GitHub integration
- **`packages/runner`**: Agent runner service

### Workflow System

**Core Workflow** (`packages/core/src/workflow/workflow.ts`):
- `WorkflowFn<TInput, TOutput, TTools>` - Core workflow type
- `WorkflowContext<TTools>` - Provides `step`, `logger`, `tools`
- `step` function - Named execution units with retry and caching
- `ToolRegistry` - Type-safe tool registry

**Agent Workflow** (`packages/core/src/workflow/agent.workflow.ts`):
- Core agentic execution loop
- Tool calling and message flow
- Retry support and result caching
- JSON output schemas for structured responses

**Dynamic Workflows** (`packages/core/src/workflow/dynamic.ts`):
- YAML-based workflow definitions
- AI-agent-executed steps
- Sub-workflow calls via `runWorkflow`
- State management across steps

### Tool System

**Tool Definition** (`packages/core/src/tool.ts`):
- `ToolInfo`: Name, description, Zod schema
- `FullToolInfo`: Adds handler implementation
- `ToolResponse`: Reply, Exit, or Error
- Parameters MUST use `z.object`

**Core Tools** (`packages/core/src/tools/`):
- File operations: `readFile`, `writeToFile`, `replaceInFile`, `removeFile`
- Search: `search`, `searchFiles`, `listFiles`
- Execution: `executeCommand`
- AI: `askFollowupQuestion`, `fetchUrl`
- Memory: `readMemory`, `updateMemory`, `listMemoryTopics`
- Todo: `getTodoItem`, `updateTodoItem`, `listTodoItems`
- Skills: `loadSkill`, `listSkills`

### Agent Skills System

**Skill Storage** (priority order):
1. `.claude/skills/` - Project skills (git-tracked)
2. `~/.claude/skills/` - Personal skills
3. `node_modules/@polka-codes/skill-*/` - Plugin skills

**SKILL.md Format**:
```yaml
---
name: react-component-generator
description: Generate React components
allowed-tools: [readFile, writeToFile]
---

# React Component Generator
Instructions here...
```

**Skill Commands**:
- `bun cli skills list` - List skills
- `bun cli skills validate <name>` - Validate skill
- `bun cli skills create <name>` - Create skill scaffold

### Configuration

**File**: `.polkacodes.yml` in project root

**Key Fields**:
- `providers`: AI provider configs (API keys, models)
- `scripts`: Test, format, check commands
- `rules`: Custom instructions for agents
- `excludeFiles`: Glob patterns to exclude
- `toolFormat`: "native" or "polka-codes"

### AI Provider Abstraction

**Supported**: DeepSeek, Anthropic, Ollama, OpenRouter, Google Vertex

**Model Resolution**:
1. Command-specific config
2. Provider default
3. Global default

## Code Conventions

### General
- Use `#methodName` / `#fieldName` for private members
- Use `bun` as package manager
- Use `bun:test` for testing (NOT jest, mocha, or vi)
- DO NOT mock in unit tests - use real implementations
- `biome` for linting (NOT prettier or eslint)
- ToolInfo parameters MUST be `z.object`
- Use `.nullish()` instead of `.optional()` in Zod
- Avoid global variables
- Avoid `typeof` - use strong typing

### Testing

**Comprehensive Guidelines**: See `docs/TESTING_GUIDELINES.md` for:
- Core principles and best practices
- When to write tests (and when not to)
- Test structure and organization
- Common patterns for tools, workflows, async operations
- Coverage requirements

**Snapshot Testing**: Use for tool outputs and structured data
```typescript
expect(result).toMatchSnapshot()
```

**Error Testing**: Use `.rejects.toThrow()` (NOT try-catch)
```typescript
await expect(someTool({ input: null })).rejects.toThrow('Invalid input')
```

**Coverage**:
```bash
bun test:coverage          # Text report
bun test:coverage:lcov     # LCov for CI
bun test:coverage:html     # HTML report
```

**Important**: DO NOT create summary documents. Existing docs in `plans/` and `docs/` are sufficient.

### Error Handling

**Principles**:
- Prefer explicit error types
- Let errors propagate to appropriate handler
- Use `unknown` not `any` in catch blocks
- Only catch errors you can handle

**When to Catch**:

1. **Graceful Degradation** (log and continue):
```typescript
for (const item of items) {
  try {
    await processItem(item)
  } catch (error) {
    if (error instanceof ProcessingError) {
      console.warn(`Failed: ${error.message}`)
      continue
    }
    throw error
  }
}
```

2. **Expected Errors** (handle specific cases):
```typescript
try {
  return await fs.readFile(path)
} catch (error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'ENOENT') return null
  }
  throw error
}
```

**When NOT to Catch**:
- Don't wrap just to change error type
- Don't catch just to rethrow
- Don't swallow all errors

### Security

**Skill Validation**:
- File size limits: 1MB per file, 10MB total
- Scan for suspicious patterns (script tags, javascript: URLs)
- Validate file references exist and use relative paths
- Check metadata format

**Input Validation**: Use Zod schemas for all tool inputs

**Code Execution**: Never execute untrusted code without sandboxing

### Type Safety

- Use `instanceof` checks and type guards
- Use `ToolRegistry` for compile-time type safety
- Avoid `any` - prefer `unknown`
- Only use `any` for type assertions with untyped APIs

## Important Implementation Notes

### Workflow Composition

Workflows use `step` function within `WorkflowContext`:
```typescript
step('step-name', async () => await otherWorkflow(input, context))
```

### Tool Registry Pattern

```typescript
type MyToolRegistry = {
  toolName: { input: InputType; output: OutputType }
}
type MyTools = WorkflowTools<MyToolRegistry>
```

### Agent Events

All agent execution emits events via `TaskEvent`:
- `StartTask`, `StartRequest`, `EndRequest` - Phases
- `Text`, `Reasoning` - Content generation
- `ToolUse`, `ToolReply`, `ToolError` - Tool invocation
- `UsageExceeded`, `EndTask` - Termination

### Memory and State

- **Memory**: Long-term via `readMemory`/`updateMemory`
- **Todo Items**: Task tracking
- **Workflow State**: Step result caching
- **Dynamic State**: Explicit state object between steps

### Exit Conditions

- `{ type: 'Exit', message, object?, messages }` - Success
- `{ type: 'Error', error, messages }` - Error
- `{ type: 'UsageExceeded', messages }` - Budget exceeded

## Troubleshooting

**Skill Not Loading**:
- Check correct directory (`.claude/skills/` or `~/.claude/skills/`)
- Verify `SKILL.md` with valid YAML
- Run `bun cli skills validate <name>`

**Tool Failures**:
- Check tool is registered in `ToolRegistry`
- Verify input matches Zod schema
- Ensure `toolProvider` has required methods

**Workflow Errors**:
- Use `step` function for workflow calls
- Verify `WorkflowContext` passed correctly
- Check tools available via `context.tools`

**Type Errors**:
- Run `bun typecheck`
- Check missing type imports
- Verify `ToolRegistry` types match implementations
- Ensure Zod schemas use `z.object()`

## Development Workflow

**Adding Tools**:
1. Define in `packages/core/src/tools/` with Zod schema
2. Export from `packages/core/src/tools/index.ts`
3. Add handler in `packages/cli/src/tool-implementations.ts`
4. Add to `localToolHandlers` object
5. Write tests
6. Run `bun typecheck && bun test`

**Adding Workflows**:
1. Create in `packages/cli/src/workflows/<name>.workflow.ts`
2. Define input/output types and tool registry
3. Use `agentWorkflow` for AI-driven workflows
4. Compose with `step()` function
5. Register command in `packages/cli/src/commands/`
6. Test with `bun cli <command>`

**Adding Skills**:
1. Create `.claude/skills/<name>/SKILL.md`
2. Add YAML frontmatter
3. Add optional files (reference.md, examples.md)
4. Validate with `bun cli skills validate <name>`
5. Test with `loadSkill` tool
