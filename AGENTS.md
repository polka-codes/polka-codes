# AGENTS.md

## Repository

Polka Codes is a Bun and TypeScript monorepo for an AI coding-assistant CLI.

- `packages/core`: workflows, agents, tools, skills, and shared types
- `packages/cli`: commands, workflow implementations, MCP server, and git integration
- `packages/cli-shared`: configuration, providers, memory, and shared utilities
- `packages/github`: GitHub client integration
- `packages/runner`: remote agent runner

Core workflow contracts live in `packages/core/src/workflow/`:

- `WorkflowFn<TInput, TOutput, TTools>` defines a workflow.
- `BaseWorkflowContext<TTools>` exposes `step`, `logger`, and typed `tools`.
- Wrap workflow work in named `step(...)` calls so retries and caching remain correct.
- Dynamic workflows are YAML-defined and can call sub-workflows through `runWorkflow`.

## Commands

```bash
bun run build             # Build every package
bun run clean             # Remove build artifacts
bun test                  # Run tests
bun run test:coverage     # Run tests with text coverage
bun run typecheck         # Type-check only
bun run lint              # Check Biome formatting and lint rules
bun run fix               # Apply Biome fixes
bun run check             # Type-check and lint
bun run cli <command>     # Run the CLI from source
bun run pr                # Create a pull request
bun run commit            # Create a commit
```

Use `bun` and `bun:test`; do not introduce another package manager, test runner, linter, or formatter.

## Code conventions

- Use `#field` and `#method()` for private class members.
- Prefer explicit types, generics, `satisfies`, and narrow type guards over `any` or unsafe casts.
- Use `unknown` at untyped boundaries and narrow it immediately. Use `typeof` for primitive or boundary narrowing, not to re-check known static types.
- Avoid mutable global state.
- Let errors propagate unless the caller can recover. Catch specific expected failures; never catch only to rethrow or silently swallow an error.
- Validate external inputs with Zod.
- Use `.optional()` when a field may be omitted and `.nullish()` only when `null` is also meaningful.
- Never execute untrusted code without a sandbox.
- Preserve unrelated worktree changes and avoid unrelated refactors.
- Do not create task-summary documents.

## Tool contracts

Tools are defined under `packages/core/src/tools/` and implemented through providers.

- `ToolInfo.parameters` must be a `z.object(...)` schema.
- Keep tool descriptions short and selection-oriented; put argument details on the corresponding schema fields.
- Ensure examples and descriptions match the JSON Schema exposed to models.
- `FullToolInfo` adds the handler to `ToolInfo`.
- Handlers return `ToolResponse` with `success` and a typed `message`.
- Register CLI implementations in `packages/cli/src/tool-implementations.ts`.

When adding a tool:

1. Define and test it in `packages/core/src/tools/`.
2. Export it from `packages/core/src/tools/index.ts`.
3. Add any CLI handler and register it in `localToolHandlers`.
4. Run targeted tests, then `bun run check` and `bun test`.

## Workflow contracts

- Use `agentWorkflow` for model-driven steps and provide a Zod output schema for structured results.
- Compose sub-workflows with `step('name', () => workflow(input, context))`.
- Keep tool registries aligned with handlers so tool inputs and outputs remain compile-time checked.
- Agent runs emit `TaskEvent` lifecycle, content, tool, usage, and termination events.
- Exit reasons are `Exit`, `Error`, or `UsageExceeded`; handle all three explicitly.

When adding a workflow:

1. Create it under `packages/cli/src/workflows/` with explicit input, output, and tool-registry types.
2. Register its command under `packages/cli/src/commands/`.
3. Test it with focused unit coverage and `bun run cli <command>` when practical.

## Testing

- Use real implementations instead of mocks in unit tests.
- Use snapshots for stable structured output, not incidental prose.
- Test rejected promises with `await expect(value).rejects.toThrow(...)`.
- Start with the narrowest relevant test; run `bun run check` and the full suite before handoff when the change warrants it.

Coverage formats are available through `test:coverage`, `test:coverage:lcov`, and `test:coverage:html`.

## Configuration and skills

Project configuration lives in `.polkacodes.yml`. Important fields are `providers`, `scripts`, `rules`, `excludeFiles`, `loadRules`, and `toolFormat`.

Skills are discovered in this order:

1. `.claude/skills/`
2. `~/.claude/skills/`
3. `node_modules/@polka-codes/skill-*/`

Each skill needs a `SKILL.md` with `name`, `description`, optional `allowed-tools`, and its instructions. Use:

```bash
bun run cli skills list
bun run cli skills validate <name>
bun run cli skills create <name>
```
