# Polka Codes - AI-Powered Coding Assistant

[![CI](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml/badge.svg)](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

> **Note**
> This project is under active development. APIs and features may evolve, but we strive to maintain backward compatibility when possible.

Polka Codes is a powerful TypeScript-based AI coding assistant framework that helps developers with task planning, code generation, and more. It uses natural language interactions, a multi-agent system, a command-line interface, and seamless GitHub integration to streamline your development workflow.

## ✨ Features

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

```bash
# Install globally using npm
npm install -g @polka-codes/cli

# Or run directly using npx
npx @polka-codes/cli "your task description"
```

### Example Workflow

```bash
polka plan --plan-file auth.plan.md "Implement JWT-based auth"  # 1. Plan
polka code --file auth.plan.md                                  # 2. Implement
polka fix "bun test"                                            # 3. Fix issues
polka commit -a                                                 # 4. Commit
polka pr                                                        # 5. Create PR
```

## Code Review

The `review` command provides AI-powered code reviews for GitHub pull requests or local changes, with optional auto-fix and iterative remediation via `--loop`.

```bash
polka review              # Review local changes
polka review --pr 123     # Review a GitHub PR
polka review --loop 3     # Re-review until clean (up to 3 times)
polka review --json       # JSON output for automation
```

For full details, see the [CLI README](packages/cli/README.md).

## Custom Scripts

Define reusable shell commands and TypeScript scripts in `.polkacodes.yml`:

```yaml
scripts:
  test: bun test                    # Simple shell command
  lint:
    command: bun run lint           # Command with description
    description: Run linter
  deploy:
    script: .polka-scripts/deploy.ts  # TypeScript script
    description: Deploy to production
```

```bash
polka run --list          # List available scripts
polka run deploy          # Run a script
polka init script my-script  # Create a script template
```

The following command names are reserved and cannot be used for custom scripts:
`code`, `commit`, `pr`, `review`, `fix`, `plan`, `workflow`, `run`, `init`, `meta`

## Checkpoint & Resume

Polka Codes automatically creates checkpoints during agent runs, allowing you to save your work state and resume later.

```bash
polka checkpoints              # List all checkpoints
polka checkpoints --verbose    # Show detailed info
polka continue                 # Resume from latest checkpoint
polka continue <name>          # Resume from a specific checkpoint
```

Checkpoints are stored in `.polka/agent-state/checkpoints/` and include session ID, task queue status, execution history, and metrics.

## MCP Integration

Polka Codes supports the [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) for both consuming external tools and exposing your own workflows as MCP tools.

**Consuming MCP tools** — configure external MCP servers in `.polkacodes.yml`:

```yaml
mcpServers:
  filesystem:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-filesystem", "/allowed/path"]
```

**Exposing workflows via MCP server** — run Polka as an MCP server for Claude Code:

```bash
polka mcp-server
claude mcp add polka polka mcp-server
```

For detailed MCP configuration options, see the [CLI README](packages/cli/README.md).

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
