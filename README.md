# Polka Codes - AI-Powered Coding Assistant

[![CI](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml/badge.svg)](https://github.com/polka-codes/polka-codes/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![npm downloads](https://img.shields.io/npm/dm/@polka-codes/cli.svg)](https://www.npmjs.com/package/@polka-codes/cli)
[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL%203.0-blue.svg)](LICENSE)
[![Bun Version](https://img.shields.io/badge/Bun-v1.0.0+-brightgreen)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue)](https://www.typescriptlang.org)

> **Note**
> This project is under active development. APIs and features may evolve, but we strive to maintain backward compatibility when possible.

Polka Codes is a TypeScript-based AI coding assistant framework for planning work, generating code, fixing failures, reviewing changes, and automating common repository workflows. It combines a command-line interface, multi-agent workflows, GitHub integration, and configurable project automation.

## Features

- **Task planning**: create implementation plans with `plan`.
- **Code generation**: implement features from a plan or prompt with `code`.
- **Automated fixing**: run failing commands and let agents repair issues with `fix`.
- **Code review**: review local changes, commit ranges, or GitHub pull requests with `review`.
- **Git workflow support**: generate commit messages and pull requests with `commit` and `pr`.
- **Checkpoint and resume**: inspect and continue saved agent state with `checkpoints` and `continue`.
- **Custom scripts**: define project scripts in `.polkacodes.yml` and run them with `run`.
- **Skills and autonomous agents**: manage reusable skills with `skills` and run experimental continuous-improvement agents with `agent`.
- **Custom workflows**: execute workflow files with `workflow`.
- **MCP support**: consume tools from external MCP servers and expose Polka workflows with `mcp-server`.
- **Multiple AI providers**: configure providers such as DeepSeek, Anthropic, OpenAI, OpenRouter, Google Vertex, and Ollama.

## Quick Start

### Installation

```bash
# Install globally using npm
npm install -g @polka-codes/cli

# Or run directly using npx
npx @polka-codes/cli "your task description"
```

### Example Workflow

```bash
# 1. Create a detailed implementation plan
polka plan --plan-file auth.plan.md "Implement JWT-based auth"

# 2. Implement the plan
polka code --file auth.plan.md

# 3. Fix any issues that arise
polka fix "bun test"

# 4. Commit your changes with an AI-generated message
polka commit -a

# 5. Create a pull request
polka pr
```

## Documentation

- [CLI README](packages/cli/README.md): command reference, installation details, configuration, environment variables, and usage tips.
- [MCP implementation notes](packages/cli/src/mcp/README.md): architecture and implementation details for MCP support.
- [AGENTS.md](AGENTS.md): contributor-facing architecture, conventions, and workflow guidance.
- [example.polkacodes.yml](example.polkacodes.yml): commented configuration example.

## Configuration Overview

Polka Codes reads project configuration from `.polkacodes.yml`. Define runnable project automation under `scripts`:

```yaml
scripts:
  test:
    command: bun test
    description: Run the test suite
  check:
    command: bun check
    description: Run type checking and linting
  format:
    command: bun fix
    description: Format code and fix lint issues
```

You can also configure model providers, agent rules, MCP servers, tool formatting, and file exclusions. See the [CLI configuration reference](packages/cli/README.md#configuration) and [`example.polkacodes.yml`](example.polkacodes.yml) for details.

## Environment Variables

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

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.0.0 or higher.
- [ripgrep](https://github.com/BurntSushi/ripgrep#installation), required by the file search tool.

### Setup

```bash
git clone https://github.com/polka-codes/polka-codes.git
cd polka-codes
bun install
```

### Repository Scripts

- `bun build`: build all packages.
- `bun lint`: check linting and formatting.
- `bun fix`: automatically fix linting and formatting issues.
- `bun check`: run type checking and linting.
- `bun typecheck`: run type checking only.
- `bun test`: run tests across all packages.
- `bun clean`: remove build artifacts.
- `bun cli`: run the CLI in development mode.
- `bun pr`: shortcut for `bun cli pr`.
- `bun commit`: shortcut for `bun cli commit`.
- `bun codegen`: generate GraphQL types for the GitHub package.

## Project Structure

| Package | Description |
|---|---|
| [`core`](packages/core) | Core AI services, agent implementations, configuration schemas, and tooling. |
| [`cli`](packages/cli) | Command-line interface for interacting with AI services. |
| [`cli-shared`](packages/cli-shared) | Shared utilities and types for CLI packages. |
| [`github`](packages/github) | GitHub integration, including the GitHub Action. |
| [`runner`](packages/runner) | Service for running agents and managing tasks. |

## Contributing

If you are contributing to this project, read [AGENTS.md](AGENTS.md) for project architecture, code conventions, tool system patterns, workflow guidance, and implementation notes.

## License

This project is licensed under the [AGPL-3.0 License](LICENSE).

## Credits

This project is heavily inspired by the [Cline](https://github.com/cline/cline) project.

---

*Generated by polka.codes*
