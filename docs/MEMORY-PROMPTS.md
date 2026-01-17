# Memory Prompts Documentation

This document describes how memory usage is documented in AI agent prompts to help them effectively use the SQLite memory store.

## Overview

The `MEMORY_USAGE_SECTION` in `packages/cli/src/workflows/prompts/shared.ts` provides AI agents with comprehensive instructions on how to use the persistent memory store for tracking todos, bugs, decisions, and notes.

## Key Sections

### 1. Memory Entry Types

Agents are informed about the four main types of memory entries:
- **todo**: Task items with status, priority, and tags
- **bug**: Bug reports with priority and status
- **decision**: Architectural decisions and rationale
- **note**: General notes and documentation

### 2. Todo List Workflow

This section provides practical guidance for managing todos:

**Creating todo items:**
- Use descriptive topic names (e.g., "fix-login-bug" not "bug-1")
- Include full descriptions in the content
- Set appropriate status, priority, and tags

**Updating todos:**
- Mark as done when completed
- Update descriptions as requirements evolve
- Add tags for organization

**Querying todos:**
- Filter by type: "todo"
- Filter by status: "open" or "done"
- Filter by priority: "critical", "high", "medium", "low"
- Search by keyword

### 3. Best Practices

Agents are encouraged to:
- Use descriptive topic names
- Set appropriate priorities
- Add relevant tags (e.g., "auth", "ui", "backend")
- Update status regularly
- Store important decisions in memory
- Remember memory persists across sessions

### 4. Memory Scopes

Agents understand:
- **Project scope**: When in a project directory (with .polkacodes.yml), memory is isolated to that project
- **Global scope**: When outside a project, memory is shared globally

## Usage in Workflows

The `MEMORY_USAGE_SECTION` is included in the following workflow prompts:

### 1. Coder Workflow (`packages/cli/src/workflows/prompts/coder.ts`)
AI agents using the code command can use memory to:
- Track implementation tasks
- Store design decisions
- Remember context across multiple code changes
- Manage bug reports and feature requests

### 2. Fix Workflow (`packages/cli/src/workflows/prompts/fix.ts`)
AI agents using the fix command can use memory to:
- Log bugs discovered during investigation
- Track debugging steps
- Store solutions for future reference
- Mark issues as resolved

### 3. Plan Workflow (`packages/cli/src/workflows/prompts/plan.ts`)
AI agents using the plan command can use memory to:
- Track planning tasks
- Store architectural decisions
- Maintain context across planning sessions
- Record requirements and constraints

## Example Usage

### Creating a Todo

When an AI agent needs to track a task, it can create a memory entry:

```typescript
// In the agent's internal context
await store.updateMemory('replace', 'implement-auth-flow', 'Add OAuth2 authentication flow with Google and GitHub providers', {
  entry_type: 'todo',
  status: 'open',
  priority: 'high',
  tags: 'auth,feature'
})
```

### Updating Todo Status

When completing a task:

```typescript
await store.updateMemory('replace', 'implement-auth-flow', 'OAuth2 authentication flow completed. Added support for Google and GitHub providers with proper token management.', {
  entry_type: 'todo',
  status: 'done',
  priority: 'high',
  tags: 'auth,feature'
})
```

### Querying Open Todos

To see what tasks remain:

```typescript
const openTodos = await store.queryMemory({
  type: 'todo',
  status: 'open'
}, { operation: 'select' })
```

## Benefits

1. **Context Persistence**: Agents remember decisions and context across sessions
2. **Task Tracking**: Agents can track progress on multi-step tasks
3. **Knowledge Management**: Important decisions and solutions are stored for future reference
4. **Project Organization**: Memory is scoped per project, keeping context organized
5. **Collaboration**: Multiple agents can share context through the shared memory store

## Future Enhancements

Potential improvements to memory prompts:
- Add examples of using memory for decision logging
- Include patterns for bug tracking workflows
- Document how to use tags for cross-referencing
- Add guidance on memory cleanup and maintenance
- Include examples of memory-driven workflows

## Related Documentation

- [Memory Management Guide](./memory.md) - User-facing documentation for memory commands
- [Implementation Summary](./IMPLEMENTATION-SUMMARY.md) - Technical details of the memory store implementation
- [CLI Commands Reference](../packages/cli/README.md) - CLI command documentation
