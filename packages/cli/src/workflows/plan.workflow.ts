import type { Workflow } from '@polka-codes/workflow'
import { z } from 'zod'
import type { WorkflowTools } from '../workflow-tools'

export type PlanWorkflowInput = {
  task: string
  fileContent?: string
  filePath?: string
}

const PlanSchema = z.object({
  plan: z.string().optional(),
  ready: z.boolean(),
  question: z.string().optional(),
})

const PLAN_PROMPT = `
You are an expert planner. Your goal is to create a detailed plan for a given task.

The user has provided a task:
<task>
{task}
</task>

And optionally, the content of an existing plan file:
<plan_file>
{fileContent}
</plan_file>

Your tasks are:
1.  Analyze the task and the existing plan (if any).
2.  If the requirements are clear and you can generate or update the plan, set "ready" to true and provide the plan in the "plan" field.
3.  If the requirements are not clear, set "ready" to false and ask a clarifying question in the "question" field.

Respond with a JSON object that matches the following schema:
{
  "plan": "The generated or updated plan.",
  "ready": true,
  "question": "The clarifying question to ask the user."
}
`

import type { PlainJson } from '@polka-codes/workflow'

export const planWorkflow: Workflow<PlanWorkflowInput, PlainJson, WorkflowTools> = {
  name: 'Plan Task',
  description: 'Create or update a plan for a given task.',
  async *fn(input, _step, tools) {
    const { task, fileContent, filePath } = input
    let plan = fileContent || ''
    let isPlanReady = false
    let userFeedback = ''

    while (true) {
      const currentTask = userFeedback ? `${task}\n\nUser feedback: ${userFeedback}` : task
      const prompt = PLAN_PROMPT.replace('{task}', currentTask).replace('{fileContent}', plan)
      const {
        plan: newPlan,
        ready,
        question,
      } = yield* tools.invokeAgent({
        agent: 'architect',
        messages: [{ type: 'user', content: prompt }],
        outputSchema: PlanSchema,
      })

      if (newPlan !== undefined) {
        plan = newPlan
      }
      isPlanReady = ready

      if (!isPlanReady && question) {
        const answer = yield* tools.input({ message: question })
        userFeedback = `Question: ${question}\nAnswer: ${answer}`
        continue // Loop back to the agent with the user's answer
      }

      console.log('\nGenerated Plan:\n')
      console.log(plan)

      try {
        userFeedback = yield* tools.input({
          message: 'What changes do you want to make? (leave empty or press Ctrl+C to exit)',
        })
      } catch (_error) {
        // ExitPromptError is thrown on Ctrl+C
        userFeedback = ''
      }

      if (!userFeedback) {
        break // Exit the loop if the user provides no feedback
      }
    }

    const savePlan = yield* tools.confirm({ message: 'Do you want to save the plan?', default: false })

    if (savePlan) {
      let savePath = filePath
      if (!savePath) {
        savePath = yield* tools.input({ message: 'Where do you want to save the plan?', default: 'docs/plan.md' })
      }
      yield* tools.writeToFile({ path: savePath, content: plan })
      console.log(`Plan saved to ${savePath}`)
    }

    return {}
  },
}
