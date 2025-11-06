export function getPlanPrompt(task: string, planContent?: string): string {
  const planSection = planContent ? `\nThe content of an existing plan file:\n<plan_file>\n${planContent}\n</plan_file>\n` : ''

  return `# Task Input

The user has provided a task:
<task>
${task}
</task>
${planSection}`
}
