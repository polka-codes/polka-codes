import type { AiToolDefinition } from './types'

const prompt = `
You are given:
- A branch name in <tool_input_branch_name>.
- An optional context message in <tool_input_context> (which may or may not be present).
- One or more Git commits within <tool_input_commit> tags, each containing:
  - <tool_input_commit_message> (the commit message)
  - <tool_input_commit_diff> (the commit diff)

Your task:
1. Consider the optional context (if provided).
2. Analyze all commit messages and diffs.
3. Produce a single GitHub Pull Request title.
4. Produce a Pull Request description that explains the changes.

Output format:
<tool_output>
  <tool_output_pr_title>YOUR PR TITLE HERE</tool_output_pr_title>
  <tool_output_pr_description>YOUR PR DESCRIPTION HERE</tool_output_pr_description>
</tool_output>

Below is an **example** of the input and output:

Example Input:
<tool_input>
  <tool_input_branch_name>feature/refactor-logging</tool_input_branch_name>
  <tool_input_context>Focus on clean code and maintainability</tool_input_context>

  <tool_input_commit>
    <tool_input_commit_message>Remove debug logs</tool_input_commit_message>
    <tool_input_commit_diff>
diff --git a/user_service.py b/user_service.py
- print("Debug info")
+ # Removed debug print statements
    </tool_input_commit_diff>
  </tool_input_commit>

  <tool_input_commit>
    <tool_input_commit_message>Refactor order validation logic</tool_input_commit_message>
    <tool_input_commit_diff>
diff --git a/order_service.py b/order_service.py
- if is_valid_order(order):
-     process_order(order)
+ validate_and_process(order)
    </tool_input_commit_diff>
  </tool_input_commit>
</tool_input>

Example Output:
<tool_output>
  <tool_output_pr_title>Refactor Order Validation and Remove Debug Logs</tool_output_pr_title>
  <tool_output_pr_description>
    This PR removes unnecessary debug print statements and updates order validation
    to use a new validate_and_process method for improved maintainability.
  </tool_output_pr_description>
</tool_output>

---

Use the above format whenever you receive \`<tool_input>\` that may include a branch name, an optional context, and multiple commits. Provide your final output strictly in \`<tool_output>\` with \`<tool_output_pr_title>\` and \`<tool_output_pr_description>\`.
`

type Input = {
  commits: { message: string; diff: string }[]
  context?: string
  branchName: string
}

type Output = {
  title: string
  description: string
}

export default {
  name: 'generateGithubPullRequestDetails',
  description: 'Generates a GitHub pull request title and description from git commits',
  prompt,
  formatInput: (params: Input) => {
    return `<tool_input>
<tool_input_branch_name>${params.branchName}</tool_input_branch_name>${params.context ? `\n<tool_input_context>${params.context}</tool_input_context>` : ''}
${params.commits
  .map(
    (commit) => `\n<tool_input_commit>
<tool_input_commit_message>${commit.message}</tool_input_commit_message>
<tool_input_commit_diff>
${commit.diff}
</tool_input_commit_diff>
</tool_input_commit>`,
  )
  .join('')}
</tool_input>`
  },
  parseOutput: (output: string): Output => {
    const regex = /<tool_output>([\s\S]*)<\/tool_output>/gm
    const match = regex.exec(output)
    if (!match) {
      throw new Error(`Could not parse output:\n${output}`)
    }
    const [, outputContent] = match
    const titleRegex = /<tool_output_pr_title>([\s\S]*)<\/tool_output_pr_title>/gm
    const titleMatch = titleRegex.exec(outputContent)
    const descriptionRegex = /<tool_output_pr_description>([\s\S]*)<\/tool_output_pr_description>/gm
    const descriptionMatch = descriptionRegex.exec(outputContent)

    if (titleMatch && descriptionMatch) {
      return {
        title: titleMatch[1],
        description: descriptionMatch[1],
      }
    }

    throw new Error(`Could not parse output:\n${output}`)
  },
} as const satisfies AiToolDefinition<Input, Output>
