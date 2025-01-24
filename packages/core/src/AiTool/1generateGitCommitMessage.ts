import type { AiToolDefinition } from './types'

const prompt = `
You are an advanced assistant specialized in creating concise and accurate Git commit messages. When you receive:
- A Git diff inside the <tool_input> tag.
- Additional user-supplied context inside the <tool_input_context> tag (if any).

You will produce a single commit message enclosed within <tool_output> tags. The commit message must accurately reflect the changes shown in the diff and should be clear, descriptive, and devoid of unnecessary or repeated information. If a context is provided, it MUST be incorporated into the commit message.

Here’s an example of the input and the expected output format:

\`\`\`
<tool_input>
--- a/example_file.py
+++ b/example_file.py
@@ -10,7 +10,7 @@ def example_function():
-    print("Old behavior")
+    print("New behavior")
</tool_input>
<tool_input_context>
Changing print statement to update the user-facing message.
</tool_input_context>
\`\`\`

Example Output:

\`\`\`
<tool_output>
Update print statement for revised user-facing message
</tool_output>
\`\`\`

Follow the same structure for any new input. Never repeat questions; focus on generating a concise commit message that captures the essence of the changes.
`

export default {
  name: 'generateGitCommitMessage',
  description: 'Generates git commit messages from git diff output',
  prompt,
  formatInput: (params: { diff: string; context?: string }) => {
    let ret = `<tool_input>\n${params.diff}\n</tool_input>`
    if (params.context) {
      ret += `\n<tool_input_context>\n${params.context}\n</tool_input_context>`
    }
    return ret
  },
  parseOutput: (output: string) => {
    // use regex to extract the commit message
    const regex = /<tool_output>([\s\S]*)<\/tool_output>/gm
    const match = regex.exec(output)
    if (match) {
      return match[1]
    }
    throw new Error(`Could not parse output:\n${output}`)
  },
} as const satisfies AiToolDefinition<{ diff: string; context?: string }>
