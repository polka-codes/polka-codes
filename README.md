# Polka Codes - AI-Powered Coding Assistant

[![CI](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml/badge.svg)](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

> **Warning**
> This project is still in very early stages of development. Please use with caution as APIs and features may change frequently.

Polka Codes is a powerful TypeScript-based AI coding assistant framework that helps developers with epic decomposition, task planning, code generation, and more. It uses natural language interactions, a multi-agent system, a command-line interface, and seamless GitHub integration to streamline your development workflow.

## Features

- ✨ **Epic Decomposition**: Break down large features into smaller, manageable tasks with the `epic` command.
- 📝 **Task Planning**: Create detailed implementation plans for your tasks using the `plan` command.
- 💻 **Code Generation**: Implement features from a plan or a simple description with the `code` command.
- 🐛 **Automated Debugging**: Automatically fix failing tests or commands with the `fix` command.
- 🤖 **AI-Assisted Git Workflow**: Generate commit messages and create pull requests with the `commit` and `pr` commands.
- 🕵️ **Code Review**: Get AI-powered feedback on your pull requests and local changes, and even have the AI apply the fixes for you.
- 🤝 **Multi-Agent System**: Specialized AI agents (Architect, Coder, etc.) collaborate on complex tasks like planning, coding, and fixing.
- 🔧 **Simple Setup**: Quickly initialize your project configuration with `init`.
- 🔄 **GitHub Integration**: A GitHub Action that allows you to run Polka Codes by mentioning it in pull requests and issues.
- 📦 **Extensible Architecture**: A modular design that allows for adding new AI providers, tools, and agents.
- ⚡ **Type Safety**: Fully typed with TypeScript for a better developer experience.
- 🧪 **Thoroughly Tested**: Comprehensive test suite using `bun:test` with snapshot testing.
- 🤖 **Multiple AI Providers**: Supports Google Vertex, DeepSeek (recommended), Anthropic Claude, Ollama, and OpenRouter.

## Quick Start

### Installation

'''bash
# Install globally using npm
npm install -g @polka-codes/cli

# Or run directly using npx
npx @polka-codes/cli "your task description"
'''

### Example Workflow

Here's an example of a typical development workflow using Polka Codes:

'''bash
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
'''

## Code Review

The `review` command provides AI-powered code reviews for your projects. It can be used to review GitHub pull requests or local changes. The command can also attempt to automatically fix the issues it finds. Use the `--loop` option to have it re-review its own changes until the review is clean or the loop limit is reached.

### Reviewing Pull Requests

To review a pull request, use the `--pr` option with the pull request number or URL. This feature requires the [GitHub CLI](https://cli.github.com/) (`gh`) to be installed and authenticated.

'''bash
# Review a pull request by number
polka review --pr 123

# Review a pull request by URL
polka review --pr https://github.com/owner/repo/pull/123

# Review and automatically apply feedback in a loop (up to 3 times)
polka review --pr 123 --loop 3
'''

### Reviewing Local Changes

To review local changes, run the `review` command without any arguments. It will automatically detect changes in the following order:
1. Staged changes (`git diff --staged`)
2. Unstaged changes (`git diff`)

If no local changes are found, it will fall back to reviewing the diff between the current branch and the repository's default branch (e.g., `main` or `master`). This also requires `gh`.

'''bash
# Review staged or unstaged changes
polka review

# Review and apply feedback
polka review --yes
'''

### JSON Output

For programmatic use, you can get the review in JSON format by adding the `--json` flag.

'''bash
polka review --json
'''

For more information, see the [CLI README](packages/cli/README.md).

## Project Structure

The project is organized as a monorepo with the following packages:

| Package | Description |
|---|---|
| [`core`](/packages/core) | Core AI services, agent implementations, and tooling. |
| [`cli`](/packages/cli) | Command-line interface for interacting with AI services. |
| [`cli-shared`](/packages/cli-shared) | Shared utilities and types for CLI packages. |
| [`github`](/packages/github) | GitHub integration, including the GitHub Action. |
| [`runner`](/packages/runner) | Service for running agents and managing tasks. |
| [`workflow`](/packages/workflow) | Defines the core workflow engine and agent orchestration logic. |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) (v1.0.0 or higher)
- [ripgrep](https://github.com/BurntSushi/ripgrep#installation) (required for the file search tool)

### Development Setup

'''bash
# Clone the repository
git clone https://github.com/polka-codes/polka-codes.git
cd polka-codes

# Install dependencies
bun install
'''

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

## Configuration

A [`.polkacodes.yml`](.polkacodes.yml) configuration file can be used to customize the behavior of polka-codes. An example configuration file is provided in the repository as [`example.polkacodes.yml`](example.polkacodes.yml).

For detailed configuration options, refer to the example file, which includes comprehensive comments for each setting.

### Tool Format

You can specify the format for tool integration using the `toolFormat` option in your `.polkacodes.yml` file. This setting determines how the AI model interacts with the available tools.

-   **`native`**: This option uses the model's native tool-use capabilities. It can be more efficient and lead to better results, but it is not supported by all models. Check your model provider's documentation for compatibility.

-   **`polka-codes`** (default): This option uses a custom XML-based format for tool calls. It is designed to be compatible with a wide range of models but may consume more tokens and be less performant compared to the `native` format.

You can set the `toolFormat` globally or for specific agents or commands.

Example:
'''yaml
# .polkacodes.yml
toolFormat: "native"
'''

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
