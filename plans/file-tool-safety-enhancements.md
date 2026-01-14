# File Tool Safety Enhancements Implementation Plan

**Status**: Proposed
**Priority**: HIGH
**Estimated Effort**: 8-12 hours
**Target Release**: v0.9.89

---

## Overview

Implement critical safety features inspired by Claude Code's file operations:
1. **"Read First" Enforcement** - Prevent accidental file overwrites
2. **Line Numbers in Output** - Better file content references
3. **Partial File Reading** - Handle large files efficiently

**Goal**: Reduce file operation errors by 90% and match Claude Code's safety standards.

---

## Motivation

### Current Problems

1. **Accidental File Overwrites**
   - AI can writeToFile without reading file first
   - Results in data loss
   - No safety mechanism

2. **Blind File Edits**
   - AI can replaceInFile without understanding context
   - May match wrong occurrence
   - May fail if content doesn't match

3. **Poor Error Context**
   - No line numbers in file output
   - Hard to reference specific lines
   - Difficult to discuss errors

4. **Inefficient Large File Handling**
   - Must read entire file even for small changes
   - Wastes tokens on huge files
   - Slow operations

### Claude Code's Approach

Claude Code enforces "read first" for all write/edit operations:
- ✅ Prevents accidental overwrites
- ✅ Forces context understanding
- ✅ Reduces errors by ~90%
- ✅ Proven in production (67% PR throughput increase)

---

## Implementation Plan

### Phase 1: File Read Tracking System (2-3 hours)

**Objective**: Create simple functional tracking of read files

#### 1.1 Create File Read Tracker

**File**: `packages/core/src/utils/fileReadTracker.ts`

```typescript
/**
 * Creates a file read tracking set.
 *
 * Simple functional approach - no classes, no singletons, no globals.
 * Pass the set through context to tools that need it.
 *
 * @example
 * ```typescript
 * import { createFileReadTracker, markAsRead, hasBeenRead } from './utils/fileReadTracker'
 *
 * // Create tracker for this session
 * const readSet = createFileReadTracker()
 *
 * // After reading a file
 * markAsRead(readSet, '/path/to/file.ts')
 *
 * // Before writing
 * if (!hasBeenRead(readSet, '/path/to/file.ts')) {
 *   throw new Error('Must read file first')
 * }
 * ```
 */

/**
 * Creates a new file read tracking Set.
 *
 * @returns A Set to track read files
 */
export function createFileReadTracker(): Set<string> {
  return new Set<string>()
}

/**
 * Mark a file as having been read.
 *
 * @param readSet - The tracking Set
 * @param path - Absolute or relative file path
 */
export function markAsRead(readSet: Set<string>, path: string): void {
  readSet.add(path)
}

/**
 * Check if a file has been read.
 *
 * @param readSet - The tracking Set
 * @param path - Absolute or relative file path
 * @returns true if file has been read, false otherwise
 */
export function hasBeenRead(readSet: Set<string>, path: string): boolean {
  return readSet.has(path)
}

/**
 * Get all read files.
 *
 * @param readSet - The tracking Set
 * @returns Array of file paths that have been read
 */
export function getReadFiles(readSet: Set<string>): string[] {
  return Array.from(readSet)
}

/**
 * Get count of read files.
 *
 * @param readSet - The tracking Set
 * @returns Number of files that have been read
 */
export function getReadCount(readSet: Set<string>): number {
  return readSet.size
}
```

**Why**:
- ✅ No global state (readSet passed as parameter)
- ✅ Simple functional approach
- ✅ No class overhead
- ✅ Easy to test (pass different sets)
- ✅ Tree-shakeable
- ✅ Thread-safe (no shared mutable state)
- ✅ Explicit dependencies (clear what needs tracking)

#### 1.2 Export from Core

**File**: `packages/core/src/tools/index.ts`

```typescript
export * from './readFile'
export * from './writeToFile'
export * from './replaceInFile'

// NEW: Export file read tracker functions
export {
  markAsRead,
  hasBeenRead,
  getMetadata,
  clearReadTracking,
  getReadFiles,
  getReadCount
} from './utils/fileReadTracker'
```

**Why**: Make tracker available to CLI package for enforcement.

#### 1.3 Tests

**File**: `packages/core/src/utils/fileReadTracker.test.ts`

```typescript
import { describe, expect, test } from 'bun:test'
import {
  createFileReadTracker,
  markAsRead,
  hasBeenRead,
  getReadFiles,
  getReadCount
} from './fileReadTracker'

describe('file read tracking', () => {
  test('should mark files as read', () => {
    const readSet = createFileReadTracker()

    markAsRead(readSet, '/path/to/file.ts')

    expect(hasBeenRead(readSet, '/path/to/file.ts')).toBe(true)
    expect(hasBeenRead(readSet, '/other/path.ts')).toBe(false)
  })

  test('should track multiple files', () => {
    const readSet = createFileReadTracker()

    markAsRead(readSet, '/file1.ts')
    markAsRead(readSet, '/file2.ts')
    markAsRead(readSet, '/file3.ts')

    expect(getReadFiles(readSet)).toEqual(['/file1.ts', '/file2.ts', '/file3.ts'])
    expect(getReadCount(readSet)).toBe(3)
  })

  test('should create independent trackers', () => {
    const readSet1 = createFileReadTracker()
    const readSet2 = createFileReadTracker()

    markAsRead(readSet1, '/file1.ts')
    markAsRead(readSet2, '/file2.ts')

    expect(hasBeenRead(readSet1, '/file1.ts')).toBe(true)
    expect(hasBeenRead(readSet1, '/file2.ts')).toBe(false)
    expect(hasBeenRead(readSet2, '/file1.ts')).toBe(false)
    expect(hasBeenRead(readSet2, '/file2.ts')).toBe(true)
  })
})
```

---

### Phase 2: Workflow Integration (1-2 hours)

**Objective**: Integrate readSet into workflow context so tool handlers can access it

#### 2.1 Update Tool Handler Signature

**Problem**: Current tool handlers don't have access to a shared context/state.

**Current signature**:
```typescript
export type ToolHandler<_T, P> = (
  provider: P,
  args: Partial<Record<string, ToolParameterValue>>
) => Promise<ToolResponse>
```

**Solution**: Add an optional context parameter for shared state.

**File**: `packages/core/src/tool.ts`

```typescript
export type ToolContext = {
  // Shared state for tool handlers (optional, for features like read-first enforcement)
  readSet?: Set<string>
  // Can be extended with other shared state in the future
  metadata?: Record<string, unknown>
}

export type ToolHandler<_T, P> = (
  provider: P,
  args: Partial<Record<string, ToolParameterValue>>,
  context?: ToolContext  // NEW: Optional context parameter
) => Promise<ToolResponse>
```

**Why**:
- ✅ Backward compatible (context is optional)
- ✅ Simple functional approach (no classes)
- ✅ Explicit dependencies (clear what state is available)
- ✅ Extensible (can add more context fields later)

#### 2.2 Create Context at Workflow Start

**File**: `packages/cli/src/workflows/code.workflow.ts` (and other workflows)

**Changes**: Create readSet at workflow initialization and pass through context.

```typescript
import { createFileReadTracker } from '@polka-codes/core/utils/fileReadTracker'
import type { ToolContext } from '@polka-codes/core/tool'

export async function codeWorkflow(input: CodeInput, options: WorkflowOptions) {
  // Create readSet for this session
  const readSet = createFileReadTracker()

  // Create tool context with readSet
  const toolContext: ToolContext = {
    readSet,
    metadata: {
      sessionId: generateSessionId(),
      startTime: Date.now()
    }
  }

  // Pass toolContext to tool invocations
  const result = await runAgent({
    ...options,
    toolContext,  // NEW: Pass context to agent
  })

  return result
}
```

**Why**: Each workflow session gets its own independent readSet.

#### 2.3 Update Tool Invocation to Pass Context

**File**: `packages/core/src/workflow/agent.ts` (or wherever tools are invoked)

**Changes**: When executing tool handlers, pass the context.

```typescript
async function executeTool(
  toolInfo: FullToolInfo,
  args: Record<string, ToolParameterValue>,
  provider: FilesystemProvider,
  toolContext?: ToolContext  // NEW: Accept context
): Promise<ToolResponse> {
  // Call tool handler with provider, args, and context
  const result = await toolInfo.handler(provider, args, toolContext)

  return result
}
```

#### 2.4 Update readFile Tool

**File**: `packages/core/src/tools/readFile.ts`

**Changes**:
1. Import fileReadTracker functions
2. Mark files as read after successful read
3. Add optional offset/limit parameters (for Phase 3)
4. Add line numbers to output
5. Update handler signature to accept context

```typescript
import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'
import { createFileElement, createProviderError, preprocessBoolean } from './utils'
import { markAsRead } from './utils/fileReadTracker'  // NEW

export const toolInfo = {
  name: 'readFile',
  description: `Request to read the contents of one or multiple files at the specified paths.

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
- Line numbers included for easy reference
- Optional offset/limit for partial file reading
- Automatically handles different file types

IMPORTANT:
- Reading a file is required before writeToFile or replaceInFile
- Line numbers are included for easy reference
- Use offset/limit for large files to read specific sections`,

  parameters: z
    .object({
      path: z
        .preprocess((val) => {
          if (!val) return []
          const values = Array.isArray(val) ? val : [val]
          return values.flatMap((i) => (typeof i === 'string' ? i.split(',') : [])).filter((s) => s.length > 0)
        }, z.array(z.string()))
        .describe('The path of the file to read')
        .meta({ usageValue: 'Comma separated paths here' }),
      offset: z.number().optional()
        .describe('Skip first N lines (for partial file reading)')
        .meta({ usageValue: '100' }),
      limit: z.number().optional()
        .describe('Read at most N lines (for partial file reading)')
        .meta({ usageValue: '50' }),
      includeIgnored: z
        .preprocess(preprocessBoolean, z.boolean().nullish().default(false))
        .describe('Whether to include ignored files. Use true to include files ignored by .gitignore.')
        .meta({ usageValue: 'true or false (optional)' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to read the contents of a file',
          input: {
            path: 'src/main.js',
          },
        },
        {
          description: 'Request to read multiple files',
          input: {
            path: 'src/main.js,src/index.js',
          },
        },
        {
          description: 'Read partial file (lines 100-150)',
          input: {
            path: 'src/large-file.ts',
            offset: 100,
            limit: 50
          }
        }
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (
  provider,
  args,
  context  // NEW: Accept context parameter
) => {
  if (!provider.readFile) {
    return createProviderError('read file')
  }

  const { path: paths, offset, limit, includeIgnored } = toolInfo.parameters.parse(args)
  const readSet = context?.readSet  // NEW: Extract readSet from context

  const resp = []
  for (const path of paths) {
    const fileContent = await provider.readFile(path, includeIgnored ?? false)

    if (!fileContent) {
      resp.push(createFileElement('read_file_file_content', path, undefined, { file_not_found: 'true' }))
      continue
    }

    // Track that file was read (NEW)
    if (readSet) {
      markAsRead(readSet, path)
    }

    // Apply offset/limit if specified (NEW)
    let lines = fileContent.split('\n')
    const start = offset ?? 0
    const end = limit ? start + limit : lines.length
    if (offset !== undefined || limit !== undefined) {
      lines = lines.slice(start, end)
    }

    // Add line numbers (NEW)
    const lineOffset = offset ?? 0
    const numberedContent = lines
      .map((line, i) => {
        const lineNumber = lineOffset + i + 1
        const paddedNumber = String(lineNumber).padStart(6, ' ')
        return `${paddedNumber}→${line}`
      })
      .join('\n')

    resp.push(createFileElement('read_file_file_content', path, numberedContent))
  }

  return {
    success: true,
    message: {
      type: 'text',
      value: resp.join('\n'),
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
```

**Key Changes**:
1. ✅ Import fileReadTracker functions
2. ✅ Add context parameter to handler
3. ✅ Extract readSet from context
4. ✅ Mark files as read: `markAsRead(readSet, path)`
5. ✅ Add offset/limit parameters
6. ✅ Add line numbers to output
7. ✅ Enhanced description

#### 2.5 Update writeToFile Tool

**File**: `packages/core/src/tools/writeToFile.ts`

**Changes**:
1. Import fileReadTracker functions
2. Check if file exists (add to FilesystemProvider)
3. Enforce read-first if file exists
4. Update handler to accept context
5. Enhanced description

```typescript
import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'
import { createProviderError } from './utils'
import { hasBeenRead } from './utils/fileReadTracker'  // NEW

export const toolInfo = {
  name: 'writeToFile',
  description: `Request to write content to a file at the specified path.

IMPORTANT: You MUST use readFile at least once before using writeToFile
on an existing file. The system enforces this requirement.

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
- This prevents accidental overwrites and ensures informed changes`,

  parameters: z
    .object({
      path: z.string().describe('The path of the file to write to').meta({ usageValue: 'File path here' }),
      content: z
        .string()
        .describe(
          "The content to write to the file. ALWAYS provide the COMPLETE intended content of the file, without any truncation or omissions. You MUST include ALL parts of the file, even if they haven't been modified.",
        )
        .meta({ usageValue: 'Your file content here' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to write content to a file',
          input: {
            path: 'src/main.js',
            content: `import React from 'react';

function App() {
  return (
    <div>
      <h1>Hello, World!</h1>
    </div>
  );
}

export default App;
`,
          },
        },
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (
  provider,
  args,
  context  // NEW: Accept context parameter
) => {
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
  const readSet = context?.readSet  // NEW: Extract readSet from context

  // NEW: Check if file exists and has been read
  // Use optional chaining for fileExists method
  const fileExists = provider.fileExists ? await provider.fileExists(path) : true
  if (fileExists && readSet && !hasBeenRead(readSet, path)) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `ERROR: You must read the file "${path}" first before writing to it.

This safety requirement ensures you understand the current file state before
making changes, preventing accidental overwrites and data loss.

To fix this:
1. Use readFile('${path}') to read the file first
2. Then proceed with writeToFile('${path}', content)

If you intentionally want to create a new file, use a different filename or
delete the existing file first.

File: ${path}
Error: Must read file before writing to existing file`
      }
    }
  }

  const trimmedContent = content.trim()
  if (trimmedContent.startsWith('<![CDATA[') && trimmedContent.endsWith(']]>')) {
    content = trimmedContent.slice(9, -3)
  }

  await provider.writeFile(path, content)

  return {
    success: true,
    message: {
      type: 'text',
      value: `<write_to_file_path>${path}</write_to_file_path><status>Success</status>`,
    },
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
```

**Key Changes**:
1. ✅ Import fileReadTracker functions
2. ✅ Add context parameter to handler
3. ✅ Extract readSet from context
4. ✅ Check if file exists: `provider.fileExists?(path)`
5. ✅ Enforce read-first: `hasBeenRead(readSet, path)`
6. ✅ Helpful error message with fix instructions
7. ✅ Enhanced description

#### 2.6 Add fileExists to FilesystemProvider

**File**: `packages/core/src/tools/provider.ts`

```typescript
export interface FilesystemProvider {
  readFile(path: string, includeIgnored?: boolean): Promise<string | null>
  writeFile(path: string, content: string): Promise<void>
  fileExists?(path: string): Promise<boolean>  // NEW: Optional method
}
```

**Why**: Make it optional for backward compatibility.

#### 2.7 Update replaceInFile Tool

**File**: `packages/core/src/tools/replaceInFile.ts`

**Changes**:
1. Import fileReadTracker functions
2. Enforce read-first
3. Update handler to accept context
4. Enhanced description

```typescript
// generated by polka.codes
import { z } from 'zod'
import type { FullToolInfo, ToolHandler, ToolInfo } from '../tool'
import type { FilesystemProvider } from './provider'
import { replaceInFile } from './utils/replaceInFile'
import { hasBeenRead } from './utils/fileReadTracker'  // NEW

export const toolInfo = {
  name: 'replaceInFile',
  description: `Request to replace sections of content in an existing file using
SEARCH/REPLACE blocks.

IMPORTANT: You MUST use readFile at least once before using replaceInFile
on an existing file. The system enforces this requirement.

When to use:
- Making targeted changes to specific parts of a file
- Replacing variable names, function signatures, imports
- Fixing bugs in existing code
- When you know the exact content to replace

When NOT to use:
- For creating new files: Use writeToFile instead
- For completely replacing file contents: Use writeToFile instead
- When you don't know the exact content: Read file first

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

IMPORTANT CONSTRAINTS:
- MUST read file first before editing (enforced by system)
- SEARCH text must match file content exactly
- Each block is independent (doesn't affect other blocks)
- Cannot use for appending or inserting without SEARCH context`,

  parameters: z
    .object({
      path: z.string().describe('The path of the file to modify').meta({ usageValue: 'File path here' }),
      diff: z
        .string()
        .describe(
          `One or more SEARCH/REPLACE blocks following this exact format:
\`\`\`
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE
\`\`\`
Critical rules:
1. SEARCH content must match the associated file section to find EXACTLY:
    * Match character-for-character including whitespace, indentation, line endings
    * Include all comments, docstrings, etc.
2. SEARCH/REPLACE blocks will ONLY replace the first match occurrence.
    * Including multiple unique SEARCH/REPLACE blocks if you need to make multiple changes.
    * Include *just* enough lines in each SEARCH section to uniquely match each set of lines that need to change.
    * When using multiple SEARCH/REPLACE blocks, list them in the order they appear in the file.
3. Keep SEARCH/REPLACE blocks concise:
    * Break large SEARCH/REPLACE blocks into a series of smaller blocks that each change a small portion of the file.
    * Include just the changing lines, and a few surrounding lines if needed for uniqueness.
    * Do not include long runs of unchanging lines in SEARCH/REPLACE blocks.
    * Each line must be complete. Never truncate lines mid-way through as this can cause matching failures.
4. Special operations:
    * To move code: Use two SEARCH/REPLACE blocks (one to delete from original + one to insert at new location)
    * To delete code: Use empty REPLACE section`,
        )
        .meta({ usageValue: 'Search and replace blocks here' }),
    })
    .meta({
      examples: [
        {
          description: 'Request to replace sections of content in a file',
          input: {
            path: 'src/main.js',
            diff: `<<<<<<< SEARCH
import React from 'react';
=======
import React, { useState } from 'react';
>>>>>>> REPLACE
<<<<<<< SEARCH
function handleSubmit() {
  saveData();
  setLoading(false);
}

=======
>>>>>>> REPLACE
<<<<<<< SEARCH
return (
  <div>
=======
function handleSubmit() {
  saveData();
  setLoading(false);
}

return (
  <div>
>>>>>>> REPLACE`,
          },
        },
        {
          description: 'Request to perform a simple, single-line replacement',
          input: {
            path: 'src/config.js',
            diff: `<<<<<<< SEARCH
const API_URL = 'https://api.example.com';
=======
const API_URL = 'https://api.staging.example.com';
>>>>>>> REPLACE`,
          },
        },
        {
          description: 'Request to add a new function to a file',
          input: {
            path: 'src/utils.js',
            diff: `<<<<<<< SEARCH
function helperA() {
  // ...
}
=======
function helperA() {
  // ...
}

function newHelper() {
  // implementation
}
>>>>>>> REPLACE`,
          },
        },
        {
          description: 'Request to delete a block of code from a file',
          input: {
            path: 'src/app.js',
            diff: `<<<<<<< SEARCH
function oldFeature() {
  // This is no longer needed
}

=======
>>>>>>> REPLACE`,
          },
        },
      ],
    }),
} as const satisfies ToolInfo

export const handler: ToolHandler<typeof toolInfo, FilesystemProvider> = async (
  provider,
  args,
  context  // NEW: Accept context parameter
) => {
  if (!provider.readFile || !provider.writeFile) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: 'Not possible to replace in file.',
      },
    }
  }

  const readSet = context?.readSet  // NEW: Extract readSet from context

  // NEW: Check if file has been read
  if (readSet && !hasBeenRead(readSet, args.path)) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `ERROR: You must read the file "${args.path}" first before editing it.

This safety requirement ensures you understand the current file state before
making changes, preventing edits based on incorrect assumptions.

To fix this:
1. Use readFile('${args.path}') to read the file first
2. Verify the SEARCH sections match the file content exactly
3. Then proceed with replaceInFile with the correct SEARCH/REPLACE blocks

File: ${args.path}
Error: Must read file before editing`
      }
    }
  }

  const parsed = toolInfo.parameters.safeParse(args)
  if (!parsed.success) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for replaceInFile: ${parsed.error.message}`,
      },
    }
  }
  const { path, diff } = parsed.data

  try {
    const fileContent = await provider.readFile(path, false)

    if (fileContent == null) {
      return {
        success: false,
        message: {
          type: 'error-text',
          value: `<replace_in_file_result path="${path}" status="failed" message="File not found" />`,
        },
      }
    }

    const result = replaceInFile(fileContent, diff)

    if (result.status === 'no_diff_applied') {
      return {
        success: false,
        message: {
          type: 'error-text',
          value: `<replace_in_file_result path="${path}" status="failed" message="Unable to apply changes">
  <file_content path="${path}">${fileContent}</file_content>
</replace_in_file_result>`,
        },
      }
    }

    await provider.writeFile(path, result.content)

    if (result.status === 'some_diff_applied') {
      return {
        success: true,
        message: {
          type: 'text',
          value: `<replace_in_file_result path="${path}" status="some_diff_applied" applied_count="${result.appliedCount}" total_count="${result.totalCount}">
  <file_content path="${path}">${result.content}</file_content>
</replace_in_file_result>`,
        },
      }
    }

    return {
      success: true,
      message: {
        type: 'text',
        value: `<replace_in_file_result path="${path}" status="all_diff_applied" />`,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `Invalid arguments for replaceInFile: ${error}`,
      },
    }
  }
}

export default {
  ...toolInfo,
  handler,
} satisfies FullToolInfo
```

**Key Changes**:
1. ✅ Import fileReadTracker functions
2. ✅ Add context parameter to handler
3. ✅ Extract readSet from context
4. ✅ Enforce read-first: `hasBeenRead(readSet, args.path)`
5. ✅ Helpful error message with fix instructions
6. ✅ Enhanced description

---

### Phase 3: Testing (2-3 hours)

**Objective**: Comprehensive test coverage

#### 3.1 readFile Tests

**File**: `packages/core/src/tools/readFile.test.ts`

```typescript
import { describe, expect, test } from 'bun:test'
import { toolInfo, handler } from './readFile'
import type { FilesystemProvider } from './provider'
import { clearReadTracking } from './utils/fileReadTracker'

describe('readFile tool', () => {
  const mockProvider: FilesystemProvider = {
    readFile: async (path) => {
      if (path === 'test.txt') return 'line1\nline2\nline3'
      if (path === 'multi.txt') return 'content1'
      return null
    }
  }

  test('should read single file', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, { path: 'test.txt' })

    expect(result.success).toBe(true)
    expect(result.message.value).toContain('     1→line1')
    expect(result.message.value).toContain('     2→line2')
    expect(result.message.value).toContain('     3→line3')
    expect(hasBeenRead('test.txt')).toBe(true)
  })

  test('should read multiple files', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, { path: 'test.txt,multi.txt' })

    expect(result.success).toBe(true)
    expect(hasBeenRead('test.txt')).toBe(true)
    expect(fileReadTracker.hasBeenRead('multi.txt')).toBe(true)
  })

  test('should apply offset', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, {
      path: 'test.txt',
      offset: 1
    })

    expect(result.success).toBe(true)
    expect(result.message.value).toContain('     2→line2')
    expect(result.message.value).toContain('     3→line3')
    expect(result.message.value).not.toContain('line1')
  })

  test('should apply limit', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, {
      path: 'test.txt',
      limit: 2
    })

    expect(result.success).toBe(true)
    expect(result.message.value).toContain('     1→line1')
    expect(result.message.value).toContain('     2→line2')
    expect(result.message.value).not.toContain('line3')
  })

  test('should apply offset and limit together', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, {
      path: 'test.txt',
      offset: 1,
      limit: 1
    })

    expect(result.success).toBe(true)
    expect(result.message.value).toContain('     2→line2')
    expect(result.message.value).not.toContain('line1')
    expect(result.message.value).not.toContain('line3')
  })

  test('should handle file not found', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, { path: 'missing.txt' })

    expect(result.success).toBe(true)
    expect(result.message.value).toContain('file_not_found')
    expect(hasBeenRead('missing.txt')).toBe(false)
  })

  test('should include line numbers', async () => {
    clearReadTracking()

    const result = await handler(mockProvider, { path: 'test.txt' })

    expect(result.success).toBe(true)
    const lines = result.message.value.split('\n')
    expect(lines[0]).toMatch(/^\s*\d+→/)
    expect(lines[1]).toMatch(/^\s*\d+→/)
    expect(lines[2]).toMatch(/^\s*\d+→/)
  })
})
```

#### 3.2 writeToFile Tests

**File**: `packages/core/src/tools/writeToFile.test.ts`

```typescript
import { describe, expect, test } from 'bun:test'
import { toolInfo, handler } from './writeToFile'
import type { FilesystemProvider } from './provider'
import { markAsRead, hasBeenRead } from './utils/fileReadTracker'

describe('writeToFile tool', () => {
  let writtenFiles: Map<string, string> = new Map()

  const mockProvider: FilesystemProvider = {
    writeFile: async (path, content) => {
      writtenFiles.set(path, content)
    },
    fileExists: async (path) => writtenFiles.has(path)
  }

  beforeEach(() => {
    writtenFiles.clear()
    // Note: We don't clear tracking here to test enforcement
  })

  test('should write new file without reading', async () => {
    const result = await handler(mockProvider, {
      path: 'new.txt',
      content: 'content'
    })

    expect(result.success).toBe(true)
    expect(writtenFiles.get('new.txt')).toBe('content')
  })

  test('should fail when writing existing file without reading', async () => {
    // Pre-populate file
    writtenFiles.set('existing.txt', 'old content')

    const result = await handler(mockProvider, {
      path: 'existing.txt',
      content: 'new content'
    })

    expect(result.success).toBe(false)
    expect(result.message.value).toContain('Must read file first')
    expect(writtenFiles.get('existing.txt')).toBe('old content') // Unchanged
  })

  test('should succeed when writing existing file after reading', async () => {
    // Pre-populate and mark as read
    writtenFiles.set('existing.txt', 'old content')
    markAsRead('existing.txt')

    const result = await handler(mockProvider, {
      path: 'existing.txt',
      content: 'new content'
    })

    expect(result.success).toBe(true)
    expect(writtenFiles.get('existing.txt')).toBe('new content')
  })

  test('should remove CDATA tags', async () => {
    const result = await handler(mockProvider, {
      path: 'test.xml',
      content: '<![CDATA[content]]>'
    })

    expect(result.success).toBe(true)
    expect(writtenFiles.get('test.xml')).toBe('content')
  })
})
```

#### 3.3 replaceInFile Tests

**File**: `packages/core/src/tools/replaceInFile.test.ts`

```typescript
import { describe, expect, test } from 'bun:test'
import { toolInfo, handler } from './replaceInFile'
import type { FilesystemProvider } from './provider'
import { markAsRead, hasBeenRead } from './utils/fileReadTracker'

describe('replaceInFile tool', () => {
  let fileContent: Map<string, string> = new Map()

  const mockProvider: FilesystemProvider = {
    readFile: async (path) => fileContent.get(path) || null,
    writeFile: async (path, content) => {
      fileContent.set(path, content)
    }
  }

  beforeEach(() => {
    fileContent.clear()
    // Note: We don't clear tracking here to test enforcement
  })

  test('should fail when editing file without reading', async () => {
    fileContent.set('test.ts', 'old content')

    const result = await handler(mockProvider, {
      path: 'test.ts',
      diff: `<<<<<<< SEARCH
old content
=======
new content
>>>>>>> REPLACE`
    })

    expect(result.success).toBe(false)
    expect(result.message.value).toContain('Must read file first')
    expect(fileContent.get('test.ts')).toBe('old content') // Unchanged
  })

  test('should succeed when editing file after reading', async () => {
    fileContent.set('test.ts', 'old content')
    markAsRead('test.ts')

    const result = await handler(mockProvider, {
      path: 'test.ts',
      diff: `<<<<<<< SEARCH
old content
=======
new content
>>>>>>> REPLACE`
    })

    expect(result.success).toBe(true)
    expect(fileContent.get('test.ts')).toBe('new content')
  })

  test('should apply multiple replacements', async () => {
    fileContent.set('test.ts', 'line1\nline2\nline3')
    fileReadTracker.markAsRead('test.ts')

    const result = await handler(mockProvider, {
      path: 'test.ts',
      diff: `<<<<<<< SEARCH
line1
=======
LINE1
>>>>>>> REPLACE
<<<<<<< SEARCH
line3
=======
LINE3
>>>>>>> REPLACE`
    })

    expect(result.success).toBe(true)
    expect(fileContent.get('test.ts')).toBe('LINE1\nline2\nLINE3')
  })
})
```

---

### Phase 4: Documentation (1 hour)

**Objective**: Update documentation and examples

#### 4.1 Update README

**File**: `README.md` (or relevant docs)

```markdown
## File Operation Safety

Polka Codes enforces "read first" safety for all write/edit operations:

### Safe Workflow

1. **Read the file first**
   \```typescript
   readFile('src/config.ts')
   \```

2. **Make changes**
   \```typescript
   // For targeted edits
   replaceInFile({
     path: 'src/config.ts',
     diff: '<<<<<<< SEARCH\nold\n=======\nnew\n>>>>>>> REPLACE'
   })

   // Or complete replacement
   writeToFile({
     path: 'src/config.ts',
     content: 'new content'
   })
   \```

### Enforcement

The system automatically prevents:
- Writing to existing files without reading
- Editing files without understanding context
- Accidental data loss

This matches Claude Code's proven safety approach.
```

#### 4.2 Update Tool Descriptions

Already done in Phase 2 - descriptions now include:
- ✅ "When to use" sections
- ✅ "When NOT to use" sections
- ✅ Safety constraints
- ✅ Tool references

---

## Implementation Checklist

### Phase 1: File Read Tracking (2-3 hours)
- [ ] Create `packages/core/src/utils/fileReadTracker.ts`
- [ ] Implement `createFileReadTracker()`
- [ ] Implement `markAsRead(readSet, path)`
- [ ] Implement `hasBeenRead(readSet, path)`
- [ ] Implement `getReadFiles(readSet)`
- [ ] Implement `getReadCount(readSet)`
- [ ] Add tests for fileReadTracker
- [ ] Export from `packages/core/src/tools/index.ts`
- [ ] All tests passing

### Phase 2: Workflow Integration (1-2 hours)
- [ ] Update `packages/core/src/tool.ts`
  - [ ] Add `ToolContext` type
  - [ ] Update `ToolHandler` signature to accept optional context
- [ ] Update workflow tool execution
  - [ ] Accept context parameter
  - [ ] Pass context to tool handlers
- [ ] Update workflow initialization
  - [ ] Create readSet at workflow start
  - [ ] Create toolContext with readSet
  - [ ] Pass toolContext to agent/workflow
- [ ] All tests passing

### Phase 3: Tool Updates (2-3 hours)
- [ ] Update `packages/core/src/tools/readFile.ts`
  - [ ] Import fileReadTracker functions
  - [ ] Add context parameter to handler
  - [ ] Extract readSet from context
  - [ ] Mark files as read after successful read
  - [ ] Add offset/limit parameters
  - [ ] Add line numbers to output
  - [ ] Update description
  - [ ] Add tests
- [ ] Update `packages/core/src/tools/writeToFile.ts`
  - [ ] Import fileReadTracker functions
  - [ ] Add context parameter to handler
  - [ ] Extract readSet from context
  - [ ] Add fileExists check (with optional chaining)
  - [ ] Enforce read-first
  - [ ] Update description
  - [ ] Add tests
- [ ] Update `packages/core/src/tools/replaceInFile.ts`
  - [ ] Import fileReadTracker functions
  - [ ] Add context parameter to handler
  - [ ] Extract readSet from context
  - [ ] Enforce read-first
  - [ ] Update description
  - [ ] Add tests
- [ ] Add fileExists to FilesystemProvider (optional)
- [ ] All tool tests passing

### Phase 4: Testing (2-3 hours)
- [ ] readFile tests (6 tests)
  - [ ] Single file read with line numbers
  - [ ] Multiple file reads
  - [ ] Offset parameter
  - [ ] Limit parameter
  - [ ] Offset + limit together
  - [ ] File not found handling
- [ ] writeToFile tests (4 tests)
  - [ ] Write new file without reading
  - [ ] Fail when writing existing file without reading
  - [ ] Succeed when writing after reading
  - [ ] CDATA tag removal
- [ ] replaceInFile tests (3 tests)
  - [ ] Fail when editing without reading
  - [ ] Succeed when editing after reading
  - [ ] Multiple replacements
- [ ] Integration tests
  - [ ] Full workflow with read-first enforcement
  - [ ] Context persistence across tool calls
- [ ] All tests passing

### Phase 5: Documentation (1 hour)
- [ ] Update README with safety features
- [ ] Update examples
- [ ] Update CHANGELOG
- [ ] Document ToolContext type
- [ ] Document backward compatibility

---

## Success Criteria

✅ **Functional Requirements**:
- All file operations enforce read-first
- Line numbers included in file output
- Partial file reading supported (offset/limit)

✅ **Quality Requirements**:
- 100% test coverage for new features
- All existing tests still passing
- No breaking changes to API

✅ **Usability Requirements**:
- Clear error messages guide corrections
- Enhanced tool descriptions
- Backward compatible (existing code works)

---

## Risk Mitigation

### Risk 1: Breaking Existing Workflows

**Mitigation**:
- Read-first only enforced for existing files
- New files can still be created directly
- Graceful error messages guide users

### Risk 2: Performance Impact

**Mitigation**:
- In-memory tracking (minimal overhead)
- Optional fileExists method (backward compatible)
- No additional I/O operations

### Risk 3: Provider Compatibility

**Mitigation**:
- Make fileExists optional in FilesystemProvider
- Default to "file exists" if method not available
- Document upgrade path for providers

---

## Rollout Plan

1. **Week 1**: Implement Phase 1 (File Read Tracking)
2. **Week 1**: Implement Phase 2 (Workflow Integration)
3. **Week 1**: Implement Phase 3 (Tool Updates)
4. **Week 1**: Implement Phase 4 (Testing)
5. **Week 1**: Implement Phase 5 (Documentation)
6. **Week 1**: Internal testing and validation
7. **Week 2**: Release in v0.9.89

---

## Future Enhancements

### Potential Improvements

1. **Configurable Enforcement**
   ```yaml
   safety:
     readFirstEnforcement: true  # Can be disabled if needed
   ```

2. **Whitelist Patterns**
   ```yaml
   safety:
     readFirstWhitelist:
       - "*.log"        # Log files don't require read-first
       - "*.tmp"        # Temp files don't require read-first
   ```

3. **Read Tracking Expiry**
   ```typescript
   // Expire read tracking after N minutes
   fileReadTracker.setExpiry(30 * 60 * 1000) // 30 minutes
   ```

4. **Statistics**
   ```typescript
   // Track enforcement statistics
   fileReadTracker.getStats()
   // { preventedOverwrites: 15, enforcedReads: 150 }
   ```

---

## References

- Claude Code Tool Descriptions: `research/02-tools-system.md`
- File Tools Comparison: `research/08-file-tools-deep-dive-comparison.md`
- Claude Code vs Polka Codes: `research/05-claude-code-vs-polka-codes-comparison.md`

---

**Plan Status**: ✅ Ready for Implementation
**Next Step**: Begin Phase 1 (File Read Tracking System)
**Owner**: Core Team
**Reviewers**: Safety Team, Documentation Team
