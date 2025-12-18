import { z } from 'zod'
import { type AgentToolRegistry, agentWorkflow } from './agent.workflow'
import { type WorkflowFile, WorkflowFileSchema } from './dynamic-types'
import { CODE_FIELD_CONSTRAINTS, composeImplementationGuidelines, QUALITY_GUIDELINES } from './prompts/dynamic-generator-prompts'
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
    .nullish(),
})

export type GenerateWorkflowDefinitionInput = z.infer<typeof GenerateWorkflowDefinitionInputSchema>

export const GenerateWorkflowCodeInputSchema = z.object({
  workflow: WorkflowFileSchema,
  skipReview: z.boolean().nullish(),
})

export type GenerateWorkflowCodeInput = z.infer<typeof GenerateWorkflowCodeInputSchema>

export type WorkflowValidationResult = {
  valid: boolean
  errors: string[]
}

const AsyncFunction = Object.getPrototypeOf(async () => {}).constructor as new (arg1: string, arg2: string) => (ctx: any) => Promise<any>

/**
 * Validates a workflow definition for structural correctness.
 */
export function validateWorkflowDefinition(workflow: WorkflowFile): WorkflowValidationResult {
  const errors: string[] = []

  if (!workflow.workflows.main) {
    errors.push("Missing required 'main' workflow")
  }

  for (const [wfId, wf] of Object.entries(workflow.workflows)) {
    const stepIds = new Set<string>()
    for (const step of wf.steps) {
      if (stepIds.has(step.id)) {
        errors.push(`Duplicate step ID '${step.id}' in workflow '${wfId}'`)
      }
      stepIds.add(step.id)
    }
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Validates the code syntax for all steps in a workflow.
 */
export function validateWorkflowCodeSyntax(workflow: WorkflowFile): WorkflowValidationResult {
  const errors: string[] = []

  for (const [wfId, wf] of Object.entries(workflow.workflows)) {
    for (const step of wf.steps) {
      if (step.code) {
        try {
          new AsyncFunction('ctx', step.code)
        } catch (e) {
          const errorMsg = e instanceof Error ? e.message : String(e)
          errors.push(`Syntax error in ${wfId}.${step.id}: ${errorMsg}`)
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

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
          "tools": ["toolName1", "toolName2"], // Optional: restrict which tools can be used. Can use groups: "readonly", "readwrite", "internet", "all".
          "output": "outputVariableName", // Optional: defaults to step id
          "timeout": 30000, // Optional: timeout in milliseconds
          "expected_outcome": "What this step produces", // Optional: documentation for expected results
          "outputSchema": { "type": "object" } // Optional: validation schema
        }
      ],
      "output": "outputVariableName" // Optional
    }
  }
}

Constraints:
- You MUST always include a workflow named 'main'. This is the entry point.
- The 'main' workflow input must be either empty (no input) or a single string input.
- Break down complex tasks into logical steps.
- Define clear inputs and outputs.

Quality Guidelines:
- Add "timeout" field (in milliseconds) for steps that might take long (file I/O, API calls, searches)
- Use "expected_outcome" field to document what each step should produce and its format
- Use descriptive step IDs (e.g., "validateInput", "fetchUserData", not "step1", "step2")
- Design steps to be focused - one responsibility per step
- For steps that process multiple items, consider creating a sub-workflow
- Add "outputSchema" with type information for validation-critical steps
- Order steps logically with clear data flow

### Using expected_outcome Effectively

The "expected_outcome" field helps document what each step produces. Best practices:
- Describe the data structure: "Returns an array of { id, name, status } objects"
- Mention important constraints: "Returns at most 10 results, sorted by date"
- Note failure modes: "Returns null if file not found"
- Document side effects: "Creates output directory if it doesn't exist"

Example 1 - Research workflow:
User: "Research a topic and summarize it."
Output:
\`\`\`json
{
  "workflows": {
    "main": {
      "task": "Research a topic and provide a summary",
      "inputs": [
        { "id": "topic", "description": "The topic to research" }
      ],
      "steps": [
        {
          "id": "search",
          "task": "Search for information about the topic",
          "tools": ["search"],
          "output": "searchResults",
          "timeout": 30000,
          "expected_outcome": "Returns search results with titles, URLs, and snippets related to the topic"
        },
        {
          "id": "summarize",
          "task": "Summarize the search results",
          "tools": ["runAgent"],
          "output": "summary",
          "expected_outcome": "Returns a concise summary string (2-3 paragraphs) of the key findings"
        }
      ],
      "output": "summary"
    }
  }
}
\`\`\`

Example 2 - PR review workflow with sub-workflow:
User: "Review urgent PRs. For each PR, run the review workflow."
Output:
\`\`\`json
{
  "workflows": {
    "main": {
      "task": "Fetch urgent PRs and review them",
      "inputs": [],
      "steps": [
        {
          "id": "fetchPRs",
          "task": "Fetch list of urgent PRs",
          "tools": ["github_list_prs"],
          "output": "prs",
          "timeout": 15000,
          "expected_outcome": "Returns array of PR objects with { id, title, author, url }"
        },
        {
          "id": "reviewEachPR",
          "task": "Run review workflow for each PR",
          "tools": [],
          "output": "reviews",
          "expected_outcome": "Returns array of review results, one per PR"
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
          "output": "diff",
          "timeout": 10000,
          "expected_outcome": "Returns the unified diff string for the PR"
        },
        {
          "id": "analyze",
          "task": "Analyze the diff and provide feedback",
          "tools": ["runAgent"],
          "output": "analysis",
          "expected_outcome": "Returns { summary, issues, suggestions } object with review feedback"
        }
      ],
      "output": "analysis"
    }
  }
}
\`\`\`

Example 3 - File processing with conditional logic:
User: "Process all JSON files in a directory, validate them, and generate a report."
Output:
\`\`\`json
{
  "workflows": {
    "main": {
      "task": "Process and validate JSON files, then generate a report",
      "inputs": [
        { "id": "directory", "description": "Directory containing JSON files", "default": "data" }
      ],
      "steps": [
        {
          "id": "listJsonFiles",
          "task": "List all JSON files in the directory",
          "tools": ["listFiles"],
          "output": "jsonFiles",
          "timeout": 5000,
          "expected_outcome": "Returns array of file paths ending in .json"
        },
        {
          "id": "processFiles",
          "task": "Process each JSON file using the processFile sub-workflow",
          "tools": [],
          "output": "processedResults",
          "expected_outcome": "Returns array of { file, valid, errors?, data? } for each file"
        },
        {
          "id": "generateReport",
          "task": "Generate a summary report of all processed files",
          "tools": ["writeToFile"],
          "output": "reportPath",
          "expected_outcome": "Writes report to 'report.md' and returns the file path"
        }
      ],
      "output": "reportPath"
    },
    "processFile": {
      "task": "Process and validate a single JSON file",
      "inputs": [
        { "id": "filePath", "description": "Path to the JSON file" }
      ],
      "steps": [
        {
          "id": "readFile",
          "task": "Read the JSON file content",
          "tools": ["readFile"],
          "output": "content",
          "timeout": 3000,
          "expected_outcome": "Returns file content as string, or null if not found"
        },
        {
          "id": "validateJson",
          "task": "Parse and validate the JSON structure",
          "tools": [],
          "output": "validationResult",
          "expected_outcome": "Returns { valid: boolean, data?: object, errors?: string[] }"
        }
      ],
      "output": "validationResult"
    }
  }
}
\`\`\`
`

const WORKFLOW_IMPLEMENTATION_GUIDELINES = composeImplementationGuidelines()

const WORKFLOW_CODE_SYSTEM_PROMPT = `You are an expert TypeScript developer.
Your task is to implement the TypeScript code for the steps in the provided workflow definition.

You will receive a JSON workflow definition where the "code" field is null.
You must fill in the "code" field for each step with valid TypeScript code.

CRITICAL: Each step "code" field must contain ONLY the function body statements (the code inside the curly braces).
DO NOT include function declaration, arrow function syntax, async keyword, parameter list, or outer curly braces.

Prefer using \`ctx.tools.runAgent\` for complex tasks or when multiple steps/tools are needed. Use \`ctx.agentTools\` for direct tool usage (e.g. \`ctx.agentTools.readFile\`).

The code will be wrapped automatically in: \`async (ctx) => { YOUR_CODE_HERE }\`

Example of CORRECT code field:
\`\`\`ts
const result = await ctx.agentTools.readFile({ path: 'README.md' })
if (!result) throw new Error('File not found')
return result
\`\`\`

Example of INCORRECT code field (DO NOT DO THIS):
\`\`\`ts
async (ctx) => {
  const result = await ctx.agentTools.readFile({ path: 'README.md' })
  return result
}
\`\`\`

${WORKFLOW_IMPLEMENTATION_GUIDELINES}

## Final Instructions

${CODE_FIELD_CONSTRAINTS}

Return the complete workflow JSON with the "code" fields populated.
`

const WORKFLOW_REVIEW_SYSTEM_PROMPT = `You are an expert TypeScript Code Reviewer.
Your task is to review the provided workflow definition and its implemented code, and improve it to meet the highest quality standards.

You will receive a JSON workflow definition where the "code" fields are already populated.
You must review each step's code and improve it if necessary.

Check for:
- Correct usage of \`ctx.agentTools\` (for standard tools) and \`ctx.tools\` (for workflow helpers).
- Proper error handling (try-catch, input validation).
- Meaningful logging.
- Adherence to the Quality Guidelines.
- Correct syntax (no outer function wrappers).

${QUALITY_GUIDELINES}

## Final Instructions

Return the complete workflow JSON with the "code" fields improved where necessary.
Ensure the "code" field still contains ONLY the function body statements.
`

const MAX_GENERATION_ATTEMPTS = 3

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

  if (result.type !== 'Exit' || !result.object) {
    throw new Error('Failed to generate workflow definition')
  }

  const workflow = result.object as WorkflowFile

  await ctx.step('validate-workflow-definition', async () => {
    const validation = validateWorkflowDefinition(workflow)
    if (!validation.valid) {
      ctx.logger.warn(`Workflow definition validation warnings: ${validation.errors.join('; ')}`)
    }
    return validation
  })

  return workflow
}

export const generateWorkflowCodeWorkflow: WorkflowFn<GenerateWorkflowCodeInput, WorkflowFile, AgentToolRegistry> = async (input, ctx) => {
  let lastError: string | null = null
  let currentWorkflow = input.workflow

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const stepName = attempt === 0 ? 'generate-workflow-code' : `retry-workflow-code-${attempt}`

    const userMessage = lastError
      ? `Previous attempt had issues: ${lastError}\n\nPlease fix the problems in this workflow:\n${JSON.stringify(currentWorkflow, null, 2)}`
      : JSON.stringify(currentWorkflow, null, 2)

    const generated = await ctx.step(stepName, async () => {
      return agentWorkflow(
        {
          systemPrompt: WORKFLOW_CODE_SYSTEM_PROMPT,
          userMessage: [{ role: 'user', content: userMessage }],
          tools: [],
          outputSchema: WorkflowFileSchema,
        },
        ctx,
      )
    })

    if (generated.type !== 'Exit' || !generated.object) {
      lastError = 'Failed to generate workflow code'
      continue
    }

    const generatedWorkflow = generated.object as WorkflowFile

    const syntaxValidation = await ctx.step(`validate-code-syntax-${attempt}`, async () => {
      return validateWorkflowCodeSyntax(generatedWorkflow)
    })

    if (!syntaxValidation.valid) {
      lastError = syntaxValidation.errors.join('; ')
      currentWorkflow = generatedWorkflow
      ctx.logger.warn(`Code syntax validation failed (attempt ${attempt + 1}): ${lastError}`)
      continue
    }

    if (input.skipReview) {
      return generatedWorkflow
    }

    const reviewed = await ctx.step('review-workflow-code', async () => {
      return agentWorkflow(
        {
          systemPrompt: WORKFLOW_REVIEW_SYSTEM_PROMPT,
          userMessage: [{ role: 'user', content: JSON.stringify(generatedWorkflow, null, 2) }],
          tools: [],
          outputSchema: WorkflowFileSchema,
        },
        ctx,
      )
    })

    if (reviewed.type !== 'Exit' || !reviewed.object) {
      throw new Error('Failed to review workflow code')
    }

    const reviewedWorkflow = reviewed.object as WorkflowFile

    const reviewSyntaxValidation = await ctx.step('validate-reviewed-code-syntax', async () => {
      return validateWorkflowCodeSyntax(reviewedWorkflow)
    })

    if (!reviewSyntaxValidation.valid) {
      ctx.logger.warn(`Reviewed code has syntax issues: ${reviewSyntaxValidation.errors.join('; ')}`)
      return generatedWorkflow
    }

    return reviewedWorkflow
  }

  throw new Error(`Failed to generate valid workflow code after ${MAX_GENERATION_ATTEMPTS} attempts: ${lastError}`)
}
