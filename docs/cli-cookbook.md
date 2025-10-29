# Polka Codes CLI Cookbook

Welcome to the Polka Codes CLI Cookbook! This guide provides a detailed overview of the available commands, their options, and usage examples.

## Global Options

These options can be used with any command:

-   `-c, --config <paths>`: Path to one or more configuration files.
-   `--api-provider <provider>`: Specifies the API provider to use (e.g., `openai`, `anthropic`).
-   `--model <model>`: Specifies the model ID to use.
-   `--api-key <key>`: Your API key for the selected provider.
-   `--max-messages <iterations>`: Sets the maximum number of messages to send in a conversation.
-   `--budget <budget>`: Sets the budget for the AI service.
-   `-v, --verbose`: Enables verbose output. Use `-v` for level 1 and `-vv` for level 2.
-   `-d, --base-dir <path>`: Specifies the base directory to run commands in.
-   `--file <path...>`: Includes one or more files in the task context.
-   `--silent`: Disables all output except for errors.
-   `-y, --yes`: Skips all interactive prompts and confirmations.

## Commands

### `polka [task]` (Default)

The default command analyzes your task and intelligently routes it to the most appropriate workflow (`code`, `task`, or `epic`).

**Syntax:**
`polka [task]`

**Arguments:**
-   `[task]`: A description of the feature, task, or epic you want to work on.

**Examples:**
-   `polka "add a new component for user login"`
-   `polka "refactor the authentication service to use JWT"`

### `code`

Plans and implements a feature or task using architect and coder agents.

**Syntax:**
`polka code [task]`

**Arguments:**
-   `[task]`: The task to plan and implement. Can also be provided via stdin.

**Examples:**
-   `polka code "create a new API endpoint for fetching user data"`
-   `cat task.txt | polka code`

### `commit`

Creates a commit with an AI-generated message based on your staged changes.

**Syntax:**
`polka commit [message]`

**Arguments:**
-   `[message]`: Optional context to guide the commit message generation.

**Options:**
-   `-a, --all`: Stage all tracked, modified files before committing.

**Examples:**
-   `polka commit`
-   `polka commit -a "Implement user authentication flow"`

### `epic`

Orchestrates a large feature or epic by breaking it down into smaller, manageable tasks.

**Syntax:**
`polka epic [task]`

**Arguments:**
-   `[task]`: A description of the epic to plan and implement.

**Examples:**
-   `polka epic "build a new e-commerce platform from scratch"`

### `fix`

Fixes issues by running a command and letting an agent resolve any errors.

**Syntax:**
`polka fix [command]`

**Arguments:**
-   `[command]`: The command to execute and fix (e.g., a failing test script).

**Options:**
-   `-t, --task <task>`: Provides specific instructions to the agent on how to fix the issue.

**Examples:**
-   `polka fix "bun test"`
-   `polka fix "bun build" --task "Fix the type errors in the build process."`

### `init`

Initializes the Polka Codes configuration for your project.

**Syntax:**
`polka init`

**Options:**
-   `-g, --global`: Creates a global configuration in your home directory.

**Examples:**
-   `polka init`
-   `polka init --global`

### `plan`

Creates or updates a plan for a given task.

**Syntax:**
`polka plan [task]`

**Arguments:**
-   `[task]`: The task you want to plan.

**Options:**
-   `-p, --plan-file <path>`: The path to a plan file to create or update.

**Examples:**
-   `polka plan "implement a dark mode feature"`
-   `polka plan "update the database schema" --plan-file ./docs/db_migration_plan.md`

### `pr`

Creates a GitHub pull request with an AI-generated title and body.

**Syntax:**
`polka pr [message]`

**Arguments:**
-   `[message]`: Optional context to guide the pull request description.

**Examples:**
-   `polka pr`
-   `polka pr "This PR closes issue #123 by fixing the login bug."`

### `review`

Reviews a GitHub pull request or local changes, providing feedback and optionally applying fixes.

**Syntax:**
`polka review`

**Options:**
-   `--pr <pr>`: The pull request number or URL to review.
-   `--json`: Outputs the review in JSON format.
-   `-y, --yes`: Automatically applies review feedback without prompting.
-   `--loop [count]`: Specifies the total number of review runs, applying feedback between each. Defaults to 3 if `[count]` is omitted.

**Examples:**
-   `polka review`
-   `polka review --pr 42`
-   `polka review --pr https://github.com/my-org/my-repo/pull/123 --yes --loop 3`
