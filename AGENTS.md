# AGENTS.md

Build a complete, polished product using the simplest clear, correct, maintainable implementation that satisfies the actual requirements.

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

## Product quality

- Treat usability and presentation as part of correctness. For substantial user-facing work, understand the primary journey from invocation through completion, including necessary supporting behavior. Complete that journey within scope; neither defer ordinary quality work to a later polish step nor expand into optional features.
- Follow the existing CLI language: Commander commands/help, Inquirer prompts in `packages/cli/src/configPrompt.ts`, and logging/event output in `packages/cli/src/logger.ts` and `packages/cli-shared/src/utils/eventHandler.ts`. Reuse established output and progress patterns; polish means clarity and consistency, not more decoration or spinners.
- Make the primary choice and next step obvious. Use clear labels, predictable controls, sensible defaults, and visible feedback; preserve input and context where appropriate. Avoid redundant prompts, confirmations, controls, and internal workflow details that do not help the user act.
- Make hierarchy, spacing, alignment, content density, and color intentional. Check keyboard selection and cancellation, long paths/messages, narrow terminals, wrapping, and readable output without relying on color alone. Preserve supported noninteractive use, exit status, and stdout/stderr or JSON contracts when improving presentation.
- Handle states the affected feature actually encounters: progress, empty results, invalid input, cancellation, success, and failure. Explain failures with a useful next step; do not invent hypothetical states or elaborate recovery flows.
- If graphical UI is in scope, follow its existing design language or choose a coherent direction from the brief, audience, and references. Check primary-action prominence, typography, responsive layout, overflow/scrolling, semantic controls, keyboard access, and visible focus. Scale these checks to the feature; small changes do not need multiple design proposals.

## Code conventions

- Prefer direct control and data flow, cohesive functions/modules, existing project utilities and platform capabilities, and one authoritative representation of state. Optimize for readability and ease of change, not minimum line count or maximum generality.
- Add abstractions only for demonstrated complexity or a current responsibility/requirement; a single-use helper can improve clarity. Do not add speculative frameworks, service layers, factories, wrapper chains, configuration, feature flags, or compatibility machinery. Simplicity must preserve required behavior and user feedback.
- Use `#field` and `#method()` for private class members.
- Prefer explicit types, generics, `satisfies`, and narrow type guards over `any` or unsafe casts.
- Use `unknown` at untyped boundaries and narrow it immediately. Use `typeof` for primitive or boundary narrowing, not to re-check known static types.
- Avoid mutable global state.
- Use `.optional()` when a field may be omitted and `.nullish()` only when `null` is also meaningful.
- Preserve unrelated worktree changes and avoid unrelated refactors.

## Boundaries and failure handling

- Before adding a nontrivial guard, security boundary, retry, fallback, or compatibility/recovery path, identify the concrete failure, threat, or supported requirement, why existing layers do not handle it, and why the response is proportionate. Consider whether it blocks valid behavior, hides defects, or creates inconsistent state. Omit unjustified mechanisms; this decision does not require a separate document.
- Preserve necessary authentication, authorization, secret protection, and data-integrity enforcement at the layer that controls access or writes. Never execute untrusted code without a sandbox. Do not weaken real safeguards to simplify code or invent restrictions, sanitization, or allowlists without a requirement.
- Validate untrusted inputs with Zod at real entry points, then use the validated, normalized contract internally. Internal modules are not automatically new trust boundaries. Share authoritative rules instead of repeatedly validating the same data, while retaining enforcement where it is needed.
- Retry only credible transient failures when repetition is safe and useful. Bound attempts and account for provider/client retries and workflow `step` retry options. Do not retry validation, permission, or programming errors, or duplicate side effects without a safe design; an isolated need does not justify a retry framework.
- Use fallbacks only for an explicitly acceptable, meaningfully correct degraded result. Never conceal errors as empty data, guessed values, fake success, or silent no-ops. Prefer an honest error; remove obsolete compatibility/fallback branches only when their requirement is demonstrably gone and removal is in scope.
- Let errors propagate unless the current layer can recover, add useful context, clean up resources, or provide a user-facing response. Avoid blanket or repeated catches and catch-only rethrows. Keep expected user errors understandable and programming defects visible; preserve diagnostic causes without exposing secrets.

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
4. Verify the handler and exposed schema together using the checks below.

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

## Verification and completion

- Start with focused `bun test <test-file>` coverage for meaningful behavior or bugs. Prioritize the main workflow and important failure cases; avoid tests that merely mirror implementation or exhaustive hypothetical matrices.
- When changing validation, permissions, limits, or recovery, check both the rejected case and a legitimate end-to-end case. A guard must enforce the actual rule without adding unrequested restrictions.
- Prefer real implementations in unit tests; use focused fixtures or test doubles when external dependencies require isolation.
- Use snapshots for stable structured output, not incidental prose.
- Test rejected promises with `await expect(value).rejects.toThrow(...)`.
- For new tools/workflows and other substantial code changes, follow focused checks with `bun run check` and `bun test`; use `bun run build` when build/package behavior is affected. Repeat affected checks after fixes. Documentation-only edits need reference/command and diff checks, not the application suite.

Coverage formats are available through `test:coverage`, `test:coverage:lcov`, and `test:coverage:html`.

Before finishing substantial changes, perform two distinct reviews:

1. **Product review:** Run or render the actual result with available tools and exercise the primary workflow. For CLI work, use `bun run cli <command>` with realistic content, terminal widths, and affected interactive/noninteractive modes; help output alone does not verify an interaction. For graphical UI, inspect relevant screen sizes, content, and states. Compare against the brief and established conventions, fix concrete usability/visual defects, and preserve successful design decisions.
2. **Simplification review:** Inspect the diff for unnecessary layers/dependencies, duplicated or synchronized state, repeated checks, unsupported branches, and retries/fallbacks that hide defects. Keep the successful path easy to trace and remove complexity introduced by the change; address existing complexity only where directly relevant.

Scale discovery, planning, and review to the task. Ask when an answer materially affects the outcome; otherwise follow repository conventions and proceed with reasonable assumptions. Do not require formal designs, coverage matrices, reviewer agents, or new process files for ordinary work. Do not create task-summary documents.

Finish when the requested journey works end to end, the result has received an appropriate quality review, unnecessary complexity introduced by the task has been removed, and relevant checks are complete. Keep the handoff brief: what changed, what was actually verified, and remaining limitations. If tools or the environment block verification, name the specific gap and distinguish implemented behavior from verified behavior; never imply unperformed tests or UI inspection passed.

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
bun run cli init skill <name>
```
