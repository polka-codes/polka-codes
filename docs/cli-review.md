<memory topic="plan">
# CLI Commands Review and Improvement Plan

This document outlines a review of the CLI commands in the `polka-codes` project. It identifies issues, proposes improvements, and suggests a plan for implementation.

## General Observations

- **Inconsistent Logging**: The logger is created in each command file, but the verbosity is handled differently. Some commands use `verbose`, while others don't. This should be standardized.
- **Error Handling**: Error handling is inconsistent. Some commands have `try...catch` blocks, while others don't. A consistent error handling strategy should be implemented.
- **User Input**: The `getUserInput` function is used in some commands to prompt the user for input, while others use `@inquirer/prompts`. The CLI should be consistent and use one or the other.
- **Code Duplication**: There is some code duplication, for example, in how the logger is created and how global options are retrieved. This could be refactored into utility functions.
- **Docstrings and Comments**: Some commands have good comments and docstrings, while others don't. The code should be consistently documented.

## Command-Specific Review

### `code` command

- **Issue**: The `readStdin` function has a hardcoded timeout of 1000ms. This might not be long enough for large inputs.
- **Recommendation**: Make the timeout configurable or increase it to a more reasonable value (e.g., 5000ms).
- **Issue**: The command reads files and encodes them in base64. This could be memory-intensive for large files.
- **Recommendation**: For large files, consider streaming the content or implementing a more memory-efficient way of handling them.
- **Issue**: The command automatically provides a task "Implement the changes based on the provided files." when files are provided but no task is given.
- **Recommendation**: While this is a good default, it might be better to ask the user for a more specific task, or at least inform them about the default task being used.

### `commit` command

- **Issue**: The term "context" for the optional `message` argument is vague.
- **Recommendation**: Clarify in the command's description and help text what kind of information the user should provide as "context". For example, "Provide a brief summary of the changes to guide the AI in writing the commit message."
- **Issue**: The `-a, --all` option stages all files without confirmation.
- **Recommendation**: Before staging all files, show the user a list of files that will be staged and ask for confirmation.

### `epic` command

- **Issue**: The command uses `@inquirer/prompts` for user input, which is inconsistent with other commands.
- **Recommendation**: Replace `@inquirer/prompts` with the `getUserInput` utility function for consistency.
- **Issue**: The "epic context" is not well-documented.
- **Recommendation**: Improve the documentation to explain what the "epic context" is, how it's stored, and how it's used in the workflow.

### `fix` command

- **Issue**: The `--task` option's description is a bit generic.
- **Recommendation**: Provide examples of good task descriptions in the command's help text.

### `init` command

- **Issue**: The difference between local and global configuration is not explained.
- **Recommendation**: Add a section to the documentation explaining the configuration scope (`--global` vs. local) and when to use each.

### `meta` command

- **Issue**: The `meta` command is very similar to the `code` and `epic` commands, and its purpose is not clear.
- **Recommendation**: Clarify the purpose of the `meta` command. If it's a synonym for `epic`, it should be deprecated and removed. If it has a distinct purpose, it should be clearly documented.

### `plan` command

- **Issue**: The format of the plan file is not documented.
- **Recommendation**: Document the expected format of the plan file and provide an example.

### `pr` command

- **Issue**: The term "context" for the optional `message` argument is vague.
- **Recommendation**: Clarify in the command's description and help text what kind of information the user should provide as "context". For example, "Provide a brief summary of the changes to guide the AI in writing the pull request description."

### `review` command

- **Issue**: The `--loop` option could lead to infinite loops.
- **Recommendation**: While there is a `maxIterations` limit, it would be good to add a check to see if the agent is making progress. If the code remains the same after a review and fix cycle, the loop should be terminated.
- **Issue**: The `--yes` option automatically applies review feedback, which can be risky.
- **Recommendation**: Before applying the changes, show the user a diff of the proposed changes and ask for confirmation.
- **Issue**: The command uses `@inquirer/prompts` for user input, which is inconsistent with other commands.
- **Recommendation**: Replace `@inquirer/prompts` with the `getUserInput` utility function for consistency.

## Implementation Plan

- [ ] Create a new file `docs/cli-review.md` and add the content of this review to it.
- [ ] Create a new file `docs/cli-cookbook.md` to document the commands, their options, and provide examples.
- [ ] Refactor the CLI commands to address the issues identified in this review. This will be a larger effort that can be broken down into smaller tasks.

</memory>