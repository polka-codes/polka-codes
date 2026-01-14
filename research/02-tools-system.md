# Claude Code: Tools System

## Overview

Claude Code's tool system is the primary mechanism through which the AI model interacts with the user's environment. Tools are described in the system prompt and exposed to the model for function calling.

## Core Built-in Tools

### File Operations

#### Read Tool (439 tokens)
- Reads files from the local filesystem
- Supports line offset/limit for large files
- Can read images (PNG, JPG), PDFs, Jupyter notebooks
- Returns output with line numbers (cat -n format)

#### Write Tool (159 tokens)
- Creates new files or overwrites existing ones
- Must read file first before editing (enforced by system)
- Line number prefix preservation for indentation

#### Edit Tool (278 tokens)
- Performs exact string replacements in files
- Requires reading file before use
- Preserves exact indentation after line number prefix
- Supports `replace_all` for renaming variables

#### Glob Tool (122 tokens)
- Fast file pattern matching using glob patterns
- Returns matches sorted by modification time
- Used for finding files by name patterns

#### Grep Tool (300 tokens)
- Powerful search using ripgrep under the hood
- Supports regex, file type filters, output modes
- Can search with context (-A/-B/-C flags)
- Outputs: content, files_with_matches, or count

### Execution Tools

#### Bash Tool (1125 tokens + 1526 for git)
- Runs shell commands in a persistent shell session
- **Git commit workflow** (built-in):
  1. Runs git status, git diff, git log in parallel
  2. Analyzes changes and recent commits
  3. Drafts commit message following best practices
  4. Stages files, creates commit, runs git status
- Includes special handling for:
  - Git operations (commit, PR creation)
  - Shell quoting (double quotes for paths with spaces)
  - Sequential vs parallel command execution
- **Important**: NEVER use bash echo for communication - use text output instead

#### NotebookEdit Tool (121 tokens)
- Edits Jupyter notebook cells
- Supports replace, insert, delete modes
- Cell type: code or markdown

### Planning and Workflow

#### EnterPlanMode Tool (970 tokens)
- Transitions to plan mode for implementation tasks
- Used for multi-step features requiring planning
- Allows exploration before coding
- Not for simple tasks or research-only work

#### ExitPlanMode Tool (447 tokens v2)
- Signals plan completion and requests user approval
- Can request prompt-based permissions for bash commands
- Presents plan dialog for approval

#### Task Tool (1227 tokens)
- Launches specialized subagents with full context access
- Supports various agent types (Explore, Plan, general-purpose, etc.)
- Can run in background with output file
- Supports resuming with agent ID

### Collaboration Tools

#### AskUserQuestion Tool (194 tokens)
- Asks 1-4 questions during execution
- Supports multiple selection options
- Returns user answers for parameter gathering

#### TodoWrite Tool (2167 tokens)
- Creates/manages structured task lists
- Tracks: pending, in_progress, completed states
- Requires both content and activeForm for each todo
- Only ONE todo can be in_progress at a time
- CRITICAL for tracking multi-step tasks

### Web Integration

#### WebFetch Tool (265 tokens)
- Fetches web content
- Handles redirects automatically
- Returns content that must be followed with new request

#### WebSearch Tool (334 tokens)
- Searches the web for current information
- Domain filtering supported
- US-only currently
- **MUST include "Sources:" section with hyperlinks at end**

#### MCPSearch Tool (477 tokens)
- Searches and executes tools from MCP servers
- Discovers available tools dynamically
- Used for tool exploration before execution

### Specialized Tools

#### LSP Tool (255 tokens)
- Language Server Protocol integration
- IDE diagnostics integration

#### Skill Tool (444 tokens)
- Executes user-invocable skills (slash commands)
- Maps /<command-name> to skill prompts
- Only use for skills in user-invocable list

#### Computer Tool (161 tokens)
- Chrome browser automation
- Requires MCP Chrome tools loaded first

## Tool Descriptions and Token Counts

Tool descriptions are substantial parts of the system prompt:

| Tool | Tokens | Purpose |
|------|--------|---------|
| TodoWrite | 2,167 | Task management |
| Bash (with git) | 2,651 | Command execution + git workflow |
| Task | 1,227 | Subagent spawning |
| Bash (base) | 1,125 | Shell commands |
| EnterPlanMode | 970 | Planning mode entry |
| ExitPlanMode v2 | 447 | Plan approval |
| Grep | 300 | Content search |
| Read | 439 | File reading |
| WebSearch | 334 | Web search |
| Skill | 444 | Slash commands |
| MCPSearch | 477 | MCP tool discovery |
| WebFetch | 265 | URL fetching |
| Edit | 278 | String replacement |
| AskUserQuestion | 194 | User interaction |
| Write | 159 | File creation |
| Computer | 161 | Browser automation |
| NotebookEdit | 121 | Jupyter editing |
| Glob | 122 | File patterns |
| LSP | 255 | IDE integration |

**Total: ~10,000+ tokens just for tool descriptions**

## MCP (Model Context Protocol) Integration

### MCP as Client
Claude Code can connect to external MCP servers:

```yaml
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/path"]
    tools:
      read_file: true
      write_file: true

  puppeteer:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-puppeteer"]
```

Configuration locations:
- Project config (`.claude/config.json`)
- Global config (`~/.claude/config.json`)
- Repository `.mcp.json` (sharable with team)

### Popular MCP Servers (2025)

1. **GitHub MCP Server**: Version control and automation
2. **Apidog MCP Server**: API specification integration
3. **File System MCP Server**: Local file access
4. **Puppeteer MCP Server**: Browser automation
5. **Context7 MCP Server**: Documentation and code examples
6. **Brave Search MCP Server**: Web search capabilities
7. **Zapier MCP Server**: Workflow automation

### MCP as Server
Claude Code can expose its own workflows as MCP tools:
- `code`: Execute coding tasks
- `review`: Review code changes
- `plan`: Create implementation plans
- `fix`: Fix failing tests
- `commit`: Generate commit messages

## Tool Usage Patterns

### Parallel Tool Calls
- Maximize efficiency by calling independent tools in parallel
- Example: Run `git status`, `git diff`, `git log` in parallel
- Sequential calls only when dependencies exist

### Specialized Tools vs. Bash
- Use specialized tools instead of bash when available:
  - **Read** instead of `cat`
  - **Edit** instead of `sed`
  - **Glob** instead of `find`
  - **Grep** instead of `grep` or `rg`
- Reserve bash for actual system commands

### Tool Selection Guidelines

From Claude Code best practices:
1. **Use Task tool** for complex, multi-step tasks
2. **Use Explore agent** for codebase exploration (not needle queries)
3. **Use Bash** only for terminal operations
4. **Use specialized file tools** for file operations
5. **Use AskUserQuestion** when multiple valid approaches exist

## Tool Permissions

### Permission System
Multi-tiered allowlist:
- **One-time**: Allow for current session only
- **Always allow**: Add to settings for future sessions
- **Reject**: Deny the action

### Configuration
```bash
/permissions  # Add/remove tools from allowlist
--allowedTools CLI flag  # Session-specific permissions
```

Settings locations:
- `.claude/settings.json` (project-specific, check into git)
- `~/.claude.json` (user-specific)
- Multi-tier: project → user → company

### Static Analysis
Commands are statically analyzed before execution:
- Checks against allowlist patterns
- Supports glob patterns (e.g., `Bash(git commit:*)`)
- Example allowlisted tools:
  - `Edit` (file edits)
  - `Bash(git commit:*)` (git commits)
  - `mcp__puppeteer__puppeteer_navigate` (browser navigation)

## Advanced Tool Use

### Dynamic Tool Discovery (Claude Developer Platform)
- Claude can discover, learn, and execute tools dynamically
- Enables agents that take action in the real world
- Advances beyond static tool descriptions

### Code Execution with MCP
- More efficient tool interaction
- Handles more tools through code execution
- Better scalability for complex tool chains

## Sources
- [Piebald-AI/claude-code-system-prompts - GitHub](https://github.com/Piebald-AI/claude-code-system-prompts)
- [Introducing advanced tool use - Anthropic Engineering](https://www.anthropic.com/engineering/advanced-tool-use)
- [Code execution with MCP - Anthropic Engineering](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Connector - Claude Docs](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)
- [10 Must-Have MCP Servers for Claude Code 2025 - Medium](https://roobia.medium.com/the-10-must-have-mcp-servers-for-claude-code-2025-developer-edition-43dc3c15c887)
- [Claude Code MCP 快速高效使用指南 - CNBlogs](https://www.cnblogs.com/lf109/p/18975750)
