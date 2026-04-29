# Polka Codes CLI - Command Line Interface

[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License](https://img.shields.io/npm/l/@polka-codes/cli.svg)](https://github.com/polka-codes/polka-codes/blob/master/LICENSE)

[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

The Polka Codes CLI is the command reference for Polka Codes. Use it to plan work, implement changes, fix failing commands, review code, manage checkpoints, run custom scripts, and create GitHub commits and pull requests.

## Installation

```bash
# Install globally with npm
npm install -g @polka-codes/cli

# Install globally with yarn
yarn global add @polka-codes/cli

# Install globally with bun
bun add -g @polka-codes/cli

# Or run directly with npx
npx @polka-codes/cli "Your task description"
```

## Requirements

For normal npm, yarn, or npx usage:

- `git`, required for repository-aware workflows.
- GitHub CLI (`gh`), required for `pr` and GitHub PR review workflows.
- `ripgrep`, required by the file search tool.

For repository development or source installs, install [Bun](https://bun.sh/) v1.0.0 or higher.

## Commands

The primary way to use Polka is to provide a task description directly:

```bash
polka "implement user authentication"
```

The CLI chooses the best workflow for the request. Use explicit commands when you need a specific workflow.

### Core Commands

#### `code`

Plan and implement a feature or task using AI agents.

```bash
polka code "Add user authentication with OAuth"
polka code --preview "Add login form"  # Show diff before applying
```

**Features:**
- Architect agent creates an implementation plan.
- Coder agent implements the plan.
- Automatic fix workflow runs after implementation.
- Optional diff preview mode.

#### `plan`

Create or update an implementation plan.

```bash
polka plan "Add user authentication"
polka plan --plan-file auth-plan.md "Update auth system"
```

**Features:**
- Creates detailed step-by-step plans.
- Saves plans to markdown files for review.
- Can update existing plans.

#### `fix`

Run a failing command and let an agent fix the errors.

```bash
polka fix                         # Uses configured check/test scripts
polka fix "bun test"              # Fix specific test failures
polka fix -p "Focus on auth"      # Same as --prompt; adds context
polka fix --prompt "Focus on auth"
```

**Features:**
- Iterative fixing with bail conditions.
- Uses check/test/format scripts from `.polkacodes.yml`.
- Supports custom commands.

#### `review`

Review code changes with AI-powered feedback.

```bash
polka review                      # Review local changes
polka review --pr 123             # Review GitHub PR
polka review --range HEAD~5..HEAD # Review commit range
polka review --loop 3             # Re-review until clean
polka review --json               # JSON output for automation
```

**Features:**
- Reviews staged changes, unstaged changes, commit ranges, or GitHub PRs.
- Uses `gh` for GitHub PR review.
- Supports iterative remediation with `--loop`.
- Can automatically apply fixes when requested.

#### `commit`

Generate a commit message based on staged changes.

```bash
polka commit                                # Generate message for staged changes
polka commit -a                             # Stage all changes first
polka commit --context "Fixed login bug"   # Add context
```

#### `pr`

Create a GitHub pull request with an AI-generated title and description.

```bash
polka pr
polka pr --context "Implements user authentication"
```

#### `workflow`

Run custom workflow files.

```bash
polka workflow -f my-workflow.workflow
polka workflow -f custom.workflow -w customWorkflow
```

### Checkpoint Commands

#### `checkpoints`

List available checkpoints for resuming work.

```bash
polka checkpoints              # List all checkpoints
polka checkpoints --verbose    # Show detailed info
```

**Output shows:**
- Checkpoint name and timestamp.
- Completed, failed, and pending tasks.
- Instructions to resume.

#### `continue`

Resume work from a checkpoint.

```bash
polka continue                    # Resume latest checkpoint
polka continue <checkpoint-name>  # Resume specific checkpoint
polka continue --list             # List checkpoints in continue mode
```

**Features:**
- Shows task status.
- Provides instructions to restore state.
- Helps continue from where you left off.

### Utility Commands

#### `init`

Initialize Polka Codes configuration or generate templates.

```bash
polka init                    # Create local config
polka init --global           # Create global config
polka init script my-script   # Generate script template
polka init skill              # Generate skill template
```

#### `run`

Run custom scripts from `.polkacodes.yml`.

```bash
polka run                     # List available scripts
polka run deploy              # Run specific script
polka run deploy -- --prod    # Pass arguments to script
```

#### `skills`

Manage agent skills.

```bash
polka skills                  # List available skills
polka skills create           # Create new skill
```

### Advanced Commands

#### `mcp-server`

Start Polka Codes as an MCP server for Claude Code.

```bash
polka mcp-server
```

Configure it with Claude Code:

```bash
claude mcp add polka polka mcp-server
```

Or manually edit `~/.claude/config.json`:

```json
{
  "mcpServers": {
    "polka": {
      "command": "polka",
      "args": ["mcp-server"]
    }
  }
}
```

This exposes workflows such as `code`, `review`, `plan`, `fix`, and `commit` as MCP tools. See [MCP implementation notes](src/mcp/README.md) for architecture details.

#### `agent`

Run an autonomous agent for continuous improvement.

```bash
polka agent "Fix all failing tests"
```

**Note:** This is experimental and primarily used for task discovery and planning.

#### `meta`

Route a natural-language request to the appropriate workflow. This is primarily an internal workflow used by the CLI when you invoke `polka "your task"`; most users do not need to run it directly.

## Configuration

### Provider Setup

Polka Codes supports multiple AI providers. Common provider names include `deepseek`, `anthropic`, `openai`, `openrouter`, `google-vertex`, and `ollama`, depending on your installed provider configuration.

Configure your provider in `.env` or `.polkacodes.yml`:

```bash
POLKA_API_KEY=your_api_key_here
POLKA_API_PROVIDER=deepseek
POLKA_MODEL=deepseek-chat
```

You can also use provider-specific keys such as `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, and `DEEPSEEK_API_KEY`.

### Environment Variables

Command line options take precedence over environment variables, and environment variables take precedence over configuration files.

| Variable | Description |
|---|---|
| `POLKA_API_PROVIDER` | Default AI service provider. |
| `POLKA_MODEL` | Default AI model. |
| `POLKA_API_KEY` | Default API key for the selected provider. |
| `POLKA_BUDGET` | Budget limit for AI service usage. |
| `ANTHROPIC_API_KEY` | API key for Anthropic. |
| `OPENROUTER_API_KEY` | API key for OpenRouter. |
| `DEEPSEEK_API_KEY` | API key for DeepSeek. |

### Project Configuration

Create `.polkacodes.yml` in your project root:

```yaml
# AI provider settings
defaultProvider: deepseek
defaultModel: deepseek-chat

# Custom scripts available to Polka and AI workflows
scripts:
  test:
    command: bun test
    description: Run tests. Pass a file path to run specific tests.
  check:
    command: bun typecheck
    description: Run type checking.
  format:
    command: bun fix
    description: Format code.

# Additional rules/guidelines for AI
rules: |
  - Use TypeScript for all new files.
  - Follow the project's existing code style.
  - Add tests for new features.
```

Use `scripts` for runnable project commands. The lower-level `commands` key is reserved for per-command model settings.

### Global vs Local Configuration

- Global config (`~/.config/polkacodes/config.yml`): store API keys and default settings.
- Local config (`.polkacodes.yml`): store project-specific settings, scripts, and rules.

## Features

- Multiple AI provider support.
- Intelligent workflow execution.
- Code generation, planning, and bug fixing.
- Git workflow integration for commit messages and PRs.
- Pull request reviews.
- Project-specific configuration and scripts.
- Secure API key management.
- Detailed logging with `--verbose`.

## Usage Tips

1. Let Polka choose the workflow for general tasks:
   ```bash
   polka "add a dark mode toggle to the settings page"
   ```

2. Create a plan before implementing a large feature:
   ```bash
   polka plan "migrate the frontend from Vue to React"
   ```

3. Combine with your git workflow:
   ```bash
   git add . && polka commit && polka pr
   ```

4. Add context when fixing a failing command:
   ```bash
   polka fix "bun test tests/checkout.test.ts" --prompt "Focus on checkout totals" --verbose
   ```

## See Also

- [Root README](../../README.md) for the project overview.
- [MCP implementation notes](src/mcp/README.md) for MCP architecture details.
- [example.polkacodes.yml](../../example.polkacodes.yml) for a commented configuration example.

---

*This README was generated by polka.codes*
