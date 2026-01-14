# New Tools and Modifications Proposal for Polka Codes

**Date**: January 2026
**Purpose**: Identify high-value tools to add and modifications to improve existing tools

---

## Executive Summary

Based on analysis of Claude Code's toolset and Polka Codes' current capabilities, I recommend:

**5 New High-Value Tools**:
1. **WebSearch** - Web search with sources (priority: HIGH)
2. **NotebookEdit** - Jupyter notebook editing (priority: MEDIUM)
3. **Grep** - Content search within files (priority: HIGH)
4. **Context commands** - /context status/summary/clear (priority: MEDIUM)
5. **TakeScreenshot** - Browser/UI screenshots (priority: LOW)

**7 Critical Tool Modifications**:
1. **executeCommand** - Add git workflow, anti-patterns, tool preferences
2. **writeToFile** - Add "read first" requirement and enforcement
3. **replaceInFile** - Add "read first" requirement and enforcement
4. **updateTodoItem** - Add comprehensive usage guidance
5. **readFile** - Add "when NOT to use" guidance
6. **search** - Add sources requirement (for web search)
7. **All tools** - Standardize description structure

**Expected Impact**:
- ✅ Better tool selection accuracy
- ✅ Fewer errors and re-attempts
- ✅ Improved user experience
- ⚠️ +3,750-10,000 tokens (~20-30% increase)

---

## Table of Contents

1. [New Tools to Add](#1-new-tools-to-add)
2. [Modifications to Existing Tools](#2-modifications-to-existing-tools)
3. [Tool Enhancements by Priority](#3-tool-enhancements-by-priority)
4. [Implementation Roadmap](#4-implementation-roadmap)

---

## 1. New Tools to Add

### 1.1 WebSearch Tool (HIGH PRIORITY)

**Status**: Polka Codes has `search` tool but it's for web search via Google. Need to enhance.

**Claude Code Reference**: 334 tokens
```
Searches the web for current information
- Domain filtering supported
- US-only currently
- MUST include "Sources:" section with hyperlinks at end
```

**Current Polka Codes**:
```typescript
// packages/core/src/tools/search.ts
description: 'Search the web for information using Google Search...'
```

**Proposed Enhancement**:

```typescript
// packages/core/src/tools/webSearch.ts (renamed from search.ts)

export const toolInfo = {
  name: 'webSearch',
  description: `Search the web for current information, facts, news, documentation, or research.

When to use:
- Finding current information not in training data
- Looking up recent events, news, developments
- Researching technical documentation
- Finding examples or best practices
- Verifying facts or claims

When NOT to use:
- For searching within project files: Use search instead
- For file name searches: Use listFiles instead
- For reading known files: Use readFile instead

Features:
- Returns comprehensive search results with relevant content
- Extracts key information from web pages
- Provides multiple sources for verification

IMPORTANT:
- CRITICAL: You MUST include a "Sources:" section at the end of your response
- Sources section must list all URLs as markdown hyperlinks
- Format: "Sources:\\n- [Source Title](URL)\\n- [Another Source](URL)"
- Do not omit sources even if information seems straightforward

Example response format:
"Based on search results, [answer to question].

Sources:
- [Example Source 1](https://example.com/article1)
- [Example Source 2](https://example.com/article2)"`,

  parameters: z.object({
    query: z.string()
      .describe('The search query (max 70 characters recommended for best results)')
      .meta({ usageValue: 'Your search query here' }),
    domain: z.string().optional()
      .describe('Optional domain filter (e.g., "github.com" to only search GitHub)')
      .meta({ usageValue: 'example.com' }),
    recency: z.enum(['oneDay', 'oneWeek', 'oneMonth', 'oneYear', 'noLimit']).optional()
      .describe('Filter results by time range')
      .meta({ usageValue: 'oneWeek' }),
  }).meta({
    examples: [
      {
        description: 'Search for recent developments',
        input: {
          query: 'TypeScript 5.9 new features',
          recency: 'oneMonth'
        }
      },
      {
        description: 'Search within specific domain',
        input: {
          query: 'Bun performance benchmarks',
          domain: 'github.com'
        }
      }
    ]
  })
} as const satisfies ToolInfo

// Handler validates that sources are included in subsequent AI response
// This can be checked by looking for "Sources:" in the next message
```

**Why High Priority**:
- ✅ Critical for current information
- ✅ Claude Code has it and it works well
- ✅ Sources requirement prevents hallucinations
- ✅ Easy to implement (rename and enhance)

**Implementation Effort**: 2-3 hours
- Rename `search` → `webSearch`
- Add domain and recency parameters
- Add sources requirement to description
- Update handler to support new parameters

---

### 1.2 Grep Tool (HIGH PRIORITY)

**Status**: **MISSING** - Polka Codes has `search` for web search and `searchFiles` for file names, but NO content search within files.

**Claude Code Reference**: 300 tokens
```
Powerful search using ripgrep under the hood
- Regular expressions
- File type filters
- Output modes: content, files_with_matches, count
- Context flags (-A/-B/-C)
```

**Current Gap**: Polka Codes cannot search for content within files efficiently.

**Proposed Implementation**:

```typescript
// packages/core/src/tools/grep.ts (NEW TOOL)

import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'
import { createProviderError } from './utils'

export const toolInfo = {
  name: 'grep',
  description: `Search for content within files using ripgrep.

When to use:
- Finding all occurrences of a pattern within files
- Searching for specific text, code, or data
- Searching within specific file types
- Finding where functions/variables are used

When NOT to use:
- For file name searches: Use listFiles or searchFiles instead
- For reading specific files: Use readFile instead
- Prefer this tool over executeCommand with grep/rg

Features:
- Supports regular expressions for advanced patterns
- File type filtering (e.g., --type ts for TypeScript files)
- Output modes: content (matches), files_with_matches (paths), count (numbers)
- Context flags: -A (after), -B (before), -C (context) lines
- Case-sensitive by default, use -i flag for case-insensitive

Output modes:
- content: Show matching lines with line numbers and file paths
- files_with_matches: List only matching file paths (no content)
- count: Show number of matches per file

Examples:
- Search for "functionName" in all files: grep({ pattern: 'functionName' })
- Search with 2 lines of context: grep({ pattern: 'TODO', contextLines: 2 })
- Search only TypeScript files: grep({ pattern: 'interface', fileType: 'ts' })
- Case-insensitive search: grep({ pattern: 'error', flags: ['-i'] })`,

  parameters: z.object({
    pattern: z.string()
      .describe('The search pattern (supports regular expressions)')
      .meta({ usageValue: 'your-pattern-here' }),
    path: z.string().optional()
      .describe('Directory to search in (default: current directory)')
      .meta({ usageValue: 'src/' }),
    fileType: z.string().optional()
      .describe('File type filter (e.g., "ts", "py", "js")')
      .meta({ usageValue: 'ts' }),
    outputMode: z.enum(['content', 'files_with_matches', 'count']).optional()
      .describe('Output format')
      .meta({ usageValue: 'content' }),
    contextLines: z.number().optional()
      .describe('Number of context lines to show (-C flag)')
      .meta({ usageValue: '2' }),
    flags: z.array(z.string()).optional()
      .describe('Additional ripgrep flags (e.g., ["-i"] for case-insensitive)')
      .meta({ usageValue: '["-i", "-v"]' }),
  }).meta({
    examples: [
      {
        description: 'Search for all TODO comments',
        input: {
          pattern: 'TODO',
          path: 'src/',
          fileType: 'ts'
        }
      },
      {
        description: 'Search for function usage with context',
        input: {
          pattern: 'useAuth',
          contextLines: 3,
          outputMode: 'content'
        }
      },
      {
        description: 'Case-insensitive search',
        input: {
          pattern: 'error',
          flags: ['-i'],
          outputMode: 'files_with_matches'
        }
      }
    ]
  })
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.executeCommand) {
    return createProviderError('execute command (required for grep)')
  }

  const { pattern, path = '.', fileType, outputMode = 'content', contextLines, flags = [] } = toolInfo.parameters.parse(args)

  // Build ripgrep command
  const cmd = ['rg']

  // Add file type filter
  if (fileType) {
    cmd.push('-t', fileType)
  }

  // Add context lines
  if (contextLines) {
    cmd.push('-C', String(contextLines))
  }

  // Add output mode
  if (outputMode === 'files_with_matches') {
    cmd.push('-l') // only filenames
  } else if (outputMode === 'count') {
    cmd.push('-c') // only counts
  }

  // Add user flags
  cmd.push(...flags)

  // Add pattern
  cmd.push(pattern)

  // Add path
  cmd.push(path)

  const command = cmd.join(' ')

  const result = await provider.executeCommand(command, false)

  if (result.exitCode !== 0) {
    return {
      success: true, // rg returns 1 when no matches found, which is valid
      message: {
        type: 'text',
        value: result.stdout || 'No matches found'
      }
    }
  }

  return {
    success: true,
    message: {
      type: 'text',
      value: `<grep_result pattern="${pattern}" path="${path || '.'}">
${result.stdout}
</grep_result>`
    }
  }
}

export default {
  ...toolInfo,
  handler
} satisfies FullToolInfo
```

**Why High Priority**:
- ✅ **Critical gap** - no content search capability
- ✅ Essential for codebase exploration
- ✅ Frequently used operation
- ✅ Leverages ripgrep (fast, efficient)

**Implementation Effort**: 4-6 hours
- Create new tool file
- Implement ripgrep wrapper
- Add parameter validation
- Write tests
- Update tool registry

---

### 1.3 NotebookEdit Tool (MEDIUM PRIORITY)

**Status**: **MISSING** - Polka Codes cannot edit Jupyter notebooks.

**Claude Code Reference**: 121 tokens
```
Edits Jupyter notebook cells
- Supports replace, insert, delete modes
- Cell type: code or markdown
```

**Current Gap**: Data scientists using Jupyter notebooks cannot edit them with Polka Codes.

**Proposed Implementation**:

```typescript
// packages/core/src/tools/notebookEdit.ts (NEW TOOL)

import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'

export const toolInfo = {
  name: 'notebookEdit',
  description: `Edit Jupyter notebook (.ipynb) cells.

When to use:
- Modifying code in Jupyter notebooks
- Adding or removing cells
- Updating markdown cells in notebooks
- Data science workflows using notebooks

When NOT to use:
- For regular code files: Use replaceInFile or writeToFile instead
- For reading notebooks: Use readFile supports .ipynb format

Features:
- Supports code and markdown cell types
- Edit modes: replace, insert, delete
- Preserves notebook structure and metadata
- Auto-saves after edit

IMPORTANT:
- Read the notebook first to understand cell structure
- Cell numbers are 0-indexed (first cell is 0)
- Replace mode: cell must exist
- Insert mode: adds cell at specified position
- Delete mode: removes cell at specified position`,

  parameters: z.object({
    path: z.string()
      .describe('Path to the .ipynb file')
      .meta({ usageValue: 'notebook.ipynb' }),
    cellId: z.string().optional()
      .describe('Cell ID to edit (for replace/delete modes)')
      .meta({ usageValue: 'cell-123abc' }),
    cellNumber: z.number().optional()
      .describe('Cell index (0-indexed, for insert/replace modes)')
      .meta({ usageValue: '0' }),
    editMode: z.enum(['replace', 'insert', 'delete'])
      .describe('Edit operation to perform')
      .meta({ usageValue: 'replace' }),
    cellType: z.enum(['code', 'markdown'])
      .describe('Cell type (for insert mode)')
      .meta({ usageValue: 'code' }),
    source: z.string().optional()
      .describe('Cell content (for replace/insert modes)')
      .meta({ usageValue: 'print("Hello, World!")' }),
  }).meta({
    examples: [
      {
        description: 'Replace cell content',
        input: {
          path: 'analysis.ipynb',
          editMode: 'replace',
          cellNumber: 0,
          source: 'import pandas as pd\n\ndf = pd.read_csv("data.csv")'
        }
      },
      {
        description: 'Insert new code cell',
        input: {
          path: 'analysis.ipynb',
          editMode: 'insert',
          cellNumber: 1,
          cellType: 'code',
          source: '# New analysis\ndf.head()'
        }
      },
      {
        description: 'Delete cell',
        input: {
          path: 'analysis.ipynb',
          editMode: 'delete',
          cellNumber: 2
        }
      }
    ]
  })
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.readFile || !provider.writeFile) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Filesystem provider must support readFile and writeFile'
      }
    }
  }

  const { path, cellId, cellNumber, editMode, cellType = 'code', source } = toolInfo.parameters.parse(args)

  try {
    // Read notebook
    const content = await provider.readFile(path, false)
    if (!content) {
      return {
        success: false,
        message: {
          type: 'error-text',
          value: `Notebook not found: ${path}`
        }
      }
    }

    const notebook = JSON.parse(content)

    // Validate notebook structure
    if (!notebook.cells || !Array.isArray(notebook.cells)) {
      return {
        success: false,
        message: {
          type: 'error-text',
          value: 'Invalid notebook format: missing or invalid cells array'
        }
      }
    }

    // Perform edit operation
    switch (editMode) {
      case 'replace': {
        const index = cellId !== undefined
          ? notebook.cells.findIndex((cell: any) => cell.id === cellId)
          : cellNumber

        if (index === undefined || index < 0 || index >= notebook.cells.length) {
          return {
            success: false,
            message: {
              type: 'error-text',
              value: `Cell not found: ${cellId || cellNumber}`
            }
          }
        }

        notebook.cells[index].source = source.split('\n')
        break
      }

      case 'insert': {
        if (cellNumber === undefined) {
          return {
            success: false,
            message: {
              type: 'error-text',
              value: 'cellNumber is required for insert mode'
            }
          }
        }

        const newCell: any = {
          cell_type: cellType,
          source: source.split('\n'),
          metadata: {},
          execution_count: null,
          outputs: []
        }

        notebook.cells.splice(cellNumber, 0, newCell)
        break
      }

      case 'delete': {
        const index = cellId !== undefined
          ? notebook.cells.findIndex((cell: any) => cell.id === cellId)
          : cellNumber

        if (index === undefined || index < 0 || index >= notebook.cells.length) {
          return {
            success: false,
            message: {
              type: 'error-text',
              value: `Cell not found: ${cellId || cellNumber}`
            }
          }
        }

        notebook.cells.splice(index, 1)
        break
      }
    }

    // Write updated notebook
    await provider.writeFile(path, JSON.stringify(notebook, null, 2))

    return {
      success: true,
      message: {
        type: 'text',
        value: `<notebook_edit_result path="${path}" mode="${editMode}" status="success" />
Cells updated successfully.`
      }
    }
  } catch (error) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Failed to edit notebook: ${error instanceof Error ? error.message : String(error)}`
      }
    }
  }
}

export default {
  ...toolInfo,
  handler
} satisfies FullToolInfo
```

**Why Medium Priority**:
- ✅ Important for data scientists
- ⚠️ Niche use case (Jupyter notebooks)
- ⚠️ Moderate complexity (JSON parsing, cell manipulation)

**Implementation Effort**: 6-8 hours
- Create new tool file
- Implement JSON parsing/editing
- Handle cell operations
- Write tests
- Update tool registry

---

### 1.4 Context Commands (MEDIUM PRIORITY)

**Status**: **MISSING** - No `/context` commands for context management.

**Claude Code Reference**:
```bash
/context status     # View current token usage
/context summary    # Condense long threads
/context clear      # Reset context window
```

**Current Gap**: Users cannot inspect or manage context window.

**Proposed Implementation**:

```typescript
// packages/cli/src/commands/context.ts (NEW COMMAND)

import { Command } from 'commander'
import Table from 'cli-table'
import chalk from 'chalk'
import { getConfig } from '@polka-codes/cli-shared'

export function registerContextCommand(program: Command) {
  const contextCmd = program.command('context')

  contextCmd
    .command('status')
    .description('Show current context usage and limits')
    .action(async () => {
      const config = await getConfig()

      // Get context info from current session
      const messageCount = 15 // TODO: Get actual count
      const maxMessages = config.maxMessageCount || 50
      const percentage = Math.round((messageCount / maxMessages) * 100)

      console.log(chalk.bold('\n📊 Context Status\n'))

      const table = new Table({
        head: [chalk.cyan('Metric'), chalk.cyan('Value')],
        colWidths: [25, 50]
      })

      table.push(
        ['Messages', `${messageCount} / ${maxMessages} (${percentage}%)`],
        ['Max Messages', maxMessages],
        ['Summary Threshold', config.summaryThreshold || 20],
        ['Provider', config.defaultProvider],
        ['Model', config.defaultModel]
      )

      console.log(table.toString())

      // Warning if approaching limit
      if (percentage > 80) {
        console.log(chalk.yellow('\n⚠️  Warning: Approaching message limit!'))
        console.log(chalk.yellow('Consider using "polka context summary" to compress.\n'))
      } else if (percentage > 50) {
        console.log(chalk.gray('\nℹ️  Context at ' + percentage + '% capacity.\n'))
      } else {
        console.log(chalk.green('\n✅ Context usage is healthy.\n'))
      }
    })

  contextCmd
    .command('summary')
    .description('Summarize current conversation context')
    .action(async () => {
      console.log(chalk.bold('\n📝 Generating Conversation Summary...\n'))

      // TODO: Implement conversation summarization
      // This would call the AI to generate a summary of the current session

      console.log(chalk.green('✅ Summary generated and saved to memory.'))
      console.log(chalk.gray('Use "polka memory list" to view summaries.\n'))
    })

  contextCmd
    .command('clear')
    .description('Clear context window (start fresh)')
    .option('-f, --force', 'Skip confirmation')
    .action(async (options) => {
      if (!options.force) {
        const inquirer = await import('inquirer')
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to clear the context? This cannot be undone.',
            default: false
          }
        ])

        if (!confirm) {
          console.log(chalk.gray('Cancelled.\n'))
          return
        }
      }

      console.log(chalk.bold('\n🗑️  Clearing Context...\n'))

      // TODO: Implement context clearing
      // This would reset the current session context

      console.log(chalk.green('✅ Context cleared. Starting fresh session.\n'))
    })
}
```

**Integration**: Add to CLI:
```typescript
// packages/cli/src/index.ts
import { registerContextCommand } from './commands/context'

registerContextCommand(program)
```

**Why Medium Priority**:
- ✅ Useful for power users
- ✅ Helps manage token usage
- ⚠️ Requires session state tracking
- ⚠️ Moderate implementation complexity

**Implementation Effort**: 4-6 hours
- Create command file
- Implement status display
- Implement summary generation
- Implement clear functionality
- Add to CLI

---

### 1.5 TakeScreenshot Tool (LOW PRIORITY)

**Status**: **MISSING** - No screenshot capability.

**Claude Code Reference**: Computer tool (161 tokens) for browser automation

**Proposed Implementation**:

```typescript
// packages/core/src/tools/takeScreenshot.ts (NEW TOOL)

import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'

export const toolInfo = {
  name: 'takeScreenshot',
  description: `Take a screenshot of the current viewport or specific element.

When to use:
- Documenting visual changes
- Capturing UI state for debugging
- Creating visual documentation
- Verifying rendering issues

When NOT to use:
- For reading file contents: Use readFile instead
- For analyzing code: Use grep or readFile instead

Features:
- Captures full page or specific element
- Saves as PNG file
- Returns file path for reference

IMPORTANT:
- Requires Playwright or similar browser automation
- Use only when visual documentation is needed
- File paths are relative to project root`,

  parameters: z.object({
    path: z.string()
      .describe('Path where screenshot should be saved (include .png extension)')
      .meta({ usageValue: 'screenshots/before-change.png' }),
    fullPage: z.boolean().optional()
      .describe('Capture full scrollable page (default: false, captures viewport only)')
      .meta({ usageValue: 'true' }),
    element: z.string().optional()
      .describe('CSS selector for specific element to screenshot')
      .meta({ usageValue: '#main-content' }),
  }).meta({
    examples: [
      {
        description: 'Capture viewport',
        input: {
          path: 'screenshot.png'
        }
      },
      {
        description: 'Capture full page',
        input: {
          path: 'full-page.png',
          fullPage: true
        }
      },
      {
        description: 'Capture specific element',
        input: {
          path: 'element.png',
          element: '#submit-button'
        }
      }
    ]
  })
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, any> = async (provider, args) => {
  // Implementation would use Playwright or similar
  // This is a placeholder for the actual implementation

  return {
    success: false,
    message: {
      type: 'error-text',
      value: 'Screenshot tool requires browser automation (Playwright) to be configured.'
    }
  }
}

export default {
  ...toolInfo,
  handler
} satisfies FullToolInfo
```

**Why Low Priority**:
- ⚠️ Requires Playwright dependency
- ⚠️ Narrow use case (UI testing/debugging)
- ⚠️ Significant implementation effort

**Implementation Effort**: 10-15 hours
- Install and configure Playwright
- Implement screenshot capture
- Handle full page vs element
- Write tests
- Update documentation

---

## 2. Modifications to Existing Tools

### 2.1 executeCommand - Add Git Workflow and Anti-Patterns

**Current Description** (~150 tokens):
```typescript
description: 'Run a single CLI command. The command is always executed in the
project-root working directory (regardless of earlier commands). Prefer one-off
shell commands over wrapper scripts for flexibility. **IMPORTANT**: After an
`execute_command` call, you MUST stop and NOT allowed to make further tool
calls in the same message.'
```

**Proposed Enhanced Description** (~500 tokens):

```typescript
description: `Run a single CLI command in a persistent shell session.

IMPORTANT CRITICAL RULES:
- Prefer specialized tools over executeCommand when available:
  * readFile instead of cat
  * replaceInFile instead of sed
  * listFiles instead of find
  * grep (for content search) instead of grep/rg
  * webSearch for web searches instead of curl + grep
- NEVER use bash echo or other command-line tools to communicate thoughts
  or instructions to the user. Output all communication directly in your responses.

When to use:
- Terminal operations (git, npm, build tools, testing)
- Running tests, builds, linting, formatting
- System commands not available via other tools
- Package management (npm, yarn, bun, pip)

When NOT to use:
- For file operations: Use readFile, writeToFile, replaceInFile instead
- For file searching: Use listFiles or grep instead
- For reading files: Use readFile instead of cat/head/tail
- For editing files: Use replaceInFile instead of sed/awk

Git Commit Workflow:
When creating git commits, follow this process:
1. Run these commands in parallel (one message):
   - git status
   - git diff
   - git log -5 --oneline
2. Analyze changes and recent commit messages
3. Draft commit message following conventions:
   - Clear subject line (50 chars or less)
   - Detailed body explaining what changed and why
   - Include file references when relevant
4. Stage files and create commit:
   - git add <files>
   - git commit -m "message"
5. Run git status to verify

Command Execution Guidelines:
- **Independent commands**: Make multiple executeCommand calls in one message
  Example: git status, git diff, git log (all independent)
- **Sequential commands**: Use && or ; chaining
  Example: npm run build && npm test (test needs build first)
- **Always quote file paths with spaces**: "path with spaces/file.txt"
- **Prefer absolute paths** over cd for consistency
- **Working directory**: Commands always run in project-root

IMPORTANT: After an execute_command call, you MUST stop and NOT make
further tool calls in the same message. This ensures command output is
properly captured and processed.

Approval Requirements:
- Set requiresApproval=true for:
  * Installing/uninstalling software
  * File modifications or deletions
  * Network operations
  * System setting changes
  * Database migrations
- Set requiresApproval=false for:
  * Read-only operations (ls, git status, git log)
  * Local development actions (builds, tests)
  * Non-destructive operations`
```

**Benefits**:
- ✅ Clear tool preference hierarchy
- ✅ Comprehensive git workflow
- ✅ Parallel vs sequential guidance
- ✅ Anti-patterns ("NEVER use bash echo")
- ✅ Path handling best practices

---

### 2.2 writeToFile - Add "Read First" Requirement

**Current Description** (~80 tokens):
```typescript
description: "Request to write content to a file at the specified path. If the
file exists, it will be overwritten with the provided content. If the file
doesn't exist, it will be created. This tool will automatically create any
directories needed to write the file. Ensure that the output content does not
include incorrect escaped character patterns such as \`&lt;\`, \`&gt;\`, or
\`&amp;\`. Also ensure there is no unwanted CDATA tags in the content."
```

**Proposed Enhanced Description** (~250 tokens):

```typescript
description: `Request to write content to a file at the specified path.

IMPORTANT: You MUST use readFile at least once before using writeToFile
on an existing file. This ensures you understand the current file state
before making changes. The system will enforce this requirement.

When to use:
- Creating new files
- Completely replacing file contents
- When you have the complete intended content

When NOT to use:
- For modifying existing files: Use replaceInFile instead
- For appending content: Use executeCommand with echo >> instead
- For targeted edits: Use replaceInFile instead

Features:
- Automatically creates any directories needed
- Overwrites existing files completely
- Must provide complete file content (no truncation)

IMPORTANT CONSTRAINTS:
- If file exists, you MUST read it first (enforced by system)
- Always provide COMPLETE intended content (no omissions)
- Ensure no incorrect escape sequences (&lt;, &gt;, &amp;)
- Ensure no unwanted CDATA tags in content
- Use replaceInFile for modifications to existing files

ERROR HANDLING:
- If you attempt to write to a file without reading it first, the tool will
  return an error requiring you to read the file first
- This prevents accidental overwrites and ensures informed changes`
```

**Handler Modification** (enforce "read first"):

```typescript
// Add to packages/cli/src/tools/writeToFile handler

// Track which files have been read in current session
const readFiles = new Set<string>()

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (provider, args) => {
  if (!provider.writeFile) {
    return createProviderError('write file')
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for writeToFile: ${parsed.error.message}`,
      },
    }
  }
  let { path, content } = parsed.data

  // NEW: Check if file has been read
  const fileExists = await provider.fileExists?.(path) ?? true
  if (fileExists && !readFiles.has(path)) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `ERROR: You must read the file "${path}" first before writing to it.
This ensures you understand the current file state before making changes.

Use readFile('${path}') to read the file first, then proceed with writeToFile.`
      }
    }
  }

  // ... rest of handler
}

// Modify readFile to track reads
// In readFile handler:
readFiles.add(path)
```

**Benefits**:
- ✅ Prevents accidental overwrites
- ✅ Enforces informed changes
- ✅ Matches Claude Code's approach
- ✅ Reduces file corruption errors

---

### 2.3 replaceInFile - Add "Read First" Requirement

**Current Description** (~250 tokens):
```typescript
description: 'Request to replace sections of content in an existing file using
SEARCH/REPLACE blocks that define exact changes to specific parts of the file.
This tool should be used when you need to make targeted changes to specific
parts of a file.'
[... extensive parameter description ...]
```

**Proposed Enhanced Description** (~400 tokens):

```typescript
description: `Request to replace sections of content in an existing file using
SEARCH/REPLACE blocks.

IMPORTANT: You MUST use readFile at least once before using replaceInFile
on an existing file. This ensures you understand the current file state
before making changes. The system will enforce this requirement.

When to use:
- Making targeted changes to specific parts of a file
- Replacing variable names, function signatures, imports
- Fixing bugs in existing code
- When you know the exact content to replace

When NOT to use:
- For creating new files: Use writeToFile instead
- For completely replacing file contents: Use writeToFile instead
- When you don't know the exact content: Read file first
- For appending content: Use executeCommand with echo >> instead

SEARCH/REPLACE FORMAT:
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE

Critical rules:
1. SEARCH content must match EXACTLY (character-for-character including whitespace)
2. Each block replaces only first occurrence
3. Include just enough lines for uniqueness (not too many, not too few)
4. Keep blocks concise (don't include long unchanged sections)
5. List blocks in order they appear in file
6. Use multiple blocks for multiple independent changes

Special operations:
- Move code: Two blocks (delete from original + insert at new location)
- Delete code: Empty REPLACE section
- Rename variable: Use multiple blocks with replaceAll or use writeToFile for simple renames

IMPORTANT CONSTRAINTS:
- MUST read file first before editing (enforced by system)
- SEARCH text must match file content exactly
- Each block is independent (doesn't affect other blocks)
- Cannot use for appending or inserting without SEARCH context

ERROR HANDLING:
- If SEARCH content doesn't match exactly, the tool will fail
- If you haven't read the file, the tool will require you to read it first
- Partial matches are not supported (must be exact)`
```

**Handler Modification** (enforce "read first"):

Similar to writeToFile, add read tracking:
```typescript
// Check if file has been read
if (!readFiles.has(path)) {
  return {
    success: false,
    message: {
      type: 'error-text',
      value: `ERROR: You must read the file "${path}" first before editing it.
Use readFile('${path}') to read the file first, then proceed with replaceInFile.`
    }
  }
}
```

**Benefits**:
- ✅ Prevents blind edits
- ✅ Ensures exact matching
- ✅ Reduces edit failures
- ✅ Matches Claude Code's approach

---

### 2.4 updateTodoItem - Add Comprehensive Usage Guidance

**Current**: No description in prompt, only Zod schema

**Proposed** (~500 tokens):

```typescript
// Add to prompt/system instructions
description: `Create and manage structured task lists for tracking progress.

CRITICAL REQUIREMENTS:
1. Use this tool for multi-step tasks (3+ steps)
2. Only ONE todo can be 'open' (in-progress) at a time
3. Mark as 'completed' immediately after finishing (don't batch)
4. Provide both title and description for clarity

TASK STATES:
- open: Currently working on (limit to ONE at a time)
- completed: Task finished successfully
- closed: Task cancelled or no longer relevant

WHEN TO USE:
- Complex tasks requiring 3 or more steps
- Multi-file operations or refactoring
- User provides multiple tasks (numbered or comma-separated)
- After receiving new instructions (capture immediately)
- Non-trivial implementation tasks

WHEN NOT TO USE:
- Single straightforward tasks
- Tasks completed in less than 3 trivial steps
- Purely conversational or informational tasks
- Tracking user's unrelated requests

TRANSITION RULES:
1. Mark as 'open' BEFORE starting work on a task
2. Mark as 'completed' IMMEDIATELY after finishing
3. Exactly ONE todo 'open' at a time (not less, not more)
4. Move to next todo only after completing current
5. If blocked, keep task as 'open' but note dependency in description
6. Never batch completions (complete one at a time)

USAGE PATTERN:
- Create todos when planning work
- Mark first as 'open' before starting
- Complete and move to next sequentially
- Provide clear titles and descriptions

HIERARCHICAL TASKS:
- Use parentId to create subtasks
- Complete subtasks before parent
- Use description to explain dependencies

IMPORTANT: Only use this tool for planning/implementation tasks.
Do not use for tracking user's separate, unrelated requests.

Examples:
✅ GOOD: "Implement authentication" (open) → "Add login form" (completed)
✅ GOOD: "Fix bug in user service" (open) → "Write test" (open)
❌ BAD: Multiple tasks marked 'open' simultaneously
❌ BAD: Batching completions without marking each as 'completed'
❌ BAD: Using todos for single simple tasks`
```

**Benefits**:
- ✅ Clear state transition rules
- ✅ Prevents misuse
- ✅ Better task tracking
- ✅ Matches Claude Code's detailed approach

---

### 2.5 readFile - Add "When NOT to Use" Guidance

**Current Description** (~100 tokens):
```typescript
description: 'Request to read the contents of one or multiple files at the
specified paths. Use comma separated paths to read multiple files. Use this
when you need to examine the contents of an existing file you do not know
the contents of, for example to analyze code, review text files, or extract
information from configuration files. May not be suitable for other types
of binary files, as it returns the raw content as a string. Try to list
all the potential files are relevent to the task, and then use this tool
to read all the relevant files.'
```

**Proposed Enhanced Description** (~200 tokens):

```typescript
description: `Request to read the contents of one or multiple files at the
specified paths.

When to use:
- Examining file contents you don't know
- Analyzing code, reviewing text files, extracting configuration info
- Reading multiple files at once (use comma-separated paths)
- Understanding file structure before editing

When NOT to use:
- For file existence checks: Use listFiles instead
- For searching within files: Use grep instead
- For file name searches: Use searchFiles instead
- Prefer this tool over executeCommand with cat/head/tail

Features:
- Supports comma-separated paths for multiple files
- Automatically handles different file types
- Returns raw content as text
- May not be suitable for binary files

IMPORTANT:
- Always try to list relevant files first with listFiles
- Then read all relevant files together with comma-separated paths
- Not suitable for binary files (returns raw string)
- Reading a file is required before writeToFile or replaceInFile

Usage pattern:
1. listFiles to find relevant files
2. readFile with comma-separated paths to read all
3. Proceed with edits or analysis`
```

**Benefits**:
- ✅ Clear usage scenarios
- ✅ References alternative tools
- ✅ Explains multi-file pattern
- ✅ Links to edit requirements

---

### 2.6 webSearch (formerly search) - Add Sources Requirement

**Current** (minimal description)

**Proposed** (add to description):

```typescript
description: `Search the web for current information, facts, news, documentation,
or research.

[... existing when to use sections ...]

IMPORTANT:
- CRITICAL: You MUST include a "Sources:" section at the end of your response
  when presenting web search results to users
- Sources section must list all URLs as markdown hyperlinks
- Format: "Sources:\\n- [Source Title](URL)\\n- [Another Source](URL)"
- Do not omit sources even if information seems straightforward
- This prevents hallucinations and enables verification

Example response format:
"Based on search results, TypeScript 5.9 introduces several new features
including improved type inference and enhanced decorator support.

Sources:
- [TypeScript 5.9 Announcement](https://devblogs.microsoft.com/typescript/announcing-typescript-5-9/)
- [TypeScript 5.9 Release Notes](https://github.com/microsoft/TypeScript/releases/tag/v5.9.0)"`
```

**Benefits**:
- ✅ Prevents hallucinations
- ✅ Enables verification
- ✅ Matches Claude Code's approach
- ✅ Improves trustworthiness

---

## 3. Tool Enhancements by Priority

### Priority Matrix

| Tool | Priority | Impact | Effort | Ratio |
|------|----------|--------|--------|-------|
| **NEW: grep** | HIGH | High | Medium (4-6h) | **9/9** |
| **MOD: executeCommand** | HIGH | High | Low (2h) | **9/9** |
| **MOD: writeToFile** | HIGH | High | Low (2h) | **9/9** |
| **MOD: replaceInFile** | HIGH | High | Low (2h) | **9/9** |
| **NEW: webSearch enhancement** | HIGH | High | Low (1h) | **9/9** |
| **MOD: updateTodoItem** | MEDIUM | Medium | Low (1h) | **6/9** |
| **MOD: readFile** | MEDIUM | Medium | Low (1h) | **6/9** |
| **NEW: Context commands** | MEDIUM | Medium | Medium (4-6h) | **6/9** |
| **NEW: NotebookEdit** | MEDIUM | Low | Medium (6-8h) | **4/9** |
| **NEW: TakeScreenshot** | LOW | Low | High (10-15h) | **2/9** |

**High Ratio Items** (Do First):
1. ✅ **grep** - Critical gap, high impact, moderate effort
2. ✅ **executeCommand enhancement** - High impact, low effort
3. ✅ **writeToFile enhancement** - High impact, low effort
4. ✅ **replaceInFile enhancement** - High impact, low effort
5. ✅ **webSearch enhancement** - High impact, low effort

---

## 4. Implementation Roadmap

### Phase 1: Critical Gaps (Week 1)

**Goal**: Address missing high-value tools

**Tasks**:
1. ✅ Implement `grep` tool (content search)
   - Create `packages/core/src/tools/grep.ts`
   - Implement ripgrep wrapper
   - Add to tool registry
   - Write tests

2. ✅ Enhance `webSearch` (rename from `search`)
   - Add domain and recency parameters
   - Add sources requirement to description
   - Update documentation

**Success Criteria**:
- ✅ Users can search content within files
- ✅ Web search results include sources
- ✅ All tests passing

---

### Phase 2: Tool Safety (Week 1-2)

**Goal**: Enforce "read first" requirement

**Tasks**:
1. ✅ Add read tracking to tools
   - Implement `readFiles` Set tracking
   - Track all readFile calls

2. ✅ Enforce "read first" in writeToFile
   - Add check in handler
   - Return helpful error message
   - Test enforcement

3. ✅ Enforce "read first" in replaceInFile
   - Add check in handler
   - Return helpful error message
   - Test enforcement

**Success Criteria**:
- ✅ Cannot write to file without reading first
- ✅ Cannot edit file without reading first
- ✅ Error messages guide users to correct workflow
- ✅ All tests passing

---

### Phase 3: Description Enhancements (Week 2)

**Goal**: Standardize and improve all tool descriptions

**Tasks**:
1. ✅ Rewrite executeCommand description
   - Add tool preference hierarchy
   - Add git workflow
   - Add anti-patterns
   - Add parallel/sequential guidance

2. ✅ Rewrite all tool descriptions
   - Add "When to use / NOT use" sections
   - Add tool relationship references
   - Standardize structure

3. ✅ Add tool preference guidelines to system prompt
   - Create new section
   - Add to all agent prompts

**Success Criteria**:
- ✅ All tools have standardized descriptions
- ✅ System prompt includes tool preferences
- ✅ Tool selection accuracy improves

---

### Phase 4: Todo Enhancement (Week 2)

**Goal**: Improve todo tool usage

**Tasks**:
1. ✅ Add comprehensive description to updateTodoItem
   - State transition rules
   - Usage patterns
   - Examples

2. ✅ Add validation to prevent multiple 'open' todos
   - Check in handler
   - Return error if violated

**Success Criteria**:
- ✅ Only one todo 'open' at a time
- ✅ Clear usage patterns in description
- ✅ Better task tracking

---

### Phase 5: Context Commands (Week 3)

**Goal**: Add context management commands

**Tasks**:
1. ✅ Implement `context status` command
   - Display current usage
   - Show limits
   - Warning if approaching limit

2. ✅ Implement `context summary` command
   - Generate conversation summary
   - Save to memory
   - Compress context

3. ✅ Implement `context clear` command
   - Clear current context
   - Require confirmation
   - Start fresh session

**Success Criteria**:
- ✅ Users can inspect context usage
- ✅ Users can summarize conversations
- ✅ Users can clear context

---

### Phase 6: Nice-to-Have Features (Week 4+)

**Goal**: Add specialized tools

**Tasks**:
1. ✅ Implement NotebookEdit tool
   - Create tool file
   - Implement JSON parsing/editing
   - Write tests
   - Add to registry

2. ✅ Implement TakeScreenshot tool
   - Set up Playwright
   - Implement screenshot capture
   - Write tests
   - Add to registry

**Success Criteria**:
- ✅ Can edit Jupyter notebooks
- ✅ Can take screenshots
- ✅ All tests passing

---

## Summary

### New Tools to Add (5)
1. **grep** (HIGH) - Content search within files
2. **webSearch enhancement** (HIGH) - Sources requirement
3. **Context commands** (MEDIUM) - /context status/summary/clear
4. **NotebookEdit** (MEDIUM) - Jupyter notebook editing
5. **TakeScreenshot** (LOW) - Browser screenshots

### Tool Modifications (7)
1. **executeCommand** - Add git workflow, anti-patterns, tool preferences
2. **writeToFile** - Add "read first" requirement and enforcement
3. **replaceInFile** - Add "read first" requirement and enforcement
4. **updateTodoItem** - Add comprehensive usage guidance
5. **readFile** - Add "when NOT to use" guidance
6. **webSearch** - Add sources requirement
7. **All tools** - Standardize description structure

### Implementation Priority
1. ✅ **Week 1**: grep, webSearch, read-first enforcement
2. ✅ **Week 2**: Description enhancements, todo improvement
3. ✅ **Week 3**: Context commands
4. ✅ **Week 4+**: NotebookEdit, TakeScreenshot

### Expected Impact
- ✅ Better tool selection accuracy
- ✅ Fewer errors and re-attempts
- ✅ Improved user experience
- ✅ Enhanced safety (read-first enforcement)
- ⚠️ +3,750-10,000 tokens (~20-30% increase)

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Next Review**: After Phase 1 completion
