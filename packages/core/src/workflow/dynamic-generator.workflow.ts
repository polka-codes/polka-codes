import { z } from 'zod'
import { type AgentToolRegistry, agentWorkflow } from './agent.workflow'
import { type WorkflowFile, WorkflowFileSchema } from './dynamic-types'
import type { WorkflowFn } from './workflow'

export const GenerateWorkflowDefinitionInputSchema = z.object({
  prompt: z.string(),
  availableTools: z
    .array(
      z.object({
        name: z.string(),
        description: z.string(),
      }),
    )
    .optional(),
})

export type GenerateWorkflowDefinitionInput = z.infer<typeof GenerateWorkflowDefinitionInputSchema>

export const GenerateWorkflowCodeInputSchema = z.object({
  workflow: WorkflowFileSchema,
})

export type GenerateWorkflowCodeInput = z.infer<typeof GenerateWorkflowCodeInputSchema>

const WORKFLOW_DEFINITION_SYSTEM_PROMPT = `You are an expert workflow architect.
Your task is to create a JSON workflow definition based on the user's request.

The workflow definition must follow this structure:
{
  "workflows": {
    "workflowName": {
      "task": "Description of the workflow",
      "inputs": [
        { "id": "inputName", "description": "Description", "default": "optionalDefault" }
      ],
      "steps": [
        {
          "id": "stepId",
          "task": "Description of the step",
          "tools": ["toolName1", "toolName2"], // Optional list of tools needed
          "output": "outputVariableName", // Optional
        }
      ],
      "output": "outputVariableName" // Optional
    }
  }
}

Constraints:
- Break down complex tasks into logical steps.
- Define clear inputs and outputs.

Example 1:
User: "Research a topic and summarize it."
Output:
\`\`\`json
{
  "workflows": {
    "researchAndSummarize": {
      "task": "Research a topic and provide a summary",
      "inputs": [
        { "id": "topic", "description": "The topic to research" }
      ],
      "steps": [
        {
          "id": "search",
          "task": "Search for information about the topic",
          "tools": ["search"],
          "output": "searchResults"
        },
        {
          "id": "summarize",
          "task": "Summarize the search results",
          "tools": ["generateText"],
          "output": "summary"
        }
      ],
      "output": "summary"
    }
  }
}
\`\`\`

Example 2:
User: "Review urgent PRs. For each PR, run the review workflow."
Output:
\`\`\`json
{
  "workflows": {
    "reviewUrgentPRs": {
      "task": "Fetch urgent PRs and review them",
      "inputs": [],
      "steps": [
        {
          "id": "fetchPRs",
          "task": "Fetch list of urgent PRs",
          "tools": ["github_list_prs"],
          "output": "prs"
        },
        {
          "id": "reviewEachPR",
          "task": "Run review workflow for each PR",
          "tools": [],
          "output": "reviews"
        }
      ],
      "output": "reviews"
    },
    "reviewPR": {
      "task": "Review a single PR",
      "inputs": [
        { "id": "prId", "description": "ID of the PR to review" }
      ],
      "steps": [
        {
          "id": "getDiff",
          "task": "Get PR diff",
          "tools": ["github_get_diff"],
          "output": "diff"
        },
        {
          "id": "analyze",
          "task": "Analyze the diff",
          "tools": ["generateText"],
          "output": "analysis"
        }
      ],
      "output": "analysis"
    }
  }
}
\`\`\`
`

const WORKFLOW_CODE_SYSTEM_PROMPT = `You are an expert TypeScript developer.
Your task is to implement the TypeScript code for the steps in the provided workflow definition.

You will receive a JSON workflow definition where the "code" field is null.
You must fill in the "code" field for each step with valid TypeScript code.

The code will be executed in an async function with the following signature:
async (ctx) => {
  // Your code here
}

The \`ctx\` object provides access to:
- \`ctx.input\`: The workflow inputs.
- \`ctx.state\`: A shared state object for passing data between steps.
- \`ctx.tools\`: An object containing available tools.
- \`ctx.runWorkflow\`: (workflowId: string, input?: any) => Promise<any>. Use this to run other workflows.

Guidelines:
- Use \`await\` for asynchronous operations.
- Return the output value of the step.
- Access inputs via \`ctx.input.inputName\`.
- Access previous step outputs via \`ctx.state.stepOutputName\`.
- Use \`ctx.tools.invokeTool({ toolName: 'name', input: { ... } })\` to call tools.
- Use \`ctx.tools.generateText({ messages: [...] })\` for LLM calls.
- Use \`ctx.tools.invokeTool({ toolName: 'runAgent', input: { prompt: '...' } })\` for complex sub-tasks that require multiple steps or tools. Prefer this over \`generateText\` for advanced tasks.

Example Code for a step:
\`\`\`typescript
const searchResults = await ctx.tools.invokeTool({
  toolName: 'search',
  input: { query: ctx.input.topic }
});
return searchResults;
\`\`\`

Example Code for LLM step:
\`\`\`typescript
const summary = await ctx.tools.generateText({
  messages: [
    { role: 'system', content: 'Summarize the following text.' },
    { role: 'user', content: ctx.state.searchResults }
  ]
});
return summary;
\`\`\`

Example Code for runAgent:
\`\`\`typescript
const result = await ctx.tools.invokeTool({
  toolName: 'runAgent',
  input: {
    prompt: 'Research the history of the internet and write a summary.',
    tools: ['search', 'generateText']
  }
});
return result;
\`\`\`

Example Code for invoking a sub-workflow:
\`\`\`typescript
const results = [];
for (const pr of ctx.state.prs) {
  const review = await ctx.runWorkflow('reviewPR', { prId: pr.id });
  results.push(review);
}
return results;
\`\`\`

Return the complete workflow JSON with the "code" fields populated.
`

export const generateWorkflowDefinitionWorkflow: WorkflowFn<GenerateWorkflowDefinitionInput, WorkflowFile, AgentToolRegistry> = async (
  input,
  ctx,
) => {
  let systemPrompt = WORKFLOW_DEFINITION_SYSTEM_PROMPT
  if (input.availableTools && input.availableTools.length > 0) {
    const toolsList = input.availableTools.map((t) => `- ${t.name}: ${t.description}`).join('\n')
    systemPrompt += `\n\nAvailable Tools:\n${toolsList}\n\nUse these tools when appropriate.`
  }

  const result = await ctx.step('generate-workflow-definition', async () => {
    return agentWorkflow(
      {
        systemPrompt,
        userMessage: [{ role: 'user', content: input.prompt }],
        tools: [],
        outputSchema: WorkflowFileSchema,
      },
      ctx,
    )
  })

  if (result.type === 'Exit' && result.object) {
    return result.object as WorkflowFile
  }
  throw new Error('Failed to generate workflow definition')
}

export const generateWorkflowCodeWorkflow: WorkflowFn<GenerateWorkflowCodeInput, WorkflowFile, AgentToolRegistry> = async (input, ctx) => {
  const result = await ctx.step('generate-workflow-code', async () => {
    return agentWorkflow(
      {
        systemPrompt: WORKFLOW_CODE_SYSTEM_PROMPT,
        userMessage: [{ role: 'user', content: JSON.stringify(input.workflow, null, 2) }],
        tools: [],
        outputSchema: WorkflowFileSchema,
      },
      ctx,
    )
  })

  if (result.type === 'Exit' && result.object) {
    return result.object as WorkflowFile
  }
  throw new Error('Failed to generate workflow code')
}
