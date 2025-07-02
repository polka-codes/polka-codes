import { Policies } from '../../config'
import { dirname, join } from '../../path'
import { listFiles, readFile, updateKnowledge, writeToFile } from '../../tools'
import { getString, getStringArray } from '../../tools/utils'
import type { AgentPolicy } from '../AgentBase'
import type { AssistantMessageContent } from '../parseAssistantMessage'

const prompt = `
====

# Knowledge Extraction & Maintenance

You are equipped with **Knowledge Management** capabilities:

1. **What to capture**
   - Public API of each file (public classes, functions, methods, parameters, return types).
   - High-level description of each file's purpose.
   - Invariants and assumptions that must always hold.
   - Project or directory-specific coding patterns, styles, and architectural conventions.
   - Any other insight that a future contributor would find crucial.

2. **Where to store it**
   - Save knowledge in a YAML file named \`knowledge.ai.yml\`.
   - **Create the file in the repository root if it does not yet exist.**
   - One file per directory.
     - The repository root file records knowledge that applies project-wide (e.g., service responsibilities, global patterns).
     - Each sub-directory keeps only the knowledge relevant to that directory or package.
   - Use clear top-level keys such as \`description\`, \`files\`, \`rules\`.

3. **When to update**
   - **Default behaviour:** only create / update knowledge for the files you actively read, create, or modify during the current task.
     - Operate on other files **only if the user explicitly requests it**.
   - **While working**: after reading, analysing, creating, or modifying code, immediately record any new or changed knowledge.
   - **On refactor / deletion**: locate and delete or amend obsolete entries so that knowledge never drifts from the codebase.
   - **Granularity**: update only the affected directory's \`knowledge.ai.yml\`, except when the change has global impact.

4. **How to format (illustrative)**
\`\`\`yaml
description: "description of the directory"
files:
  "math.ts":
    description: "Numeric helpers for currency calculations"
    api:
      functions:
        1: add(a: number, b: number): number
rules:
  1: "rules that apply to all files in this directory"
\`\`\`

5. **Source of truth**
   - **Never invent knowledge.** Everything you record must be *directly derived* from existing code, comments, commit messages, or explicit user instructions.
   - If a section has no confirmed content, omit it rather than guessing.

6. **Automatic context**
   When you are asked to read or modify a file, the orchestration layer will supply any existing knowledge for that path automatically. Use it, refine it, and keep it accurate.

7. **Using the updateKnowledge tool**
   You can use the \`updateKnowledge\` tool to efficiently update knowledge files with smart merging capabilities.

8. **Dictionary-First Format**
   - **Always prefer dictionaries** for structured data.
   - The **\`files\` section must be a dictionary keyed by file path** (e.g., \`"math.ts": {...}\`).
   - For other lists (rules, functions, etc.), use numbered dictionaries.
   - Arrays are allowed only when strict ordering is essential and dictionaries cannot express it.
   - When removing items, refer to them by their numeric key or index; gaps are fine.

Your workflow **must**:
   1. Detect knowledge deltas.
   2. Create \`knowledge.ai.yml\` if missing and write edits to the correct file.
   3. Remove stale facts.
   4. Use provided tools to update the knowledge files.
   5. Record only evidence-based information; do not hallucinate.
   6. Use dictionaries throughout, with numbered dictionaries for ordered data and path-keyed dictionaries for the \`files\` section.
`

export const KnowledgeManagementPolicy = (tools: Parameters<AgentPolicy>[0]) => {
  if (!tools[readFile.name]) {
    return undefined
  }

  // keep a cache of all knowledge files read to we don't read the same file twice
  const readFiles = new Set<string>()

  return {
    name: Policies.KnowledgeManagement,
    tools: tools[writeToFile.name] ? [updateKnowledge] : [],
    prompt: tools[writeToFile.name] || tools[updateKnowledge.name] ? prompt : undefined,
    async getKnowledgeFilePaths(inputFiles: string[]) {
      const paths = new Set<string>()

      for (const file of inputFiles) {
        // add all directories to the paths set
        let dir = dirname(file)
        paths.add(dir)

        // add all parent directories to the paths set
        while (dir !== '.') {
          paths.add(dir)
          dir = dirname(dir)
        }
      }

      const allFullPaths = []
      for (const path of paths) {
        if (path === '.') {
          continue
        }
        const fullpath = join(path, 'knowledge.ai.yml')
        if (!readFiles.has(fullpath)) {
          allFullPaths.push(fullpath)
          readFiles.add(fullpath)
        }
      }

      return allFullPaths
    },
    async updateResponse(response: AssistantMessageContent[]) {
      const files = new Set<string>()

      for (const content of response) {
        if (content.type === 'tool_use') {
          switch (content.name) {
            case readFile.name: {
              const paths = getStringArray(content.params, 'path')
              for (const path of paths) {
                files.add(path)
              }
              break
            }
            case listFiles.name: {
              const path = getString(content.params, 'path')
              files.add(path)
              break
            }
          }
        }
      }

      const allFullPaths = await this.getKnowledgeFilePaths(Array.from(files))

      if (allFullPaths.length === 0) {
        return response
      }

      return [
        ...response,
        {
          type: 'tool_use',
          name: readFile.name,
          params: {
            path: allFullPaths.join(','),
          },
        } as const,
      ]
    },
  }
}

export type KnowledgeManagementPolicyInstance = NonNullable<ReturnType<typeof KnowledgeManagementPolicy>>
