import { dirname, join } from 'node:path'
import { Policies } from '../../config'
import { listFiles, readFile, writeToFile } from '../../tools'
import { getString, getStringArray } from '../../tools/utils'
import type { AgentPolicy } from '../AgentBase'

const prompt = `
====

# Knowledge Extraction & Maintenance

You are equipped with **Knowledge Management** capabilities:

1. **What to capture**
   • Public API of each file (public classes, functions, methods, parameters, return types).
   • High‑level description of each file’s purpose.
   • Invariants and assumptions that must always hold.
   • Project‑ or directory‑specific coding patterns, styles, and architectural conventions.
   • Rules (commenting, testing, documentation, security, etc.).
   • Any other insight that a future contributor would find crucial.

2. **Where to store it**
   • Save knowledge in a YAML file named \`knowledge.ai.yml\`.
   • One file per directory.
     – The repository root file records knowledge that applies project‑wide (e.g., service responsibilities, global patterns).
     – Each sub‑directory keeps only the knowledge relevant to that directory or package.
   • Use clear keys such as \`files\`, \`invariants\`, \`patterns\`, \`rules\`.

3. **When to update**
   • **While working**: after reading, analysing, creating, or modifying code, immediately record any new or changed knowledge.
   • **On refactor / deletion**: locate and delete or amend obsolete entries so that knowledge never drifts from the codebase.
   • **Granularity**: update only the affected directory’s \`knowledge.ai.yml\`, except when the change has global impact.

4. **How to format (illustrative)**
\`\`\`yaml
files:
  - path: "src/utils/math.ts"
    description: "Numeric helpers for currency calculations"
    api:
      functions:
        - name: "add"
          params: [{ name: "a", type: "number" }, { name: "b", type: "number" }]
          returns: "number"
invariants:
  - "All currency math uses BigInt to avoid floating‑point errors"
patterns:
  - "Prefer functional utilities over classes in utils/"
rules:
  - "Every exported function must have JSDoc"
\`\`\`

5. **Automatic context**
   When you are asked to read or modify a file, the orchestration layer will supply any existing knowledge for that path automatically. Use it, refine it, and keep it accurate.

Your workflow **must**:
   1. Detect knowledge deltas.
   2. Write edits to the correct \`knowledge.ai.yml\`.
   3. Remove stale facts.
   4. Use provided tools to update the knowledge files.

Adhere to these rules rigorously to ensure the codebase and its living documentation stay in sync.
`

export const KnowledgeManagementPolicy: AgentPolicy = (tools) => {
  if (!tools[readFile.name]) {
    return undefined
  }

  return {
    name: Policies.KnowledgeManagement,
    prompt: tools[writeToFile.name] ? prompt : undefined,
    updateResponse: async (response) => {
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

      const paths = new Set<string>()

      for (const file of files) {
        // add all directories to the paths set
        let dir = dirname(file)
        paths.add(dir)

        // add all parent directories to the paths set
        while (dir !== '.') {
          paths.add(dir)
          dir = dirname(dir)
        }
      }

      if (paths.size === 0) {
        return response
      }

      const newResponses = [...response]

      const allFullPaths = []
      for (const path of paths) {
        if (path === '.') {
          continue
        }
        const fullpath = join(path, 'knowledge.ai.yml')
        allFullPaths.push(fullpath)
      }
      newResponses.push({
        type: 'tool_use',
        name: readFile.name,
        params: {
          path: allFullPaths.join(','),
        },
      })

      return newResponses
    },
  }
}
