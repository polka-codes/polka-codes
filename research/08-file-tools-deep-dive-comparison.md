# File Tools Deep Dive: Claude Code vs Polka Codes

**Date**: January 2026
**Focus**: Detailed comparison of file read/write/edit tools

---

## Executive Summary

Both systems have similar file operation tools, but with **critical philosophical and implementation differences** that significantly affect safety and usability.

**Key Finding**: Claude Code's **"read first" enforcement** is the single most important safety feature that Polka Codes lacks.

---

## Table of Contents

1. [Tool Overview](#1-tool-overview)
2. [Read Tool Comparison](#2-read-tool-comparison)
3. [Write Tool Comparison](#3-write-tool-comparison)
4. [Edit Tool Comparison](#4-edit-tool-comparison)
5. [Critical Safety Differences](#5-critical-safety-differences)
6. [Implementation Philosophy](#6-implementation-philosophy)
7. [Recommendations](#7-recommendations)

---

## 1. Tool Overview

### Tool Mapping

| Operation | Claude Code | Polka Codes | Purpose |
|-----------|-------------|-------------|---------|
| Read File | `Read` | `readFile` | Read file contents |
| Write File | `Write` | `writeToFile` | Create/overwrite files |
| Edit File | `Edit` | `replaceInFile` | String replacement |
| List Files | `Glob` | `listFiles` | File name patterns |
| Search Content | `Grep` | **MISSING** | Search within files |

### Feature Comparison Matrix

| Feature | Claude Code | Polka Codes | Advantage |
|---------|-------------|-------------|-----------|
| **Read multiple files** | ❌ No | ✅ Yes (comma-separated) | Polka |
| **Line offset/limit** | ✅ Yes | ❌ No | Claude |
| **Read images** | ✅ Yes (PNG, JPG) | ❌ No | Claude |
| **Read PDFs** | ✅ Yes | ❌ No | Claude |
| **Read notebooks** | ✅ Yes | ❌ No | Claude |
| **Line numbers in output** | ✅ Yes (cat -n format) | ❌ No | Claude |
| **Binary file support** | ✅ Yes | ⚠️ Limited (readBinaryFile) | Claude |
| **Auto-create directories** | ❌ No | ✅ Yes | Polka |
| **"Read first" enforcement** | ✅ Yes | ❌ No | Claude |
| **Multiple edits at once** | ✅ Yes (SEARCH/REPLACE blocks) | ✅ Yes (SEARCH/REPLACE blocks) | Tie |
| **replace_all flag** | ✅ Yes | ❌ No | Claude |

---

## 2. Read Tool Comparison

### 2.1 Claude Code - Read Tool (439 tokens)

**Description**:
```
Use this tool to get the contents of a file from the local filesystem.

Features:
- Supports offset/limit for reading specific portions of large files
- Can read images (PNG, JPG), PDFs, Jupyter notebooks
- Returns output in cat -n format with line numbers

When not to use:
- For simple file existence checks, use Glob instead
- For searching within files, use Grep tool
- Prefer this tool over bash commands like cat/head/tail
```

**Parameters**:
```json
{
  "file_path": "string (required)",
  "offset": "number (optional, default 0)",
  "limit": "number (optional, read entire file)"
}
```

**Output Format**:
```
1→import React from 'react';
2→
3→function App() {
4→  return <div>Hello</div>;
5→}
```

**Key Features**:
1. ✅ **Line numbers**: Always included (cat -n format)
2. ✅ **Partial reads**: offset/limit for large files
3. ✅ **Multimedia**: Images, PDFs, notebooks
4. ✅ **Smart guidance**: When NOT to use

---

### 2.2 Polka Codes - readFile Tool (~100 tokens)

**Description**:
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

**Parameters**:
```typescript
{
  path: "string or array (required, comma-separated)",
  includeIgnored: "boolean (optional, default false)"
}
```

**Output Format**:
```
<read_file_file_content path="src/main.ts">
import React from 'react';

function App() {
  return <div>Hello</div>;
}
</read_file_file_content>
```

**Key Features**:
1. ✅ **Multiple files**: Comma-separated paths
2. ✅ **Gitignore aware**: includeIgnored flag
3. ✅ **XML output**: Structured tags
4. ❌ **No line numbers**: Plain text
5. ❌ **No partial reads**: All or nothing
6. ❌ **No multimedia**: Text only

---

### 2.3 Key Differences

| Aspect | Claude Code | Polka Codes | Winner |
|--------|-------------|-------------|--------|
| **Multiple files** | One at a time | Comma-separated | Polka |
| **Line numbers** | Always included | Never | Claude |
| **Partial reads** | offset/limit | No | Claude |
| **Multimedia** | Images, PDFs, notebooks | No | Claude |
| **Gitignore** | Not mentioned | Yes (includeIgnored) | Polka |
| **Output format** | Plain with line numbers | XML tags | Claude (clearer) |

**Trade-off Analysis**:
- **Claude Code**: Better for **large files** (partial reads) and **multimedia**
- **Polka Codes**: Better for **bulk operations** (multiple files at once)

---

## 3. Write Tool Comparison

### 3.1 Claude Code - Write Tool (159 tokens)

**Description**:
```
Use this tool to create a new file or completely overwrite an existing file.

Before using this tool, you MUST use the Read tool to read the file first.
This tool will error if you attempt to edit a file without reading it first.

When to use:
- Creating new files
- Completely replacing file contents

When NOT to use:
- For modifying existing files: Use Edit tool instead
- For appending: Use bash echo with >> instead

CRITICAL: Always read files before editing them. This tool enforces this
requirement to prevent accidental overwrites.
```

**Parameters**:
```json
{
  "file_path": "string (required)",
  "content": "string (required)"
}
```

**Enforcement**:
```typescript
// System enforces "read first" requirement
if (!fileHasBeenRead(file_path)) {
  throw new Error("Must read file before writing to it")
}
```

**Key Features**:
1. ✅ **"Read first" enforced**: Cannot write without reading
2. ✅ **Clear guidance**: When to use vs NOT use
3. ✅ **Safety first**: Prevents accidental overwrites
4. ✅ **Tool references**: Points to Edit tool for modifications

---

### 3.2 Polka Codes - writeToFile Tool (~80 tokens)

**Description**:
```typescript
description: "Request to write content to a file at the specified path. If
the file exists, it will be overwritten with the provided content. If the
file doesn't exist, it will be created. This tool will automatically create
any directories needed to write the file. Ensure that the output content
does not include incorrect escaped character patterns such as `&lt;`,
`&gt;`, or `&amp;`. Also ensure there is no unwanted CDATA tags in the
content."
```

**Parameters**:
```typescript
{
  path: "string (required)",
  content: "string (required, complete file content)"
}
```

**Handler**:
```typescript
export const handler = async (provider, args) => {
  const { path, content } = toolInfo.parameters.parse(args)

  // NO "read first" check!
  const trimmedContent = content.trim()
  if (trimmedContent.startsWith('<![CDATA[')) {
    content = trimmedContent.slice(9, -3)
  }

  await provider.writeFile(path, content)

  return {
    success: true,
    message: {
      type: 'text',
      value: `<write_to_file_path>${path}</write_to_file_path>
<status>Success</status>`
    }
  }
}
```

**Key Features**:
1. ✅ **Auto-create directories**: Creates parent dirs as needed
2. ✅ **CDATA cleaning**: Removes unwanted CDATA tags
3. ✅ **Escape warnings**: Warns about &lt;, &gt;, &amp;
4. ❌ **NO "read first"**: Can write without reading
5. ❌ **NO tool references**: No guidance on when to use what

---

### 3.3 Critical Safety Difference

**Claude Code**:
```typescript
// SAFE: Enforces read-first
const writtenFiles = new Set<string>()
const readFiles = new Set<string>()

function writeToFile(path, content) {
  if (fileExists(path) && !readFiles.has(path)) {
    return error("Must read file before writing")
  }
  // ... proceed with write
}
```

**Polka Codes**:
```typescript
// UNSAFE: No enforcement
function writeToFile(path, content) {
  // Direct write, no checks
  await provider.writeFile(path, content)
}
```

**Impact**:
- ❌ **Polka Codes risk**: Accidental file overwrites
- ❌ **Polka Codes risk**: Loss of work
- ❌ **Polka Codes risk**: Unintended modifications
- ✅ **Claude Code safety**: Prevents all above

---

## 4. Edit Tool Comparison

### 4.1 Claude Code - Edit Tool (278 tokens)

**Description**:
```
Performs exact string replacements in files.

IMPORTANT: You MUST use the Read tool at least once before editing a file.
This tool will error if you attempt to edit a file without reading it first.

When to use:
- Make targeted changes to specific parts of a file
- Replace variable names, function signatures, imports
- Fix bugs in existing code

When NOT to use:
- For creating new files: Use Write tool
- For completely replacing file contents: Use Write tool
- For complex multi-file refactors: Consider using Task tool with subagent

Usage notes:
- old_string must be unique within the file
- Use replace_all for renaming variables across a file
- Always preserve exact indentation after line number prefix
```

**Parameters**:
```json
{
  "file_path": "string (required)",
  "old_string": "string (required, must be unique)",
  "new_string": "string (required)",
  "replace_all": "boolean (optional, default false)"
}
```

**Enforcement**:
```typescript
// System enforces "read first" requirement
if (!readFiles.has(file_path)) {
  throw new Error("Must read file before editing")
}

// Enforces uniqueness
if (!isUnique(old_string)) {
  return error("old_string must be unique in file")
}
```

**Key Features**:
1. ✅ **"Read first" enforced**: Cannot edit without reading
2. ✅ **Uniqueness check**: old_string must be unique
3. ✅ **replace_all flag**: Rename variables across file
4. ✅ **Clear guidance**: When to use vs NOT use
5. ✅ **Tool references**: Points to Write and Task tools

---

### 4.2 Polka Codes - replaceInFile Tool (~250 tokens)

**Description**:
```typescript
description: 'Request to replace sections of content in an existing file
using SEARCH/REPLACE blocks that define exact changes to specific parts of
the file. This tool should be used when you need to make targeted changes
to specific parts of a file.'

[... extensive SEARCH/REPLACE format documentation in parameters ...]
```

**Parameters**:
```typescript
{
  path: "string (required)",
  diff: "string (required, SEARCH/REPLACE blocks)"
}
```

**SEARCH/REPLACE Format**:
```
<<<<<<< SEARCH
[exact content to find]
=======
[new content to replace with]
>>>>>>> REPLACE
```

**Handler**:
```typescript
export const handler = async (provider, args) => {
  const { path, diff } = toolInfo.parameters.parse(args)

  // NO "read first" check!
  const fileContent = await provider.readFile(path, false)

  const result = replaceInFile(fileContent, diff)

  if (result.status === 'no_diff_applied') {
    return error("Unable to apply changes")
  }

  await provider.writeFile(path, result.content)

  return success()
}
```

**Key Features**:
1. ✅ **SEARCH/REPLACE blocks**: Multiple edits at once
2. ✅ **Multiple blocks**: List in order of appearance
3. ✅ **Delete support**: Empty REPLACE section
4. ✅ **Extensive documentation**: Format rules in parameters
5. ❌ **NO "read first"**: Can edit without reading
6. ❌ **No uniqueness check**: Can match multiple occurrences
7. ❌ **No tool references**: No guidance on alternatives

---

### 4.3 Format Comparison

**Claude Code Format**:
```typescript
// Simple string replacement
Edit({
  file_path: "src/main.ts",
  old_string: "const API_URL = 'https://api.example.com'",
  new_string: "const API_URL = 'https://api.staging.example.com'"
})

// With replace_all
Edit({
  file_path: "src/utils.ts",
  old_string: "oldName",
  new_string: "newName",
  replace_all: true
})
```

**Polka Codes Format**:
```
<<<<<<< SEARCH
const API_URL = 'https://api.example.com';
=======
const API_URL = 'https://api.staging.example.com';
>>>>>>> REPLACE
```

**Comparison**:
| Aspect | Claude Code | Polka Codes | Winner |
|--------|-------------|-------------|--------|
| **Simplicity** | JSON parameters | SEARCH/REPLACE blocks | Claude |
| **Multiple edits** | Multiple calls | Multiple blocks | Polka |
| **Replace all** | Built-in flag | Need multiple blocks | Claude |
| **Delete operations** | Empty new_string | Empty REPLACE | Tie |
| **Clarity** | Explicit parameters | Block format | Claude |

**Trade-off**:
- **Claude Code**: Simpler, better for single edits
- **Polka Codes**: More powerful for complex multi-edits

---

## 5. Critical Safety Differences

### 5.1 "Read First" Enforcement

**Claude Code Approach**:
```typescript
// Global tracking
const readFiles = new Map<string, string>()

// Read tool
function Read(file_path) {
  const content = fs.readFile(file_path)
  readFiles.set(file_path, content)
  return content
}

// Write tool
function Write(file_path, content) {
  if (readFiles.has(file_path)) {
    throw new Error(`Must read ${file_path} before writing`)
  }
  fs.writeFile(file_path, content)
}

// Edit tool
function Edit(file_path, old_string, new_string) {
  if (!readFiles.has(file_path)) {
    throw new Error(`Must read ${file_path} before editing`)
  }
  const content = readFiles.get(file_path)
  const newContent = content.replace(old_string, new_string)
  fs.writeFile(file_path, newContent)
}
```

**Polka Codes Approach**:
```typescript
// NO tracking
function readFile(path) {
  return provider.readFile(path)
}

function writeToFile(path, content) {
  // NO check!
  provider.writeFile(path, content)
}

function replaceInFile(path, diff) {
  // NO check!
  const content = provider.readFile(path)
  const newContent = replaceInFile(content, diff)
  provider.writeFile(path, newContent)
}
```

### 5.2 Safety Impact Analysis

**Scenario 1: Accidental Overwrite**

**Claude Code**:
```
User: "Replace the API URL in config.ts"
AI: Tries Write → ERROR "Must read first"
AI: Reads config.ts → Sees content
AI: Uses Edit → Makes targeted change
✅ SAFE
```

**Polka Codes**:
```
User: "Replace the API URL in config.ts"
AI: Writes completely new config.ts
❌ ACCIDENTAL OVERWRITE - Lost original content!
```

**Scenario 2: Blind Edit**

**Claude Code**:
```
User: "Fix the bug in user.ts"
AI: Tries Edit → ERROR "Must read first"
AI: Reads user.ts → Understands context
AI: Uses Edit with precise old_string
✅ SAFE
```

**Polka Codes**:
```
User: "Fix the bug in user.ts"
AI: Uses replaceInFile blindly
❌ MIGHT FAIL if old_string doesn't match exactly
❌ MATCH WRONG OCCURRENCE if multiple matches
```

### 5.3 Error Prevention

**Claude Code Errors Prevented**:
1. ✅ Accidental file overwrites
2. ✅ Loss of work
3. ✅ Unintended modifications
4. ✅ Blind edits (wrong context)
5. ✅ Multiple matches (uniqueness check)

**Polka Codes Vulnerabilities**:
1. ❌ Can overwrite without reading
2. ❌ Can edit without understanding context
3. ❌ Can match wrong occurrence
4. ❌ Can fail silently (no uniqueness check)

---

## 6. Implementation Philosophy

### 6.1 Claude Code Philosophy

**"Safety Over Convenience"**:
- Enforce "read first" to prevent accidents
- Require uniqueness to prevent ambiguity
- Provide clear guidance on when to use what
- Reference alternative tools explicitly

**Result**:
- ✅ Fewer errors
- ✅ More predictable behavior
- ✅ Better user trust
- ⚠️ Slightly more verbose (must read first)

### 6.2 Polka Codes Philosophy

**"Convenience Over Safety"**:
- Allow direct writes (no read required)
- Allow bulk operations (multiple files)
- Auto-create directories
- Trust AI to make good decisions

**Result**:
- ✅ Faster operations (no read step)
- ✅ More flexibility
- ❌ Higher risk of errors
- ❌ Potential data loss

### 6.3 Type Safety vs Runtime Safety

**Claude Code**:
- Runtime validation
- Enforced constraints
- Error messages guide corrections

**Polka Codes**:
- Compile-time type safety (Zod)
- No runtime enforcement
- Trusts type system

**Gap**: Type safety doesn't prevent logical errors (overwriting without reading)

---

## 7. Recommendations

### 7.1 Critical: Add "Read First" Enforcement

**Priority**: **HIGHEST**

**Implementation**:

```typescript
// packages/cli/src/utils/fileReadTracker.ts

export class FileReadTracker {
  private readFiles = new Set<string>()

  markAsRead(path: string) {
    this.readFiles.add(path)
  }

  hasBeenRead(path: string): boolean {
    return this.readFiles.has(path)
  }

  clear() {
    this.readFiles.clear()
  }
}

// Singleton instance
export const fileReadTracker = new FileReadTracker()
```

**Update readFile**:
```typescript
// packages/core/src/tools/readFile.ts

import { fileReadTracker } from '@polka-codes/cli/utils/fileReadTracker'

export const handler = async (provider, args) => {
  const { path: paths } = toolInfo.parameters.parse(args)

  for (const path of paths) {
    const content = await provider.readFile(path, includeIgnored ?? false)
    fileReadTracker.markAsRead(path)  // NEW: Track read
    // ... rest of handler
  }
}
```

**Update writeToFile**:
```typescript
// packages/core/src/tools/writeToFile.ts

import { fileReadTracker } from '@polka-codes/cli/utils/fileReadTracker'

export const handler = async (provider, args) => {
  const { path, content } = toolInfo.parameters.parse(args)

  // NEW: Check if file exists and has been read
  const fileExists = await provider.fileExists?.(path) ?? true
  if (fileExists && !fileReadTracker.hasBeenRead(path)) {
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
delete the existing file first.`
      }
    }
  }

  // ... rest of handler
}
```

**Update replaceInFile**:
```typescript
// packages/core/src/tools/replaceInFile.ts

import { fileReadTracker } from '@polka-codes/cli/utils/fileReadTracker'

export const handler = async (provider, args) => {
  const { path, diff } = toolInfo.parameters.parse(args)

  // NEW: Check if file has been read
  if (!fileReadTracker.hasBeenRead(path)) {
    return {
      success: false,
      message: {
        type: 'error-text',
        value: `ERROR: You must read the file "${path}" first before editing it.

This safety requirement ensures you understand the current file state before
making changes, preventing edits based on incorrect assumptions.

To fix this:
1. Use readFile('${path}') to read the file first
2. Then proceed with replaceInFile with the correct SEARCH/REPLACE blocks`
      }
    }
  }

  // ... rest of handler
}
```

### 7.2 High Priority: Add Line Numbers to readFile

**Priority**: **HIGH**

**Current Output**:
```
import React from 'react';

function App() {
  return <div>Hello</div>;
}
```

**Proposed Output**:
```
     1→import React from 'react';
     2→
     3→function App() {
     4→  return <div>Hello</div>;
     5→}
```

**Implementation**:
```typescript
// packages/core/src/tools/readFile.ts

export const handler = async (provider, args) => {
  const { path: paths, includeIgnored } = toolInfo.parameters.parse(args)

  const resp = []
  for (const path of paths) {
    const fileContent = await provider.readFile(path, includeIgnored ?? false)

    if (fileContent) {
      const lines = fileContent.split('\n')
      const numbered = lines
        .map((line, i) => `${String(i + 1).padStart(6)}→${line}`)
        .join('\n')

      resp.push(createFileElement('read_file_file_content', path, numbered))
    }
  }

  return {
    success: true,
    message: {
      type: 'text',
      value: resp.join('\n')
    }
  }
}
```

### 7.3 Medium Priority: Add Tool References to Descriptions

**Priority**: **MEDIUM**

**readFile Enhancement**:
```typescript
description: `Request to read the contents of one or multiple files at the
specified paths.

When to use:
- Examining file contents you don't know
- Analyzing code, reviewing text files
- Reading multiple files at once (comma-separated)

When NOT to use:
- For file existence checks: Use listFiles instead
- For searching within files: Use grep instead
- For file name searches: Use searchFiles instead
- Prefer this tool over executeCommand with cat/head/tail

[... rest of description ...]`
```

**writeToFile Enhancement**:
```typescript
description: `Request to write content to a file at the specified path.

IMPORTANT: You MUST use readFile at least once before using writeToFile
on an existing file.

When to use:
- Creating new files
- Completely replacing file contents

When NOT to use:
- For modifying existing files: Use replaceInFile instead
- For appending content: Use executeCommand with echo >> instead
- For targeted edits: Use replaceInFile instead

[... rest of description ...]`
```

**replaceInFile Enhancement**:
```typescript
description: `Request to replace sections of content in an existing file
using SEARCH/REPLACE blocks.

IMPORTANT: You MUST use readFile at least once before using replaceInFile
on an existing file.

When to use:
- Making targeted changes to specific parts of a file
- Replacing variable names, function signatures, imports
- Fixing bugs in existing code

When NOT to use:
- For creating new files: Use writeToFile instead
- For completely replacing file contents: Use writeToFile instead
- When you don't know the exact content: Read file first

[... rest of description ...]`
```

### 7.4 Low Priority: Add Optional Line Offset/Limit

**Priority**: **LOW**

**Use Case**: Reading large files (10,000+ lines)

**Implementation**:
```typescript
parameters: z.object({
  path: z.string().describe('File path'),
  offset: z.number().optional()
    .describe('Skip first N lines (default: 0)'),
  limit: z.number().optional()
    .describe('Read at most N lines (default: all)'),
  // ... other parameters
})
```

**Handler**:
```typescript
const lines = fileContent.split('\n')
const start = offset ?? 0
const end = limit ? start + limit : lines.length
const sliced = lines.slice(start, end).join('\n')
```

---

## Summary

### Main Differences

1. **"Read First" Enforcement**
   - Claude Code: ✅ Yes (critical safety feature)
   - Polka Codes: ❌ No (major vulnerability)

2. **Line Numbers**
   - Claude Code: ✅ Always included
   - Polka Codes: ❌ Never included

3. **Multiple Files**
   - Claude Code: ❌ One at a time
   - Polka Codes: ✅ Comma-separated

4. **Tool References**
   - Claude Code: ✅ Explicit (use X instead of Y)
   - Polka Codes: ❌ None

5. **Partial Reads**
   - Claude Code: ✅ offset/limit
   - Polka Codes: ❌ All or nothing

### Critical Recommendation

**Add "Read First" enforcement immediately** - This is the single most important safety feature missing from Polka Codes.

**Expected Impact**:
- ✅ Prevents accidental overwrites
- ✅ Prevents data loss
- ✅ Forces AI to understand context before changes
- ✅ Matches Claude Code's proven approach

---

**Document Version**: 1.0
**Last Updated**: January 2026
