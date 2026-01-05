# Polka Codes CLI - Command Line Interface

[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License](https://img.shields.io/npm/l/@polka-codes/cli.svg)](https://github.com/polkacodes/polkacodes/blob/main/LICENSE)

[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

The Polka Codes CLI provides a powerful command-line interface for interacting with AI-powered coding assistants. It offers features like code generation, implementation planning, bug fixing, and pull request reviews.

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

## Commands

The primary way to use Polka is by providing a task description directly:

```bash
polka "implement user authentication"
```

The CLI will intelligently determine the best workflow to handle your request. For more specific tasks, you can use the following commands:

### Core Commands

#### `code`

Plan and implement a feature or task using AI agents.

```bash
polka code "Add user authentication with OAuth"
polka code --preview "Add login form"  # Show diff before applying
```

**Features:**
- Architect agent creates implementation plan
- Coder agent implements the plan
- Automatic fix workflow runs after implementation
- Optional diff preview mode

#### `plan`

Create an implementation plan for a new feature or refactor.

```bash
polka plan "Add user authentication"
polka plan --plan-file auth-plan.md "Update auth system"
```

**Features:**
- Creates detailed step-by-step plans
- Saves to markdown files for review
- Can update existing plans

#### `epic`

Orchestrate a large feature or epic, breaking it down into smaller tasks and executing them sequentially.

```bash
polka epic "Build a complete e-commerce platform"
polka epic --no-review "Quick prototype"  # Skip review step
```

**Features:**
- Breaks large features into manageable tasks
- Maintains context across tasks
- Persistent todo list
- Optional review step

#### `fix`

Automatically fix failing tests or commands by running them and letting AI fix errors.

```bash
polka fix                    # Uses default check/test scripts
polka fix "bun test"         # Fix specific test failures
polka fix -p "Focus on auth"  # Provide additional context
```

**Features:**
- Iterative fixing with bail conditions
- Uses check/test/format scripts from `.polkacodes.yml`
- Supports custom commands

#### `review`

Review code changes (GitHub PR or local) with AI-powered feedback.

```bash
polka review                      # Review local changes
polka review --pr 123             # Review GitHub PR
polka review --range HEAD~5..HEAD # Review commit range
polka review --loop 3              # Re-review until clean
polka review --json               # JSON output for automation
```

**Features:**
- Reviews staged changes, unstaged changes, or commit ranges
- GitHub PR review with `gh` integration
- Iterative remediation with `--loop`
- Can automatically apply fixes

#### `commit`

Generate a commit message based on your staged changes.

```bash
polka commit          # Generate message for staged changes
polka commit -a       # Stage all changes first
polka commit --context "Fixed login bug"  # Add context
```

#### `pr`

Create a GitHub pull request with AI-generated title and description.

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
- Checkpoint name and timestamp
- Completed, failed, and pending tasks
- Instructions to resume

#### `continue`

Resume work from a checkpoint.

```bash
polka continue                    # Resume latest checkpoint
polka continue <checkpoint-name>  # Resume specific checkpoint
polka continue --list             # List checkpoints in continue mode
```

**Features:**
- Shows task status (completed, failed, pending)
- Provides instructions to restore state
- Helps continue from where you left off

### Utility Commands

#### `init`

Initialize Polka Codes configuration.

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
polka skills                   # List available skills
polka skills create            # Create new skill
```

### Advanced Commands

#### `mcp-server`

Start Polka Codes as an MCP server.

```bash
polka mcp-server
```

Exposes workflows as MCP tools for use with Claude Desktop, Continue.dev, etc.

#### `agent`

Run autonomous agent for continuous improvement.

```bash
polka agent "Fix all failing tests"
```

**Note:** This is experimental and primarily used for task discovery and planning.

### Git Integration

#### `commit`

Generate a commit message based on your staged changes.

```bash
# Generate commit message for staged changes
polka commit

# Generate commit message with additional context
polka commit "closes #123"

# Stage all changes and commit
polka commit -a
```

#### `pr`

Create a pull request with an AI-generated title and description.

```bash
# Create PR for the current branch
polka pr

# Create PR with additional context
polka pr "implements feature #456"
```

## Configuration

### Provider Setup

Polka Codes supports multiple AI providers:

1. DeepSeek (Recommended)
2. Anthropic (Claude 3 Sonnet recommended)
3. OpenRouter
4. Ollama

Configure your provider in `.env`:

```bash
# Required
POLKA_API_KEY=your_api_key_here

# Optional - override defaults
POLKA_API_PROVIDER=deepseek  # or anthropic, openrouter, ollama
POLKA_MODEL=deepseek-chat  # or claude-3-7-sonnet-20250219
```

### Project Configuration

Create `.polkacodes.yml` in your project root:

```yaml
# AI provider settings
defaultProvider: deepseek  # default provider
defaultModel: deepseek-chat  # default model

# Custom commands available to AI
commands:
  test:
    command: bun test
    description: Run tests. Pass file path to run specific tests.
  check:
    command: bun typecheck
    description: Run type checker
  format:
    command: bun fix
    description: Format code

# Additional rules/guidelines for AI
rules: |
  - Use TypeScript for all new files
  - Follow project's existing code style
  - Add tests for new features
```

### Global vs Local Configuration

- Global config (`~/.config/polkacodes/config.yml`): Store API keys and default settings
- Local config (`.polkacodes.yml`): Project-specific settings and commands

## Features

- 🤖 Multiple AI provider support
- 🧠 Intelligent workflow execution
- 💻 Code generation, planning, and bug fixing
- 🔄 Git workflow integration (commit messages and PRs)
- 🔎 Pull request reviews
- 📊 Project-specific configuration and commands
- 🔑 Secure API key management
- 📝 Detailed logging with `--verbose`

## Usage Tips

1.  For general tasks, let Polka figure it out:
    ```bash
    polka "add a dark mode toggle to the settings page"
    ```

2.  Create a plan before implementing a large feature:
    ```bash
    polka plan "migrate the frontend from Vue to React"
    ```

3.  Combine with your git workflow:
    ```bash
    git add . && polka commit && polka pr
    ```

4.  Get help with a failing test:
    ```bash
    polka fix "bun test tests/checkout.test.ts" --verbose
    ```

## Requirements

- Bun (v1.0.0+)
- `git` (for `commit` and `pr` commands)
- `GitHub CLI (gh)` (for `pr` command)

---

*This README was generated by polka.codes*
