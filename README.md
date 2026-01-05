# Polka Codes - AI-Powered Coding Assistant

[![CI](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml/badge.svg)](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

> **Note**
> This project is under active development. APIs and features may evolve, but we strive to maintain backward compatibility when possible.

Polka Codes is a powerful TypeScript-based AI coding assistant framework that helps developers with epic decomposition, task planning, code generation, and more. It uses natural language interactions, a multi-agent system, a command-line interface, and seamless GitHub integration to streamline your development workflow.

## ✨ Features

- ✨ **Epic Decomposition**: Break down large features into smaller, manageable tasks with the `epic` command
- 📝 **Task Planning**: Create detailed implementation plans for your tasks using the `plan` command
- 💻 **Code Generation**: Implement features from a plan or a simple description with the `code` command
- 🐛 **Automated Debugging**: Automatically fix failing tests or commands with the `fix` command
- 🔍 **Code Review**: Get AI-powered feedback on your pull requests and local changes with automatic fix application
- 🤖 **AI-Assisted Git Workflow**: Generate commit messages and create pull requests with the `commit` and `pr` commands
- 💾 **Checkpoint & Resume**: Save and restore work state with the `checkpoints` and `continue` commands
- 🎯 **Custom Scripts**: Define and execute custom TypeScript scripts and shell commands with the `run` and `init` commands
- 🤝 **Multi-Agent System**: Specialized AI agents (Architect, Coder, etc.) collaborate on complex tasks
- 🔧 **Simple Setup**: Quickly initialize your project configuration with `init`
- 🔄 **GitHub Integration**: GitHub Actions integration for PR/issue mentions
- 📦 **Extensible Architecture**: Modular design for adding AI providers, tools, and agents
- ⚡ **Type Safety**: Fully typed with TypeScript for better DX
- 🧪 **Thoroughly Tested**: 800+ tests using `bun:test` with snapshot testing
- 🤖 **Multiple AI Providers**: Anthropic Claude, Google Vertex, DeepSeek, OpenAI, OpenRouter, Ollama
- 🔌 **MCP Support**: Consume tools from external MCP servers and expose workflows via MCP server
- 🚀 **Auto-Fix**: Automatically detect and fix lint/type errors after code changes

## Quick Start

### Installation

```bash
# Install globally using npm
npm install -g @polka-codes/cli

# Or run directly using npx
npx @polka-codes/cli "your task description"
```

### Example Workflow

Here's an example of a typical development workflow using Polka Codes:

```bash
# 1. Break down a large feature into tasks
polka epic "Implement user authentication"

# 2. Create a detailed implementation plan for a task
polka plan --plan-file auth.plan.md "Implement JWT-based auth"

# 3. Implement the feature based on the plan
polka code --file auth.plan.md

# 4. Fix any issues that arise (e.g., failing tests)
polka fix "bun test"

# 5. Commit your changes with an AI-generated message
polka commit -a

# 6. Create a pull request
polka pr
```

## Code Review

The `review` command provides AI-powered code reviews for your projects. It can be used to review GitHub pull requests or local changes. The command can also attempt to automatically fix the issues it finds. Use the `--loop` option to have it re-review its own changes until the review is clean or the loop limit is reached.

### Reviewing Pull Requests

To review a pull request, use the `--pr` option with the pull request number. This feature requires the [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated.

```bash
# Review a pull request by number
polka review --pr 123

# Review and automatically apply feedback in a loop (up to 3 times)
polka review --pr 123 --loop 3
```

### Reviewing Local Changes

To review local changes, run the `review` command without any arguments. It will automatically detect changes in the following order:
1. Staged changes (`git diff --staged`)
2. Unstaged changes (`git diff`)

If no local changes are found, it will fall back to reviewing the diff between the current branch and the repository's default branch (e.g., `main` or `master`). This also requires `gh`.

```bash
# Review staged or unstaged changes
polka review

# Review and apply feedback
polka review --yes
```

### JSON Output

For programmatic use, you can get the review in JSON format by adding the `--json` flag.

```bash
polka review --json
```

For more information, see the [CLI README](packages/cli/README.md).

## Custom Scripts

Polka Codes supports defining and executing custom automation scripts in your `.polkacodes.yml` configuration file. This allows you to create reusable TypeScript scripts and shell commands for common development tasks.

### Script Types

You can define four types of scripts:

1. **Simple Shell Command**: A quick one-liner
2. **Command with Description**: A shell command with metadata
3. **TypeScript Script**: An in-process TypeScript file with full access to Polka Codes APIs
4. **Workflow Script**: A reference to a workflow YAML file

### Configuration

Add scripts to your `.polkacodes.yml`:

```yaml
scripts:
  # Simple shell command
  test: bun test

  # Command with description
  lint:
    command: bun run lint
    description: Run linter

  # TypeScript script
  deploy:
    script: .polka-scripts/deploy.ts
    description: Deploy to production
    timeout: 300000  # 5 minutes
    permissions:
      fs: write
      network: true
```

### Running Scripts

```bash
# List all available scripts
polka run --list

# Run a specific script
polka run deploy

# Run with arguments
polka run deploy -- --production --force

# Quick execution (when no epic context)
polka test  # Runs the 'test' script
```

### Creating TypeScript Scripts

Generate a new script template:

```bash
polka init script my-script
```

This creates `.polka-scripts/my-script.ts` with a template:

```typescript
import { code, commit } from '@polka-codes/cli'

export async function main(args: string[]) {
  console.log('Running script: my-script')
  console.log('Arguments:', args)

  // Your automation here
  // await code({ task: 'Add feature', interactive: false })
  // await commit({ all: true, context: 'Feature complete' })

  console.log('Script completed successfully')
}

if (import.meta.main) {
  main(process.argv.slice(2))
}
```

### Script Permissions

TypeScript scripts support declaring permissions (currently advisory for future sandboxing):

```yaml
scripts:
  risky-script:
    script: .polka-scripts/risky.ts
    permissions:
      fs: write        # read, write, or none
      network: true     # true or false
      subprocess: true  # true or false
    timeout: 60000      # Execution timeout in milliseconds
    memory: 512         # Memory limit in MB (64-8192)
```

**Important**: TypeScript scripts currently run in-process with full permissions. Permission declarations are advisory only for future sandboxing implementation.

### Built-in Commands

The following command names are reserved and cannot be used for custom scripts:
- `code`, `commit`, `pr`, `review`, `fix`, `plan`, `workflow`, `run`, `init`, `meta`

## Checkpoint & Resume

Polka Codes automatically creates checkpoints during agent runs, allowing you to save your work state and resume later.

### Listing Checkpoints

View all available checkpoints:

```bash
polka checkpoints
```

Output example:
```
Found 2 checkpoint(s):

1. feature-complete - Jan 4, 2025, 3:00:00 PM (5m ago)
   Completed: 10 task(s)

2. initial-state - Jan 4, 2025, 2:00:00 PM (1h 5m ago)
   Queue: 15 task(s)
   Next: Implement user authentication

Resume with:
  bun polka continue feature-complete
```

For more details:

```bash
polka checkpoints --verbose
```

### Resuming from Checkpoints

Resume from the most recent checkpoint:

```bash
polka continue
```

Resume from a specific checkpoint:

```bash
polka continue feature-complete
```

The continue command will show you:
- What tasks were completed
- What tasks failed
- What tasks are pending
- Instructions to manually restore and continue

**Note**: Full automatic resume is planned for a future release. Currently, the command provides clear instructions for manual restoration.

### Working Directory

Checkpoints are stored in your project's `.polka/agent-state/checkpoints/` directory. Each checkpoint contains:
- Session ID and timestamp
- Task queue status
- Completed and failed tasks
- Execution history
- Metrics and performance data

## MCP Integration

Polka Codes supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for both consuming external tools and exposing your own workflows as MCP tools.

### Consuming MCP Tools

You can configure external MCP servers in your `.polkacodes.yml` to make their tools available to AI agents:

```yaml
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
    tools:
      read_file: true
      write_file: true
    # Optionally configure specific AI provider for tools
    # provider: anthropic
    # model: claude-3-5-sonnet-20241022

  database:
    command: /path/to/custom-server
    env:
      DATABASE_URL: "postgresql://..."
```

When MCP servers are configured, their tools are automatically exposed to AI agents in the `code`, `fix`, `plan`, and `task` workflows. Tools are named with the pattern `{serverName}/{toolName}` (e.g., `filesystem/read_file`).

### Exposing Workflows via MCP Server

Polka Codes can run as an MCP server, exposing your high-level workflows to Claude Code.

Start the MCP server:

```bash
polka mcp-server
```

The server exposes these workflow tools:
- `code`: Execute coding tasks
- `review`: Review code changes
- `plan`: Create implementation plans
- `fix`: Fix failing tests or commands
- `epic`: Decompose large features into tasks
- `commit`: Generate commit messages

**Configuration with Claude Code:**

Add the MCP server to your Claude Code configuration:

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

For detailed MCP usage instructions and configuration options, see [MCP_GUIDE.md](MCP_GUIDE.md).

## Project Structure

The project is organized as a monorepo with the following packages:

| Package | Description |
|---|---|
| [`core`](/packages/core) | Core AI services, agent implementations, and tooling. |
| [`cli`](/packages/cli) | Command-line interface for interacting with AI services. |
| [`cli-shared`](/packages/cli-shared) | Shared utilities and types for CLI packages. |
| [`github`](/packages/github) | GitHub integration, including the GitHub Action. |
| [`runner`](/packages/runner) | Service for running agents and managing tasks. |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- [ripgrep](https://github.com/BurntSushi/ripgrep#installation) (required for the file search tool)

### Development Setup

```bash
# Clone the repository
git clone https://github.com/polka-codes/polka-codes.git
cd polka-codes

# Install dependencies
bun install
```

### Available Scripts

- `bun build`: Build all packages.
- `bun lint`: Check for linting and formatting errors.
- `bun fix`: Automatically fix linting and formatting issues.
- `bun check`: Run type checking and linting.
- `bun typecheck`: Run type checking only.
- `bun test`: Run tests across all packages.
- `bun clean`: Remove build artifacts.
- `bun cli`: Run the CLI in development mode.
- `bun pr`: A shortcut for `bun cli pr`.
- `bun commit`: A shortcut for `bun cli commit`.
- `bun codegen`: Generate GraphQL types for the GitHub package.

## Contributing

If you're contributing to this project, please refer to [AGENTS.md](AGENTS.md) for:
- Comprehensive project architecture and workflow system documentation
- Code conventions and development guidelines
- Tool system patterns and multi-agent architecture
- Important implementation notes

## Configuration

A [`.polkacodes.yml`](.polkacodes.yml) configuration file can be used to customize the behavior of polka-codes. An example configuration file is provided in the repository as [`example.polkacodes.yml`](example.polkacodes.yml).

For detailed configuration options, refer to the example file, which includes comprehensive comments for each setting.

### Tool Format

You can specify the format for tool integration using the `toolFormat` option in your `.polkacodes.yml` file. This setting determines how the AI model interacts with the available tools.

-   **`native`**: Uses the model's native tool-use capabilities via the Vercel AI SDK. More efficient and leads to better results, but not supported by all models. Check your model provider's documentation for compatibility.

-   **`polka-codes`** (default): Uses a custom XML-based format for tool calls. Designed to be compatible with a wide range of models but may consume more tokens compared to the `native` format.

You can set the `toolFormat` globally or for specific agents or commands.

Example:
```yaml
# .polkacodes.yml
toolFormat: "native"
```

## Environment Variables

The following environment variables can be used to configure Polka Codes. Note that command line options take precedence over environment variables, which in turn take precedence over the configuration file.

| Variable | Description |
|---|---|
| `POLKA_API_PROVIDER` | Specify the default AI service provider. |
| `POLKA_MODEL` | Specify the default AI model to use. |
| `POLKA_API_KEY` | Default API key for the selected provider. |
| `POLKA_BUDGET` | Set the budget limit for AI service usage (defaults to 1000). |
| `ANTHROPIC_API_KEY` | API key for Anthropic Claude service. |
| `OPENROUTER_API_KEY` | API key for OpenRouter service. |
| `DEEPSEEK_API_KEY` | API key for DeepSeek service. |

## License

This project is licensed under the [AGPL-3.0 License](LICENSE).

## Credits

This project is heavily inspired by the [Cline](https://github.com/cline/cline) project.

---
*Generated by polka.codes*
