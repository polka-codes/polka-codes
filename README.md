# Polka Codes - AI-Powered Coding Assistant

[![CI](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml/badge.svg)](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

> **Warning**
> This project is still in very early stages of development. Please use with caution as APIs and features may change frequently.

Polka Codes is a powerful TypeScript-based AI coding assistant framework that helps developers write, improve, and maintain code through natural language interactions. It features a multi-agent system, a command-line interface, and seamless GitHub integration to streamline your development workflow.

## Features

- 🎯 **Project Scaffolding**: Easily create new projects with the `create` command.
- 🔧 **Simple Setup**: Quickly initialize your project configuration with `init`.
- 🤖 **Multiple AI Providers**: Supports Google Vertex, DeepSeek (recommended), Anthropic Claude, Ollama, and OpenRouter.
- 🤝 **Multi-Agent System**: Specialized AI agents collaborate on complex tasks:
  - **Architect Agent**: Handles system design and high-level planning.
  - **Coder Agent**: Focuses on implementation, coding, and maintenance.
  - **Analyzer Agent**: Analyzes code and project structure.
  - **Code Fixer Agent**: Fixes bugs and addresses issues.
- 💻 **Interactive CLI**: A powerful command-line interface for task execution and interactive chat.
- 🔄 **GitHub Integration**: A GitHub Action that allows you to run Polka Codes by mentioning it in pull requests and issues.
- 📦 **Extensible Architecture**: A modular design that allows for adding new AI providers, tools, and agents.
- ⚡ **Type Safety**: Fully typed with TypeScript for a better developer experience.
- 🧪 **Thoroughly Tested**: Comprehensive test suite using `bun:test` with snapshot testing.

## Quick Start

### Installation

'''bash
# Install globally using npm
npm install -g @polka-codes/cli

# Or run directly using npx
npx @polka-codes/cli "your task description"
'''

### Basic Usage

'''bash
# Create a new project
polka create my-project

# Initialize configuration
polka init

# Run a task
polka "improve README.md"

# Start an interactive chat session
polka

# Get help
polka --help
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

- `bun test`: Run tests across all packages and update snapshots.
- `bun typecheck`: Run type checking.
- `bun fix --unsafe`: Fix linting and formatting issues.

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
