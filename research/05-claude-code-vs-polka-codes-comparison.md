# Claude Code vs Polka Codes: Detailed Comparison Document

**Date**: January 2026
**Research Version**: Based on Claude Code v2.0.76 - v2.1.3 and Polka Codes v0.9.88
**Purpose**: Comprehensive architectural comparison to inform Polka Codes development

---

## Executive Summary

**Philosophy Alignment**: Both systems embrace "simplicity first" - letting AI models do the work with minimal business logic. However, they differ significantly in implementation approach.

**Key Differences**:
- **Stack**: Claude Code uses React/Ink for terminal UI; Polka Codes uses pure CLI (Commander.js)
- **Type Safety**: Polka Codes emphasizes compile-time type safety with Zod; Claude Code relies on runtime validation
- **Extensibility**: Both support MCP, but Polka Codes has richer extensibility (Skills, Dynamic Workflows, Scripts)
- **Architecture**: Claude Code is lightweight shell (~90% self-written); Polka Codes is modular monorepo with specialized packages
- **Agent System**: Polka Codes has more sophisticated autonomous agent with goal decomposition and approval workflows

---

## Table of Contents

1. [Architecture & Design Philosophy](#1-architecture--design-philosophy)
2. [Tech Stack Comparison](#2-tech-stack-comparison)
3. [Tools System](#3-tools-system)
4. [System Prompts](#4-system-prompts)
5. [Context Management](#5-context-management)
6. [Subagent System](#6-subagent-system)
7. [MCP Integration](#7-mcp-integration)
8. [Configuration System](#8-configuration-system)
9. [Permissions & Security](#9-permissions--security)
10. [UI/Interface](#10-uiinterface)
11. [Development Practices](#11-development-practices)
12. [Feature Matrix](#12-feature-matrix)
13. [Recommendations for Polka Codes](#13-recommendations-for-polka-codes)

---

## 1. Architecture & Design Philosophy

### 1.1 Core Philosophy

| Aspect | Claude Code | Polka Codes |
|--------|-------------|-------------|
| **Design Principle** | "Simplicity First" - lightweight shell around Claude model | Type-safe, modular architecture with extensibility |
| **Self-Building** | ~90% of Claude Code is written by Claude Code | Built incrementally with human oversight |
| **Code Deletion** | Every model release deletes code (~50% removed with Claude 4.0) | Not observed; evolving architecture |
| **Model Rawness** | "Feel the model as raw as possible" | More structured, with explicit workflows |
| **Business Logic** | Minimal - lets model do most work | More structured - workflow-based orchestration |

### 1.2 Code Organization

**Claude Code**:
- **Monolithic**: Single bundled `cli.js` (10.5MB)
- **Self-contained**: Includes Node.js code, ripgrep binaries, tree-sitter WASM, resvg WASM
- **No package separation**: All logic in one bundle
- **Compiled**: Minified JavaScript bundle

**Polka Codes**:
- **Monorepo**: Bun workspaces with 5 packages
  - `core/` - AI services, workflow engine, agents, tools
  - `cli/` - Command-line interface
  - `cli-shared/` - Shared utilities and types
  - `github/` - GitHub integration
  - `runner/` - Agent execution service
- **Modular**: Clear separation of concerns
- **Type-safe**: TypeScript strict mode throughout
- **Testable**: 800+ tests with `bun:test`

### 1.3 Architectural Patterns

**Claude Code**:
- **Tool-first**: Everything is a tool, even subagents
- **Dynamic**: Tool calls drive all interactions
- **Minimal orchestration**: System prompt + tool descriptions, let model figure it out
- **Subagent spawning**: Task tool launches specialized agents with full context

**Polka Codes**:
- **Workflow-first**: Structured workflows orchestrate AI interactions
- **Type-safe registry**: Compile-time validated tool signatures
- **Explicit orchestration**: Workflows define phases, steps, and control flow
- **Agent loops**: `agentWorkflow` provides request-response loop with tool calling

### 1.4 Deployment Model

| Aspect | Claude Code | Polka Codes |
|--------|-------------|-------------|
| **Distribution** | Single binary bundle (via npm) | npm packages (core, cli, etc.) |
| **Installation** | `npm install -g @anthropic-ai/claude-code` | `npm install -g @polka-codes/cli` |
| **Dependencies** | Bundled (ripgrep, WASM modules) | External dependencies (Bun runtime) |
| **Updates** | Daily releases | Regular releases (versioned) |

---

## 2. Tech Stack Comparison

### 2.1 Core Technologies

| Component | Claude Code | Polka Codes | Notes |
|-----------|-------------|-------------|-------|
| **Language** | TypeScript | TypeScript | Both use TS strict mode |
| **Build System** | Bun (speed) | Bun (package manager) + tsup (bundling) | Both use Bun |
| **UI Framework** | React with Ink (terminal UI) | Commander.js (pure CLI) | **Key difference** |
| **Layout System** | Yoga (Meta's layout engine) | N/A (CLI only) | Claude Code has rich TUI |
| **Package Manager** | npm | Bun workspaces | Polka uses monorepo |
| **Testing** | Not publicly documented | bun:test (800+ tests) | Polka has visible test suite |
| **Linting** | Not publicly documented | Biome (ESLint/Prettier replacement) | Modern tooling |

### 2.2 AI Provider Support

| Provider | Claude Code | Polka Codes |
|----------|-------------|-------------|
| **Anthropic** | ✅ Native (primary) | ✅ Via Vercel AI SDK |
| **OpenAI** | ❌ No | ✅ Via Vercel AI SDK |
| **Google** | ❌ No | ✅ Via Vercel AI SDK |
| **Ollama** | ❌ No | ✅ Via Vercel AI SDK (local models) |
| **Others** | ❌ No | ✅ Any Vercel AI SDK provider |

**Key Insight**: Claude Code is Anthropic-only; Polka Codes is provider-agnostic.

### 2.3 Dependencies

**Claude Code Bundled Dependencies**:
- ripgrep (platform-specific binaries)
- tree-sitter WASM (code parsing)
- resvg WASM (SVG rendering)

**Polka Code Key Dependencies**:
- `@ai-sdk/provider` (Vercel AI SDK abstraction)
- `zod` (schema validation)
- `commander` (CLI framework)
- `inquirer` (interactive prompts)
- `@modelcontextprotocol/sdk` (MCP support)
- `lodash-es` (utilities)

---

## 3. Tools System

### 3.1 Tool Definition Pattern

**Claude Code**:
```typescript
// From system prompt (reverse engineered)
{
  name: "Read"
  description: "Read files from local filesystem..."
  parameters: {
    type: "object",
    properties: {
      file_path: { type: "string" },
      offset: { type: "number" },
      limit: { type: "number" }
    }
  }
}
```
- JSON Schema format
- Runtime validation
- ~10,000 tokens of descriptions
- Directly embedded in system prompt

**Polka Codes**:
```typescript
// From packages/core/src/tool.ts
export type ToolInfo = {
  name: string
  description: string
  parameters: z.ZodObject<any>  // MUST be Zod object
}

export type FullToolInfo = ToolInfo & {
  handler: ToolHandler<ToolInfo, any>
}
```
- Zod schema for type safety
- Compile-time validation
- Typed tool registry
- Handlers separate from definitions

### 3.2 Tool Registry & Type Safety

**Claude Code**:
- No explicit registry
- Tools defined in system prompt
- Model selects tools by name
- No compile-time guarantees

**Polka Codes**:
```typescript
// Compile-time type-safe tool registry
type ToolRegistry = Record<string, ToolSignature<any, any>>

type MyTools = WorkflowTools<MyToolRegistry>
// Tools are typed: (input: InputType) => Promise<OutputType>
```
- Type-safe tool mapping
- Compile-time validation of tool signatures
- Autocomplete support
- Runtime Zod validation

### 3.3 Core Tools Comparison

| Category | Claude Code | Polka Codes | Parity |
|----------|-------------|-------------|--------|
| **File Read** | `Read` (439 tokens) | `readFile` | ✅ Similar |
| **File Write** | `Write` (159 tokens) | `writeToFile` | ✅ Similar |
| **File Edit** | `Edit` (278 tokens) | `replaceInFile` | ✅ Similar |
| **File Delete** | ❌ No | `removeFile` | ⚠️ Polka has it |
| **File Rename** | ❌ No | `renameFile` | ⚠️ Polka has it |
| **Binary Read** | ✅ Yes (in Read) | `readBinaryFile` | ✅ Similar |
| **File List** | `Glob` (122 tokens) | `listFiles` | ✅ Similar |
| **Content Search** | `Grep` (300 tokens) | `search` | ✅ Similar |
| **File Search** | `Glob` (pattern-based) | `searchFiles` | ✅ Similar |
| **Shell Execute** | `Bash` (1,125 tokens) | `executeCommand` | ✅ Similar |
| **Git Diff** | In Bash tool | `gitDiff` (dedicated) | ⚠️ Polka has dedicated |
| **User Input** | `AskUserQuestion` (194 tokens) | `askFollowupQuestion` | ✅ Similar |
| **Text Input** | ❌ No | `input` | ⚠️ Polka has it |
| **Confirm** | ❌ No | `confirm` | ⚠️ Polka has it |
| **Select** | ❌ No | `select` | ⚠️ Polka has it |
| **Web Fetch** | `WebFetch` (265 tokens) | `fetchUrl` | ✅ Similar |
| **Web Search** | `WebSearch` (334 tokens) | ❌ No | ⚠️ Claude has it |
| **Todos** | `TodoWrite` (2,167 tokens) | `getTodoItem`, `updateTodoItem`, `listTodoItems` | ⚠️ Different approaches |
| **Memory** | ❌ No | `readMemory`, `updateMemory`, `listMemoryTopics` | ⚠️ Polka has it |
| **Skills** | `Skill` (444 tokens) | `loadSkill`, `listSkills` | ✅ Both have |
| **Notebook Edit** | `NotebookEdit` (121 tokens) | ❌ No | ⚠️ Claude has it |
| **LSP** | `LSP` (255 tokens) | ❌ No | ⚠️ Claude has it |
| **Computer** | `Computer` (161 tokens) | ❌ No | ⚠️ Claude has it |

**Summary**:
- **Claude Code**: 20+ built-in tools, ~10,000 tokens of descriptions
- **Polka Codes**: 25+ tools, smaller descriptions (not counted)
- **Key differences**:
  - Claude has WebSearch, NotebookEdit, LSP, Computer
  - Polka has Memory, dedicated Git tools, interactive prompts (input/confirm/select)
  - Both have similar file operations and search capabilities

### 3.4 Tool Usage Patterns

**Claude Code**:
```typescript
// System prompt instructions
- Use Task tool for complex, multi-step tasks
- Use Explore agent for codebase exploration
- Use Bash only for terminal operations
- Use specialized tools instead of bash when available
- Maximize parallel tool calls
```

**Polka Codes**:
```typescript
// From workflow implementations
- Tools called via context.tools.toolName()
- Proxy pattern for logging and MCP integration
- Step pattern for workflow composition
- Type-safe tool calls with compile-time checking
```

### 3.5 Specialized Tools

**Claude Code Unique Tools**:
- `TodoWrite`: Largest tool description (2,167 tokens), critical for task tracking
- `Task`: Spawns subagents (1,227 tokens)
- `EnterPlanMode`/`ExitPlanMode`: Planning workflow (970 + 447 tokens)
- `Bash` with git: Embedded git workflow (2,651 tokens total)
- `WebSearch`: Web search with sources requirement
- `LSP`: IDE diagnostics integration
- `Computer`: Browser automation

**Polka Codes Unique Tools**:
- `Memory` tools: Long-term storage across sessions
- `Todo` tools: Granular task management (get/update/list)
- `Git` tools: Dedicated `gitDiff` tool
- `Interactive` tools: `input`, `confirm`, `select` for CLI prompts
- `Skills` tools: `loadSkill`, `listSkills` for extensibility

### 3.6 Tool Execution Flow

**Claude Code**:
```
User Request → Model selects tools → Tool Call → Result → Context Update → Repeat
```
- Model-driven tool selection
- Direct tool execution
- Minimal orchestration

**Polka Codes**:
```
User Request → Workflow → context.tools.toolName()
  → ToolCall Proxy → toolCall()
    → Handler Execution → ToolResponse
      → Event Emission → Result Return
```
- Workflow-driven tool selection
- Proxy pattern for logging
- Event emission for observability
- MCP integration at proxy layer

---

## 4. System Prompts

### 4.1 Prompt Structure

**Claude Code**:
- **40+ separate prompt strings**
- Conditionally assembled based on environment
- ~15,000-20,000 tokens per request total
- Main system prompt: ~2,852 tokens
- Tool descriptions: ~9,400 tokens
- Subagent prompts: ~1,572 tokens

**Polka Codes**:
- **Modular prompt files** in `packages/cli/src/workflows/prompts/`
- Shared prompts + agent-specific prompts
- Dynamic construction with:
  - Base prompt
  - Additional instructions
  - Skills metadata
  - Rules section
  - Memory context
- Token count not publicly measured

### 4.2 Prompt Components

**Claude Code**:
| Component | Tokens | Purpose |
|-----------|--------|---------|
| Main system prompt | 2,852 | Core behavior, tone, tool policies |
| Tool descriptions | 9,400 | 20+ tool definitions |
| Subagent prompts | 1,572 | Explore, Plan, Task agents |
| Utility prompts | 8,000+ | Summarization, creation assistants |
| CLAUDE.md | 1,000-2,000 | Per-project configuration |
| **Total** | ~15,000-20,000 | |

**Polka Codes**:
| Component | Location | Purpose |
|-----------|----------|---------|
| Shared prompts | `prompts/shared.ts` | Memory, tools, agents, JSON format |
| Agent prompts | `prompts/{agent}.ts` | Coder, Plan, Fix, Review, Commit, PR, Init, Meta |
| Custom rules | Config (strings/files/URLs) | User-defined instructions |
| Skills metadata | Skills system | Agent capabilities |
| Memory context | `.polka/memory/*.md` | Long-term storage |
| AGENTS.md | Project directories | Project-specific guidelines |

### 4.3 Subagent Prompts

**Claude Code**:
| Agent | Tokens | Purpose |
|-------|--------|---------|
| Explore | 516 | Fast codebase exploration |
| Plan | 633 enhanced | Implementation planning |
| Task | 294 | General task execution |
| Agent Creation Architect | 1,110 | Creates custom agents |
| CLAUDE.md Creation | 384 | Project documentation |
| Status Line Setup | 1,350 | Status line configuration |

**Polka Codes**:
| Agent | Lines | Purpose |
|-------|-------|---------|
| Coder | ~83 | Implement from plans (similar to Claude's Task) |
| Plan | ~212 | Create implementation plans (similar to Claude's Plan) |
| Fix | Not provided | Debug failing tests |
| Review | Not provided | Code review |
| Commit | Not provided | Generate commit messages |
| PR | Not provided | Create PRs |
| Init | Not provided | Initialize projects |
| Meta | Not provided | Meta-task routing |

**Key Difference**: Claude Code has more specialized creation assistants; Polka Codes focuses on core development workflows.

### 4.4 Dynamic Prompt Construction

**Claude Code**:
```typescript
// Reverse-engineered from research
const systemPrompt = BASE_PROMPT +
  (gitStatus ? GIT_STATUS_REMINDER : '') +
  (chromeMCP ? CHROME_MCP_TOOLS : '') +
  (learningMode ? LEARNING_MODE_INSIGHTS : '') +
  TOOL_DESCRIPTIONS +
  SUBAGENT_PROMPTS +
  CLAUDE_MD_CONTENT
```
- Environment-aware assembly
- Conditional inclusions
- No visible code examples (compiled bundle)

**Polka Codes**:
```typescript
// From workflow implementations
const systemPrompt = CODER_SYSTEM_PROMPT +
  ADDITIONAL_INSTRUCTIONS +
  SKILLS_SECTION +
  RULES_SECTION +
  MEMORY_CONTEXT
```
- Explicit composition
- Visible in source code
- Easier to customize

### 4.5 Project Configuration (CLAUDE.md vs AGENTS.md)

**Claude Code - CLAUDE.md**:
- Auto-loaded from root/parent/home directories
- Check into git (team-shared)
- `.local` variant for personal use
- Best practices:
  - Common bash commands
  - Core files and utilities
  - Code style guidelines
  - Testing instructions
  - Repository etiquette
  - Developer environment setup
  - Unexpected behaviors

**Polka Codes - AGENTS.md**:
- Loaded from subdirectories or parents
- Project-specific guidelines
- Referenced in agent prompts
- Similar purpose to CLAUDE.md
- Less documented (emerging feature)

### 4.6 Prompt Evolution

**Claude Code**:
- Tracked across 62+ versions
- **Key trend**: Every model release deletes code
- Claude 4.0: Removed ~50% of system prompt
- Constant minimization
- Extracted from minified bundle

**Polka Codes**:
- Evolving with releases
- No documented "deletion" philosophy
- Growing feature set (Skills, MCP, Dynamic Workflows)
- Visible in source code (easier to study)

---

## 5. Context Management

### 5.1 Token System

**Claude Code**:
- **200K token window** (Sonnet)
- **Practical usage**: ~15,000 tokens (7%)
- **Token counting**: Automatic
- **Cost tracking**: Not publicly documented

**Polka Codes**:
- **Provider-dependent** (200K for Anthropic, varies by provider)
- **Message limit**: `maxMessageCount` (default: 50)
- **Summarization threshold**: `summaryThreshold` (default: 20)
- **Usage metering**: `UsageMeter` class tracks tokens/cost
- **Budget tracking**: Per-model pricing, cost limits

### 5.2 Context Window Strategy

**Claude Code**:
```typescript
// Reverse-engineered behavior
- Automatic context gathering from:
  - Files mentioned in prompts
  - CLAUDE.md files
  - Git status and recent history
  - Project structure
- Summarization when approaching limit
- No explicit user controls
```

**Polka Codes**:
```typescript
// From packages/core/src/UsageMeter.ts
class UsageMeter {
  trackUsage(inputTokens, outputTokens, cacheReads, cacheWrites)
  getUsageText() // Formatted usage report

  // Limits
  maxMessages?: number
  maxCost?: number
}
```
- Explicit message count limit
- Automatic truncation of oldest messages
- Cost tracking per operation
- Budget enforcement

### 5.3 Memory System

**Claude Code**:
- **No explicit memory system**
- Context accumulates in conversation
- Summarization when needed
- CLAUDE.md for persistent context

**Polka Codes**:
```typescript
// File-based memory system
- Storage: `.polka/memory/{topic}.md`
- Operations: read, append, overwrite
- Topics: Organized by domain
- Agent access: `readMemory`/`updateMemory` tools
- Context injection: Automatic in agent prompts
- Topics include:
  - `implementation-summary`
  - `project-context`
  - Custom topics
```

**Key Difference**: Polka Codes has explicit, structured memory system; Claude Code relies on conversation context.

### 5.4 Best Practices

**Claude Code** (from research):
- Prioritize conciseness
- Reuse context strategically
- Break tasks into smaller interactions
- Clear clutter proactively (`/clear`)
- Use `/context status`, `/context summary`, `/context clear`
- Structured submission: Objective, Context, Constraints, Outcome
- Periodic summarization
- Prune unnecessary messages
- Emphasize essentials

**Polka Codes**:
- Similar principles (learned from Claude Code)
- Memory system for persistent context
- Budget tracking for cost control
- Message limits for context management
- No `/context` commands (managed automatically)

### 5.5 Context Management Commands

**Claude Code**:
```bash
/context status     # View current token usage
/context summary    # Condense long threads
/context clear      # Reset context window
/clear              # Reset context window
```

**Polka Codes**:
```bash
# No explicit context commands
# Managed automatically via:
- maxMessageCount
- summaryThreshold
- Memory system
- Budget limits
```

---

## 6. Subagent System

### 6.1 Agent Architecture

**Claude Code**:
- **Task tool** spawns subagents (1,227 tokens)
- Full conversation history access
- Specialized agent types:
  - Explore (516 tokens)
  - Plan (633 tokens enhanced)
  - General-purpose (varies)
  - Creation assistants (1,110 tokens)
- Parallel agent execution
- Background agents with output files
- Resume with agent ID

**Polka Codes**:
- **AutonomousAgent** class (538 lines)
- Components:
  - `StateManager`: State persistence
  - `TaskHistory`: Execution tracking
  - `GoalDecomposer`: Break down goals
  - `TaskPlanner`: Prioritize and schedule
  - `TaskExecutor`: Execute tasks
  - `ApprovalManager`: User approvals
  - `SafetyChecker`: Destructive operation checks
  - `WorkingSpace`: Plan/task documentation

### 6.2 Specialized Agents

**Claude Code**:
| Agent | Purpose | Tokens |
|-------|---------|--------|
| Explore | Fast codebase exploration | 516 |
| Plan | Implementation planning | 633 |
| Task | General execution | 294 |
| Agent Creation Architect | Create custom agents | 1,110 |
| CLAUDE.md Creation | Project documentation | 384 |
| Status Line Setup | Configure status line | 1,350 |

**Polka Codes**:
| Agent | Purpose | Lines |
|-------|---------|-------|
| Planner | Create implementation plans | ~212 |
| Coder | Implement from plans | ~83 |
| Fixer | Debug failing tests | Not measured |
| Reviewer | Review PRs/changes | Not measured |
| Committer | Generate commits | Not measured |
| PR Creator | Create PRs via gh CLI | Not measured |
| Meta | Route meta-tasks | Not measured |

### 6.3 Autonomous Agent System

**Claude Code**:
- Not documented in research
- Subagents spawned via Task tool
- No autonomous orchestration
- User-driven agent spawning

**Polka Codes**:
```typescript
// Sophisticated autonomous agent
class AutonomousAgent {
  // Modes
  - goal-directed: Achieve specific user goal
  - continuous-improvement: Auto-discover and fix issues

  // Configuration
  agent:
    preset: "balanced"  # conservative | balanced | aggressive
    strategy: "goal-directed"
    maxIterations: 10
    requireApprovalFor: "destructive"  # none | destructive | commits | all
    autoApproveSafeTasks: true
    pauseOnError: true
    workingBranch: "polka-agent"
    workingDir: "./tasks"  # Monitor for plans

  // Task Discovery
  - Build errors
  - Failing tests
  - Type errors
  - Lint issues
  - Working directory plans
}
```

**Key Difference**: Polka Codes has sophisticated autonomous agent with goal decomposition; Claude Code relies on user-driven subagent spawning.

### 6.4 Task Discovery

**Claude Code**:
- Manual task specification
- User invokes agents explicitly
- No automatic task discovery

**Polka Codes**:
- Automatic task discovery:
  - Build errors
  - Failing tests
  - Type errors
  - Lint issues
  - Plans in working directory
- Continuous improvement mode
- Goal-directed mode

### 6.5 Approval System

**Claude Code**:
- Tool-level permissions
- User approval for tools
- Plan mode approval
- No autonomous agent approval

**Polka Codes**:
```typescript
// Multi-level approval system
requireApprovalFor:
  - none: Auto-approve all
  - destructive: Approve destructive ops only
  - commits: Approve commits and destructive
  - all: Approve everything

autoApproveSafeTasks:
  - Cost-based thresholds
  - Safety checks

pauseOnError:
  - Stop on unexpected failures
```

---

## 7. MCP Integration

### 7.1 MCP as Client

**Claude Code**:
```yaml
# Configuration
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    tools:
      read_file: true
      write_file: true

# Configuration locations
- Project: .claude/config.json
- Global: ~/.claude/config.json
- Repository: .mcp.json (sharable)
```
- ✅ Stdio transport
- ✅ Multiple server connections
- ✅ Tool discovery
- ✅ Error handling

**Polka Codes**:
```yaml
# Configuration
mcpServers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    tools:
      read_file: true
      write_file: true

# Implementation
class McpManager {
  async connectToServers(servers: Record<string, McpServerConfig>)
  async callTool(fullToolName: string, args: Record<string, unknown>)
  getFullToolInfos(): FullToolInfo[]
}
```
- ✅ Stdio transport
- ✅ Multiple server connections
- ✅ JSON Schema → Zod conversion
- ✅ Automatic tool discovery
- ✅ Error handling and reconnection
- ⏳ SSE transport (planned)
- ⏳ Resource protocol (planned)

**Parity**: Both have similar MCP client capabilities. Polka Codes has Zod integration for type safety.

### 7.2 MCP as Server

**Claude Code**:
- **Not documented** in research
- May exist but not publicly discussed

**Polka Codes**:
```bash
# Exposes workflows as MCP tools
polka mcp-server

# Tools exposed:
- code: Execute coding tasks
- review: Review code changes
- plan: Create implementation plans
- fix: Fix bugs and issues
- commit: Generate commit messages

# Claude Desktop configuration
{
  "mcpServers": {
    "polka": {
      "command": "polka",
      "args": ["mcp-server"]
    }
  }
}
```

**Key Difference**: Polka Codes explicitly implements MCP server mode; Claude Code's support is not documented.

---

## 8. Configuration System

### 8.1 Configuration Loading

**Claude Code**:
```bash
# Multi-tiered system
- Per-project: .claude/settings.json
- Per-user: ~/.claude.json
- Per-company: Sharable across teams
- Static analysis for permissions
- User can: allow once, allow always, reject
```

**Polka Codes**:
```bash
# Priority order
1. Global: ~/.config/polkacodes/config.yml
2. Project: ./.polkacodes.yml
3. CLI flags: --config <path> (highest)

# Merge strategy
- Deep merge with lodash
- Arrays concatenated (rules, excludeFiles)
- Later configs override earlier
```

**Parity**: Both have multi-tiered configuration. Claude Code focuses on permissions; Polka Codes on general settings.

### 8.2 Configuration Schema

**Claude Code** (reverse-engineered):
```json
{
  "permissions": {
    "allowedTools": ["Edit", "Bash(git commit:*)"],
    "allowlistedCommands": ["npm test"]
  },
  "mcpServers": { ... },
  "projectSettings": { ... }
}
```
- Permissions-focused
- Tool allowlisting
- Command whitelisting

**Polka Codes**:
```yaml
# AI Providers
providers:
  anthropic:
    apiKey: "sk-ant-..."
    defaultModel: "claude-sonnet-4-5-20250929"

defaultProvider: "anthropic"
defaultModel: "claude-sonnet-4-5-20250929"

# Request Settings
retryCount: 3
requestTimeoutSeconds: 120
maxMessageCount: 50
summaryThreshold: 20

# Budget
budget: 10.0

# Custom Scripts
scripts:
  test: "bun test"
  build:
    command: "bun run build"
    description: "Build for production"

# Command-Specific Overrides
commands:
  code:
    provider: "ollama"
    model: "qwen2.5-coder:7b"

# Tool-Specific Overrides
tools:
  search:
    provider: "google-vertex"

# Custom Rules
rules:
  - "Use TypeScript for all new code"
  - path: "docs/contributing.md"
  - url: "https://example.com/standards.md"
  - repo: "polka-codes/polka"
    path: "rules/security.md"
    branch: "main"

# MCP Servers
mcpServers:
  filesystem:
    command: "npx"
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]

# Autonomous Agent
agent:
  preset: "balanced"
  strategy: "goal-directed"
  requireApprovalFor: "destructive"
  workingDir: "./tasks"

# Pricing
prices:
  anthropic:
    "claude-sonnet-4-5-20250929":
      inputPrice: 3.0
      outputPrice: 15.0

# File Exclusions
excludeFiles:
  - "node_modules/**"
  - ".env"
```

**Key Difference**: Polka Codes has much richer configuration (providers, commands, tools, rules, agent, pricing); Claude Code is simpler with focus on permissions.

### 8.3 Custom Rules

**Claude Code**:
- CLAUDE.md for project-specific rules
- No explicit "rules" array
- Text-based guidelines

**Polka Codes**:
```yaml
rules:
  - "Use TypeScript for all new code"
  - path: "docs/contributing.md"
  - url: "https://example.com/standards.md"
  - repo: "polka-codes/polka"
    path: "rules/security.md"
    branch: "main"
```
- Strings (direct inclusion)
- Files (local paths)
- URLs (fetch with 30s timeout)
- GitHub repos (fetch from raw.githubusercontent.com)
- Concatenated and injected into prompts

**Key Difference**: Polka Codes has structured rules system with multiple source types; Claude Code uses CLAUDE.md.

---

## 9. Permissions & Security

### 9.1 Permission Model

**Claude Code**:
```typescript
// Multi-tiered allowlist
- Per-project settings (.claude/settings.json)
- Per-user settings (~/.claude.json)
- Per-company settings (sharable)
- Static analysis of commands
- User choices:
  - Allow once
  - Allow for all sessions
  - Reject

// Example allowlisted tools
- Edit (file edits)
- Bash(git commit:*) (git commits)
- mcp__puppeteer__puppeteer_navigate (browser navigation)
```
- **Pre-execution static analysis**
- **No virtualization** (runs locally)
- **Permission-centric security**
- **Tool allowlisting**
- **Command whitelisting**

**Polka Codes**:
```yaml
# Script permissions (advisory - future sandboxing)
scripts:
  risky-script:
    script: .polka-scripts/risky.ts
    permissions:
      fs: write        # read | write | none
      network: true     # true | false
      subprocess: true  # true | false
    timeout: 60000      # Execution timeout (ms)
    memory: 512         # Memory limit (MB, 64-8192)

# Current status
- ✅ Permission declarations in config
- ✅ Validation of permission values
- ⚠️ Scripts run in-process with full permissions (not sandboxed)
- ⏳ Future: Runtime sandbox enforcement

# Autonomous agent safety
agent:
  requireApprovalFor: "destructive"  # none | destructive | commits | all
  autoApproveSafeTasks: true
  pauseOnError: true
  workingBranch: "polka-agent"

# File exclusions
excludeFiles:
  - "node_modules/**"
  - ".env"
  - "*.pem"
  - "*.key"

# Skill validation
- File size limits (1MB per file, 10MB total)
- Suspicious pattern detection
- Path validation (relative preferred)
- Reference checking
```

**Key Difference**:
- Claude Code: Runtime permission enforcement with static analysis
- Polka Codes: Advisory permissions with autonomous agent safety; future sandboxing planned

### 9.2 Safety Mechanisms

**Claude Code**:
- Static analysis before execution
- Tool allowlisting
- User approval workflows
- No virtualization (security trade-off)
- Multi-tier settings system

**Polka Codes**:
- Autonomous agent approval levels
- Destructive operation detection
- Auto-approval limits (cost-based)
- Pause on error
- Working branch isolation
- File exclusions
- Skill validation
- **Future**: Runtime sandboxing

### 9.3 Security Philosophy

**Claude Code**:
> "Instead of virtualization, Claude Code uses:
> - Pre-execution static analysis
> - Multi-tier settings system
> - Granular tool allowlisting
> - User approval workflows"

**Polka Codes**:
> "Advisory permissions with safety checks:
> - Autonomous agent approval system
> - File exclusions
> - Skill validation
> - Future: Runtime sandbox enforcement"

---

## 10. UI/Interface

### 10.1 Interface Type

**Claude Code**:
- **Rich Terminal UI (TUI)** with React + Ink
- Yoga layout system (Meta's layout engine)
- Interactive UI elements
- Visual status indicators
- Progress visualization
- 10.5MB bundled CLI

**Polka Codes**:
- **Pure CLI** with Commander.js
- Colored terminal output (chalk)
- Spinners for long operations (ora)
- Interactive prompts (inquirer)
- Lightweight CLI
- No rich TUI

**Key Difference**: Claude Code has rich terminal UI; Polka Codes is traditional CLI.

### 10.2 Commands

**Claude Code** (from research):
```bash
# Not fully documented in research
- Built-in commands (/context, /clear, etc.)
- Tool-driven interaction
- Plan mode (Shift+tab for exit)
```

**Polka Codes**:
```bash
polka [task]                    # Meta-task execution
polka init                      # Initialize config
polka agent [goal]              # Autonomous agent
polka plan [task]               # Create plan
polka code [task]               # Implement feature
polka fix [task]                # Fix failing tests
polka review [--pr <number>]    # Code review
polka commit                    # Generate commit
polka pr                        # Create PR
polka run <script>              # Run custom script
polka skills list               # Manage skills
polka mcp-server                # Start MCP server
polka workflow -f <file>        # Run YAML workflow
```

### 10.3 Interactive Prompts

**Claude Code**:
- `AskUserQuestion` tool (194 tokens)
- Tool-driven questions
- Multi-select options
- Plan mode approval

**Polka Codes**:
- `askFollowupQuestion` tool
- `input` for text input
- `confirm` for yes/no
- `select` for choice selection
- `--yes` flag for auto-confirmation
- `--interactive=false` for non-interactive mode

### 10.4 Output Formatting

**Claude Code**:
- Rich TUI with React components
- Yoga layout system
- Visual indicators
- Progress bars
- Structured output

**Polka Codes**:
- Colored text (chalk)
- Spinners (ora)
- Event streaming to stderr
- Verbosity levels (`--verbose`)
- User-friendly summaries

### 10.5 Event System

**Claude Code**:
- Not publicly documented
- Tool events likely internal

**Polka Codes**:
```typescript
// Event system for observability
TaskEventKind:
  - StartTask, EndTask
  - StartRequest, EndRequest
  - Text, Reasoning
  - ToolUse, ToolReply, ToolError
  - UsageExceeded

// Verbosity levels
- Default: User-friendly summaries
- --verbose: Detailed event logging
- Event streaming to stderr
```

---

## 11. Development Practices

### 11.1 Iteration Speed

**Claude Code**:
- 60-100 internal releases/day
- 5 PRs/engineer/day
- 1 external release/day
- Team of ~10 engineers (July 2025)

**Polka Codes**:
- Release frequency not publicly documented
- Version: 0.9.88 (as of research)
- Active development
- Community-driven

### 11.2 Testing

**Claude Code**:
- Not publicly documented
- Likely has internal test suite

**Polka Codes**:
- 800+ tests
- `bun:test` framework
- Snapshot testing
- Visible test coverage
- Test-driven development

### 11.3 Dogfooding

**Claude Code**:
- Internal release: Nov 2024
- Day 1: 20% of Engineering
- Day 5: 50% of Engineering
- Today: >80% of engineers who write code
- Also used by data scientists

**Polka Codes**:
- Used for own development
- Community users
- Adoption metrics not public

### 11.4 Impact Metrics

**Claude Code**:
- 67% increase in PR throughput (team doubled)
- $500M+ annual run-rate revenue (Sept 2025)
- 10x growth since GA (May 2025)
- 90% of code written by Claude Code

**Polka Codes**:
- Metrics not publicly available
- Open-source project
- Community-driven development

---

## 12. Feature Matrix

### 12.1 Core Features

| Feature | Claude Code | Polka Codes | Notes |
|---------|-------------|-------------|-------|
| **Multi-provider AI** | ❌ (Anthropic only) | ✅ | Polka supports OpenAI, Google, Ollama, etc. |
| **Tool System** | ✅ 20+ tools | ✅ 25+ tools | Similar capabilities |
| **Type-safe Tools** | ❌ Runtime | ✅ Compile-time (Zod) | Polka has stronger typing |
| **File Operations** | ✅ | ✅ | Parity |
| **Search** | ✅ Grep + Glob | ✅ search + searchFiles | Parity |
| **Git Integration** | ✅ In Bash tool | ✅ Dedicated gitDiff tool | Both have |
| **Web Search** | ✅ WebSearch tool | ❌ | Claude has it |
| **Web Fetch** | ✅ WebFetch | ✅ fetchUrl | Parity |
| **Memory System** | ❌ | ✅ File-based memory | Polka has it |
| **Todo Tracking** | ✅ TodoWrite | ✅ get/update/listTodoItems | Different approaches |
| **Planning Workflow** | ✅ EnterPlanMode | ✅ plan command | Both have |
| **Subagents** | ✅ Task tool | ✅ Specialized workflows | Both have |
| **Autonomous Agent** | ❌ | ✅ GoalDecomposer + orchestration | Polka has it |
| **MCP Client** | ✅ | ✅ | Parity |
| **MCP Server** | ❓ Not documented | ✅ | Polka has it |
| **Skills System** | ✅ Skill tool | ✅ Skills with metadata | Both have, different approaches |
| **Dynamic Workflows** | ❌ | ✅ YAML workflows | Polka has it |
| **Custom Scripts** | ❌ | ✅ | Polka has it |
| **Notebook Edit** | ✅ NotebookEdit | ❌ | Claude has it |
| **LSP Integration** | ✅ LSP tool | ❌ | Claude has it |
| **Browser Automation** | ✅ Computer tool | ❌ | Claude has it |
| **Rich TUI** | ✅ React + Ink | ❌ Pure CLI | Claude has it |
| **Configuration** | ✅ Multi-tiered | ✅ Multi-tiered | Both have |
| **Permissions** | ✅ Static analysis | ✅ Advisory + safety checks | Different approaches |
| **Context Management** | ✅ /context commands | ✅ Automatic + memory | Different approaches |
| **CLAUDE.md / AGENTS.md** | ✅ CLAUDE.md | ✅ AGENTS.md | Similar concepts |

### 12.2 Unique Features

**Claude Code Unique**:
- WebSearch tool
- NotebookEdit tool
- LSP integration
- Computer tool (browser automation)
- Rich TUI (React + Ink)
- TodoWrite tool (largest tool description)
- Static analysis permissions
- 90% self-built

**Polka Codes Unique**:
- Multi-provider AI support
- Type-safe tool registry (compile-time)
- Memory system (file-based)
- Autonomous agent (goal decomposition)
- MCP server mode
- Dynamic YAML workflows
- Custom scripts system
- Skills with metadata
- Budget tracking
- Command/tool-specific provider overrides
- Rules system (strings/files/URLs/repos)

---

## 13. Recommendations for Polka Codes

### 13.1 Strengths to Leverage

1. **Multi-provider AI Support**
   - Continue supporting OpenAI, Google, Ollama, etc.
   - This is a key differentiator
   - Market advantage for flexibility

2. **Type Safety**
   - Compile-time tool registry is superior
   - Zod integration provides runtime validation
   - Better developer experience

3. **Extensibility**
   - Skills system is excellent
   - Dynamic workflows (YAML) are powerful
   - Custom scripts add flexibility
   - Continue investing here

4. **Autonomous Agent**
   - Goal decomposition is unique
   - Approval system is well-designed
   - Continuous improvement mode is innovative
   - No equivalent in Claude Code

5. **Memory System**
   - File-based memory is simple and effective
   - Better than Claude Code's approach
   - Consider expanding capabilities

6. **MCP Server Mode**
   - Exposing workflows as MCP tools is smart
   - Not documented in Claude Code
   - Unique advantage

### 13.2 Areas for Improvement

1. **UI/Interface**
   - Consider adding rich TUI (React + Ink like Claude Code)
   - Better progress visualization
   - Interactive status indicators
   - Plan visualization improvements

2. **Web Search**
   - Add WebSearch capability
   - Sources requirement (like Claude Code)
   - Integration with search APIs

3. **Notebook Support**
   - Add NotebookEdit tool
   - Jupyter notebook integration
   - Data science workflow support

4. **LSP Integration**
   - Add LSP tool
   - IDE diagnostics
   - Better IDE integration

5. **Context Management**
   - Add `/context` commands (status, summary, clear)
   - User-controlled context management
   - Better visibility into token usage

6. **Documentation**
   - Create equivalent to CLAUDE.md
   - Better AGENTS.md documentation
   - Best practices guides

7. **Permissions**
   - Implement runtime sandboxing
   - Move beyond advisory permissions
   - Static analysis like Claude Code

8. **Testing**
   - Continue strong testing culture
   - 800+ tests is excellent
   - Consider integration tests

### 13.3 Architecture Decisions to Consider

1. **Monorepo vs Monolithic**
   - Current: Monorepo (5 packages)
   - Claude Code: Monolithic bundle
   - **Recommendation**: Keep monorepo (better modularity)

2. **Type Safety vs Flexibility**
   - Current: Type-safe (Zod + TypeScript)
   - Claude Code: Runtime validation
   - **Recommendation**: Keep type safety (key differentiator)

3. **Workflow vs Tool-first**
   - Current: Workflow orchestration
   - Claude Code: Tool-driven
   - **Recommendation**: Keep workflows (better structure)

4. **Memory System**
   - Current: File-based memory
   - Claude Code: Conversation context
   - **Recommendation**: Keep memory (unique advantage)

5. **Autonomous Agent**
   - Current: Sophisticated orchestration
   - Claude Code: User-driven subagents
   - **Recommendation**: Keep autonomous agent (unique feature)

### 13.4 Feature Prioritization

**High Priority** (Quick Wins):
1. Add `/context` commands (status, summary, clear)
2. Add WebSearch capability
3. Improve documentation (CLAUDE.md equivalent)
4. Better progress visualization

**Medium Priority** (Strategic):
1. Notebook support (Jupyter)
2. LSP integration
3. Runtime sandboxing for scripts
4. Rich TUI (React + Ink)

**Low Priority** (Nice to Have):
1. Browser automation (Computer tool)
2. Advanced IDE integration
3. Additional MCP transports (SSE)

### 13.5 Philosophy Alignment

**Claude Code Philosophy**:
> "Every time there's a new model release, we delete a bunch of code."
> "We want people to feel the model as raw as possible."

**Polka Codes Philosophy** (Observed):
> Type-safe, modular, extensible architecture
> Structured workflows with orchestration
> Multi-provider flexibility

**Recommendation**:
- **Keep current philosophy** - it's a key differentiator
- Consider adopting "code deletion" mindset for model improvements
- Balance simplicity with extensibility
- Don't sacrifice type safety for minimalism

### 13.6 Market Positioning

**Claude Code**:
- Anthropic-only
- Rich TUI
- Simplicity-first
- 90% self-built
- Production-proven (67% PR increase)

**Polka Codes**:
- Multi-provider
- Type-safe
- Extensible
- Open-source
- Autonomous agent

**Recommendation**:
- Position as "flexible, type-safe alternative"
- Emphasize multi-provider support
- Highlight autonomous agent capabilities
- Lean into extensibility (Skills, Workflows, Scripts)
- Target developers who want choice and control

---

## Conclusion

### Key Takeaways

1. **Philosophy Alignment**: Both systems value simplicity, but express it differently
   - Claude Code: Minimal business logic, model-driven
   - Polka Codes: Type-safe, structured, extensible

2. **Technical Parity**: 80% feature overlap in core capabilities
   - Both have robust tool systems
   - Both support MCP
   - Both have subagent/workflow systems

3. **Key Differentiators**:
   - **Claude Code**: Rich TUI, Anthropic-only, simplicity, 90% self-built
   - **Polka Codes**: Multi-provider, type-safe, autonomous agent, extensible

4. **Trade-offs**:
   - Claude Code sacrifices flexibility for simplicity
   - Polka Codes sacrifices minimalism for extensibility

5. **Future Directions**:
   - Polka Codes should keep its unique strengths
   - Adopt selected Claude Code features (WebSearch, `/context` commands)
   - Consider rich TUI for better UX
   - Invest in documentation and best practices

### Final Assessment

Polka Codes is **not a clone** of Claude Code - it's a **complementary alternative** with different strengths:

- **Choose Claude Code for**: Rich TUI, Anthropic-only, simplicity
- **Choose Polka Codes for**: Multi-provider, type safety, extensibility, autonomous agent

Both systems push the boundary of AI-assisted coding, and both have valuable insights to offer the community.

---

## Appendix A: File Structure Comparison

### Claude Code (Reverse Engineered)
```
claude-code/
├── cli.js (10.5MB bundled)
└── No visible source (compiled)
```

### Polka Codes
```
polka-codes/
├── packages/
│   ├── core/              # AI services, workflows, agents, tools
│   │   ├── src/
│   │   │   ├── tool.ts    # Tool definitions
│   │   │   ├── tools/     # Tool implementations
│   │   │   ├── workflow/  # Workflow engine
│   │   │   └── ...
│   ├── cli/               # Command-line interface
│   │   ├── src/
│   │   │   ├── workflows/ # Workflow implementations
│   │   │   ├── agent/     # Autonomous agent
│   │   │   ├── mcp/       # MCP client
│   │   │   ├── mcp-server/ # MCP server
│   │   │   └── ...
│   ├── cli-shared/        # Shared utilities
│   ├── github/            # GitHub integration
│   └── runner/            # Agent execution service
├── docs/                  # Documentation
├── plans/                 # Implementation plans
├── examples/              # Example configurations
└── research/              # This comparison
```

---

## Appendix B: Token Count Comparison

### Claude Code
| Component | Tokens |
|-----------|--------|
| Main system prompt | 2,852 |
| Tool descriptions | 9,400 |
| Subagent prompts | 1,572 |
| Utility prompts | 8,000+ |
| CLAUDE.md | 1,000-2,000 |
| **Total per request** | ~15,000-20,000 |

### Polka Codes
| Component | Estimated Tokens |
|-----------|-----------------|
| Shared prompts | ~500 |
| Agent prompts | ~1,000-2,000 each |
| Custom rules | Variable |
| Skills metadata | Variable |
| Memory context | Variable |
| **Total per request** | ~3,000-5,000 (estimated) |

**Note**: Polka Codes token counts are estimates; exact measurements not available.

---

## Appendix C: Research Sources

### Claude Code Sources
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Introducing advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [How Claude Code is built - The Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Claude Code Internals - Marco Kotrotsos](https://kotrotsos.medium.com/claude-code-internals-part-1-high-level-architecture-9881c68c799f)
- [Piebald-AI/claude-code-system-prompts - GitHub](https://github.com/Piebald-AI/claude-code-system-prompts)

### Polka Codes Sources
- [Polka Codes Repository](https://github.com/polka-codes/polka-codes)
- [Polka Codes Documentation](https://github.com/polka-codes/polka-codes/tree/main/docs)
- Source code analysis (packages/core, packages/cli)
- Configuration files (.polkacodes.yml)
- Test files (800+ tests)

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Authors**: Research synthesis from multiple sources
**License**: This comparison document is part of the Polka Codes project
