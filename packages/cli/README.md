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

### `code`

Generate code based on a description.

```bash
polka code "create a React component for a login form"
```

### `plan`

Create an implementation plan for a new feature or refactor.

```bash
polka plan "refactor the database schema to support multi-tenancy"
```

### `epic`

Break down a large task into smaller, manageable sub-tasks.

```bash
polka epic "build a new e-commerce platform"
```

### `fix`

Identify and fix bugs in your codebase by running a command (like tests) and letting Polka fix the issues.

```bash
polka fix "npm test"
```

### `review`

Review a pull request.

```bash
polka review --pr 123
```

### `meta`

The `meta` command orchestrates complex workflows by running other commands in sequence. It's used internally by the CLI but can also be used for advanced use cases.

### `init`

Initialize Polka Codes configuration for your project.

```bash
# Create local config
polka init

# Create global config
polka init --global
```

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
