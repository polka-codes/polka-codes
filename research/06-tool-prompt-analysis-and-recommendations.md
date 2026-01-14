# Tool Prompt Analysis: Claude Code vs Polka Codes

**Date**: January 2026
**Purpose**: Analyze tool descriptions and prompts to identify improvements for Polka Codes

---

## Executive Summary

After analyzing both systems' tool implementations, **Claude Code's tool descriptions are significantly more detailed and prescriptive** than Polka Codes'. This leads to better tool usage, fewer errors, and more predictable AI behavior.

**Key Finding**: Claude Code invests **~10,000 tokens** in tool descriptions with extensive usage guidance, while Polka Codes uses minimal descriptions (~50-100 tokens per tool).

**Recommendation**: Polka Codes should adopt Claude Code's approach of comprehensive tool descriptions with explicit usage patterns, constraints, and examples.

---

## Table of Contents

1. [Tool Description Philosophy](#1-tool-description-philosophy)
2. [Comparative Analysis by Tool Type](#2-comparative-analysis-by-tool-type)
3. [Key Differences & Patterns](#3-key-differences--patterns)
4. [Specific Recommendations](#4-specific-recommendations)
5. [Proposed Tool Description Enhancements](#5-proposed-tool-description-enhancements)
6. [Implementation Strategy](#6-implementation-strategy)

---

## 1. Tool Description Philosophy

### 1.1 Claude Code Approach

**Philosophy**: "Be explicit about when and how to use tools"

**Characteristics**:
- **Lengthy descriptions** (100-500+ tokens per tool)
- **Usage guidance**: When to use, when NOT to use
- **Constraints**: Explicit limitations and edge cases
- **Examples**: Concrete usage examples
- **Anti-patterns**: What NOT to do
- **Integration**: How tools work together

**Example - Bash Tool (1,125 tokens)**:
```
Runs shell commands in a persistent shell session

IMPORTANT: When doing file search, prefer the Grep tool over bash commands

When you need to perform bash commands:
- Use this tool for terminal operations like git, npm, testing
- You should not use this tool for file operations (use Read, Write, Edit instead)
- Prefer running single commands; only chain commands when dependencies exist

Git Safety Protocol:
[... extensive git workflow instructions ...]

IMPORTANT: NEVER use bash echo or other command-line tools to communicate thoughts
or instructions to the user. Output all text directly outside of tool use.
```

### 1.2 Polka Codes Approach

**Philosophy**: "Be concise and rely on type safety"

**Characteristics**:
- **Brief descriptions** (50-100 tokens per tool)
- **Parameter-focused**: Describe what parameters do
- **Type-safe**: Zod schemas for validation
- **Minimal guidance**: Trust AI to figure it out
- **Some examples**: Via `.meta({ examples: [...] })`

**Example - executeCommand Tool (~150 tokens)**:
```typescript
description:
  'Run a single CLI command. The command is always executed in the project-root
  working directory (regardless of earlier commands). Prefer one-off shell commands
  over wrapper scripts for flexibility. **IMPORTANT**: After an `execute_command`
  call, you MUST stop and NOT allowed to make further tool calls in the same message.'
```

---

## 2. Comparative Analysis by Tool Type

### 2.1 File Read Operations

#### Claude Code - Read Tool (439 tokens)

```
Use this tool to get the contents of a file from the local filesystem.
- Supports offset/limit for reading specific portions of large files
- Can read images (PNG, JPG), PDFs, Jupyter notebooks
- Returns output in cat -n format with line numbers

When not to use:
- For simple file existence checks, use Glob instead
- For searching within files, use Grep tool
- Prefer this tool over bash commands like cat/head/tail
```

**Strengths**:
- ✅ Explicit about when NOT to use
- ✅ Mentions related tools (Glob, Grep)
- ✅ Describes output format
- ✅ Lists supported file types

#### Polka Codes - readFile Tool (~100 tokens)

```typescript
description:
  'Request to read the contents of one or multiple files at the specified paths.
  Use comma separated paths to read multiple files. Use this when you need to
  examine the contents of an existing file you do not know the contents of,
  for example to analyze code, review text files, or extract information from
  configuration files. May not be suitable for other types of binary files,
  as it returns the raw content as a string. Try to list all the potential
  files are relevent to the task, and then use this tool to read all the
  relevant files.'
```

**Strengths**:
- ✅ Describes comma-separated paths feature
- ✅ Mentions use cases
- ✅ Warns about binary files

**Weaknesses**:
- ❌ Doesn't mention when NOT to use
- ❌ No reference to related tools (listFiles, search)
- ❌ No output format description
- ❌ Typo: "relevent" → "relevant"

---

### 2.2 File Write Operations

#### Claude Code - Write Tool (159 tokens)

```
Use this tool to create a new file or completely overwrite an existing file.
Before using this tool, you MUST use the Read tool to read the file first.

When to use:
- Creating new files
- Completely replacing file contents

When NOT to use:
- For modifying existing files: Use Edit tool instead
- For appending: Use bash echo with >> instead

CRITICAL: Always read files before editing them. This tool will error if you
attempt to edit a file without reading it first.
```

**Strengths**:
- ✅ **MUST read first** constraint (enforced)
- ✅ Clear when to use vs NOT use
- ✅ References Edit tool
- ✅ Error prevention guidance

#### Polka Codes - writeToFile Tool (~80 tokens)

```typescript
description:
  "Request to write content to a file at the specified path. If the file exists,
  it will be overwritten with the provided content. If the file doesn't exist,
  it will be created. This tool will automatically create any directories needed
  to write the file. Ensure that the output content does not include incorrect
  escaped character patterns such as `&lt;`, `&gt;`, or `&amp;`. Also ensure
  there is no unwanted CDATA tags in the content."
```

**Strengths**:
- ✅ Auto-creates directories (important feature)
- ✅ Warns about escape sequences
- ✅ Clear about overwriting behavior

**Weaknesses**:
- ❌ **No "read first" requirement** (Claude Code enforces this)
- ❌ No reference to replaceInFile for modifications
- ❌ No guidance on when NOT to use

---

### 2.3 File Edit Operations

#### Claude Code - Edit Tool (278 tokens)

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

**Strengths**:
- ✅ **Enforced "read first" constraint**
- ✅ Clear usage scenarios
- ✅ References related tools (Write, Task)
- ✅ Warns about uniqueness requirement
- ✅ Mentions replace_all feature

#### Polka Codes - replaceInFile Tool (~250 tokens)

```typescript
description:
  'Request to replace sections of content in an existing file using SEARCH/REPLACE
  blocks that define exact changes to specific parts of the file. This tool should
  be used when you need to make targeted changes to specific parts of a file.'

[... extensive parameter description with SEARCH/REPLACE format ...]
```

**Strengths**:
- ✅ **Excellent parameter description** (SEARCH/REPLACE format)
- ✅ Multiple examples in `.meta({ examples: [...] })`
- ✅ Detailed rules in parameter description
- ✅ Explains move/delete operations

**Weaknesses**:
- ❌ No "read first" requirement
- ❌ No reference to writeToFile for new files
- ❌ Description focuses on format, not usage patterns

---

### 2.4 Shell Command Execution

#### Claude Code - Bash Tool (1,125 + 1,526 for git = 2,651 tokens)

```
Runs bash commands in a persistent shell session with optional timeout.

IMPORTANT CRITICAL RULES:
- NEVER use bash echo, cat, head, tail, sed, awk, or echo redirection for
  communication. Output all communication directly in your responses.
- Use specialized tools instead of bash when available:
  * Read instead of cat
  * Edit instead of sed
  * Glob instead of find
  * Grep instead of grep or rg

When to use:
- Terminal operations (git, npm, build tools)
- System commands that cannot be done with other tools
- Running tests, builds, linting

Git Commit Workflow:
[... 1,526 tokens of git workflow instructions ...]

Command Execution Guidelines:
- Always quote file paths with spaces using double quotes
- Independent commands: Run in parallel via multiple tool calls
- Sequential commands: Use && or ; chaining

Directory Handling:
- Prefer absolute paths over cd
- Use absolute paths for consistency across sessions
```

**Strengths**:
- ✅ **Extremely prescriptive** (2,651 tokens!)
- ✅ Explicit tool preference hierarchy
- ✅ Anti-patterns: "NEVER use bash echo"
- ✅ Complete git workflow
- ✅ Parallel vs sequential guidance
- ✅ Path handling best practices

#### Polka Codes - executeCommand Tool (~150 tokens)

```typescript
description:
  'Run a single CLI command. The command is always executed in the project-root
  working directory (regardless of earlier commands). Prefer one-off shell commands
  over wrapper scripts for flexibility. **IMPORTANT**: After an `execute_command`
  call, you MUST stop and NOT allowed to make further tool calls in the same message.'

parameters: {
  requiresApproval: 'Set to `true` for commands that install/uninstall software,
  modify or delete files, change system settings, perform network operations, or
  have other side effects. Use `false` for safe, read-only, or purely local
  development actions (e.g., listing files, make a build, running tests).'
}
```

**Strengths**:
- ✅ **"Stop after execute" constraint** (unique to Polka!)
- ✅ Working directory clarity
- ✅ Approval system for safety

**Weaknesses**:
- ❌ No guidance on tool preference (readFile vs cat)
- ❌ No git-specific workflow
- ❌ No parallel/sequential guidance
- ❌ No path handling best practices
- ❌ No anti-patterns

---

### 2.5 Search Operations

#### Claude Code - Grep Tool (300 tokens)

```
Powerful search using ripgrep under the hood.

Supports:
- Regular expressions
- File type filters (via --type flag)
- Output modes: content, files_with_matches, count
- Context flags (-A/-B/-C for surrounding lines)

When to use:
- Searching for content within files
- Finding all occurrences of a pattern
- Searching specific file types

When NOT to use:
- For file name searches: Use Glob tool
- For reading specific files: Use Read tool
- Prefer this tool over bash grep/rg commands

Output modes:
- content: Show matching lines with line numbers
- files_with_matches: List only matching file paths
- count: Show number of matches per file
```

**Strengths**:
- ✅ Clear feature list
- ✅ When to use vs NOT use
- ✅ References related tools (Glob, Read)
- ✅ Output mode explanations

#### Polka Codes - search Tool (~70 tokens)

```typescript
description:
  'Search the web for information using Google Search. Use this tool to find
  current information, facts, news, documentation, or research that is not
  available in your training data. Returns comprehensive search results with
  relevant content extracted from the web.'
```

**Note**: Polka's `search` is for web search, not content search. Content search would be a different tool.

**Comparison Issue**: Polka Codes doesn't have a direct equivalent to Grep (content search). It has:
- `search` - Web search
- `searchFiles` - File name search (glob-based)

**Missing**: Content search within files (ripgrep-based)

---

### 2.6 Task Management

#### Claude Code - TodoWrite Tool (2,167 tokens - LARGEST!)

```
Use this tool to create and manage a structured task list to help you track
progress and give the user visibility into your work.

CRITICAL REQUIREMENTS:
1. You MUST use this tool to track multi-step tasks
2. Requires both content and activeForm for each todo
3. Only ONE todo can be in_progress at a time

THERE ARE 4 TASK STATES:
- pending: Task not yet started
- in_progress: Currently working on (limit to ONE)
- completed: Task finished successfully
- CANNOT MOVE TO IN_PROGRESS: Keep as pending if blocked

WHEN TO USE TODO LISTS:
- Non-trivial and complex tasks (3+ steps)
- Non-trivial tasks that require careful planning
- Multi-step operations that affect multiple files
- User explicitly requests todo list
- User provides multiple tasks (numbered or comma-separated)
- After receiving new instructions - capture requirements immediately

WHEN NOT TO USE:
- Single, straightforward tasks
- Tasks completed in less than 3 trivial steps
- Purely conversational or informational tasks

TRANSITION RULES:
1. Mark as in_progress BEFORE starting work
2. Mark as completed IMMEDIATELY after finishing (don't batch)
3. Exactly ONE todo in_progress at a time (not less, not more)
4. Move to next todo only after completing current
5. Keep pending tasks if blocked

EXAMPLE:
```
[Adding the entire user example from the research]

IMPORTANT: Only use this tool when planning tasks. Do not use it for tracking
the user's separate, unrelated requests.
```

**Strengths**:
- ✅ **Extremely detailed** (2,167 tokens!)
- ✅ Explicit state transition rules
- ✅ Multiple examples (good/bad)
- ✅ Clear when to use vs NOT use
- ✅ Emphasizes "one in_progress" constraint
- ✅ Warns against batching completions

#### Polka Codes - Todo Tools (~150 tokens total)

```typescript
// UpdateTodoItemInputSchema
{
  operation: 'add' | 'update',
  id: string | null,
  parentId: string | null,
  title: string | null,
  description: string | null,
  status: 'open' | 'completed' | 'closed'
}
```

**Differences**:
- ❌ No description of when to use
- ❌ No state transition rules
- ❌ No "one in_progress" constraint
- ❌ No examples
- ❌ Different states: open/completed/closed vs pending/in_progress/completed
- ⚠️ More flexible (can have multiple in-progress?)

**Strengths**:
- ✅ Type-safe schema
- ✅ Parent/child relationship support
- ✅ Custom validation (refinement)

**Weaknesses**:
- ❌ No usage guidance in prompt
- ❌ Relies on agent to figure it out

---

## 3. Key Differences & Patterns

### 3.1 Description Length

| Tool Type | Claude Code | Polka Codes | Ratio |
|-----------|-------------|-------------|-------|
| File Read | 439 tokens | ~100 tokens | 4.4x |
| File Write | 159 tokens | ~80 tokens | 2x |
| File Edit | 278 tokens | ~250 tokens | 1.1x |
| Shell Execute | 2,651 tokens | ~150 tokens | 17.7x |
| Search | 300 tokens | ~70 tokens | 4.3x |
| Todos | 2,167 tokens | ~150 tokens | 14.4x |

**Average**: Claude Code descriptions are **6-7x longer** than Polka Codes.

### 3.2 Structural Patterns

**Claude Code Structure**:
```
1. Core functionality (1 sentence)
2. IMPORTANT rules/constraints (bold, uppercase)
3. When to use (bullet list)
4. When NOT to use (bullet list)
5. Usage notes/anti-patterns
6. Related tools references
7. Examples (if applicable)
```

**Polka Codes Structure**:
```
1. Brief description (1-2 sentences)
2. Parameter descriptions (in Zod schema)
3. Examples (in .meta())
```

### 3.3 Constraint Enforcement

**Claude Code**:
- ✅ "MUST read file before editing" (enforced by system)
- ✅ "Only ONE todo in_progress at a time" (explicit rule)
- ✅ "NEVER use bash echo" (anti-pattern)
- ✅ "Prefer specialized tools over bash" (preference)

**Polka Codes**:
- ⚠️ "After execute_command, MUST stop" (enforced constraint)
- ❌ No "read first" requirement
- ❌ No "one in_progress" constraint
- ❌ No tool preference guidance

### 3.4 Tool Relationship Guidance

**Claude Code**:
- ✅ Explicitly references related tools
- ✅ Provides tool preference hierarchy
- ✅ Explains when to use X vs Y

**Example from Bash**:
```
- Use Read instead of cat
- Use Edit instead of sed
- Use Glob instead of find
- Use Grep instead of grep
```

**Polka Codes**:
- ❌ No tool relationship guidance
- ❌ No preference hierarchy
- ❌ Each tool is independent

---

## 4. Specific Recommendations

### 4.1 High Priority (Quick Wins)

#### 1. Add "When to Use / When NOT to Use" Sections

**Current**:
```typescript
description: 'Request to read the contents of one or multiple files...'
```

**Recommended**:
```typescript
description: `Request to read the contents of one or multiple files at the specified paths.

When to use:
- Examining file contents you don't know
- Analyzing code, reviewing text files, extracting config info
- Reading multiple files at once (comma-separated paths)

When NOT to use:
- For file existence checks: Use listFiles instead
- For searching within files: Use search instead
- Prefer this tool over executeCommand with cat/head/tail`
```

#### 2. Enforce "Read First" Constraint

**Current**: No requirement

**Recommended**:
```typescript
description: `Request to write content to a file at the specified path.

IMPORTANT: You MUST use readFile at least once before using writeToFile
or replaceInFile on an existing file. This ensures you understand the
current file state before making changes.

When to use:
...`
```

**Implementation**: Add check in handler:
```typescript
if (fileExists && !wasFileRead) {
  return {
    success: false,
    message: {
      type: 'error-text',
      value: 'ERROR: You must read the file first before writing to it.'
    }
  }
}
```

#### 3. Add Tool Preference Guidance

**New System Prompt Section**:
```
## Tool Preference Guidelines

When multiple tools can accomplish a task, prefer:

- **readFile** over executeCommand with cat/head/tail
- **replaceInFile** over executeCommand with sed
- **listFiles** over executeCommand with find
- **search** over executeCommand with grep/rg
- **writeToFile** for new files, replaceInFile for modifications

Use executeCommand ONLY for:
- Terminal operations (git, npm, build tools)
- System commands not available via other tools
```

#### 4. Strengthen executeCommand Description

**Current** (~150 tokens):
```typescript
description: 'Run a single CLI command. The command is always executed in
the project-root working directory (regardless of earlier commands). Prefer
one-off shell commands over wrapper scripts for flexibility.'
```

**Recommended** (~400 tokens):
```typescript
description: `Run a single CLI command in a persistent shell session.

IMPORTANT CRITICAL RULES:
- Prefer specialized tools over executeCommand when available:
  * readFile instead of cat
  * replaceInFile instead of sed
  * listFiles instead of find
  * search instead of grep or rg

When to use:
- Terminal operations (git, npm, build tools)
- Running tests, builds, linting
- System commands not available via other tools

When NOT to use:
- For file operations: Use readFile, writeToFile, replaceInFile instead
- For file searching: Use listFiles or search instead
- For reading files: Use readFile instead of cat

Command Execution:
- Independent commands: Call executeCommand multiple times in one message
- Sequential commands: Use && or ; chaining
- Always quote file paths with spaces: "path with spaces/file.txt"

IMPORTANT: After an execute_command call, you MUST stop and NOT make
further tool calls in the same message.`
```

### 4.2 Medium Priority (Structural Improvements)

#### 5. Standardize Description Structure

**Template**:
```typescript
description: `[Core functionality in 1 sentence]

When to use:
- [Bullet list of use cases]

When NOT to use:
- [Alternative tool]: Use [tool name] instead
- [Another case]: Use [other tool] instead

IMPORTANT:
- [Critical constraint 1]
- [Critical constraint 2]

Usage notes:
- [Helpful tip 1]
- [Helpful tip 2]`
```

#### 6. Add Examples to Descriptions

**Current**: Examples only in `.meta({ examples: [...] })`

**Recommended**: Include key examples in description too:
```typescript
description: `Request to read the contents of one or multiple files.

When to use:
- Reading a single file: readFile('src/main.ts')
- Reading multiple files: readFile('src/index.ts,src/app.ts')

When NOT to use:
...`
```

#### 7. Improve Todo Tool Guidance

**Current**: No description

**Recommended** (~500 tokens):
```typescript
description: `Create and manage structured task lists for tracking progress.

CRITICAL REQUIREMENTS:
1. Use this tool for multi-step tasks (3+ steps)
2. Only ONE todo can be 'open' (in-progress) at a time
3. Mark as 'completed' immediately after finishing (don't batch)

TASK STATES:
- open: Currently working on (limit to ONE)
- completed: Task finished successfully
- closed: Task cancelled or no longer relevant

WHEN TO USE:
- Complex tasks with 3+ steps
- Multi-file operations
- User provides multiple tasks
- After receiving new instructions (capture immediately)

WHEN NOT TO USE:
- Single straightforward tasks
- Tasks completed in <3 simple steps
- Purely conversational tasks

TRANSITION RULES:
1. Mark as 'open' BEFORE starting work
2. Mark as 'completed' IMMEDIATELY after finishing
3. Exactly ONE todo 'open' at a time
4. Move to next todo only after completing current`
```

### 4.3 Low Priority (Advanced Enhancements)

#### 8. Add Git Workflow to executeCommand

**Current**: No git-specific guidance

**Recommended**: Add section similar to Claude Code:
```typescript
description: `...
Git Workflow:
When creating commits, follow this process:
1. Run git status, git diff, git log in parallel
2. Analyze changes and recent commit messages
3. Draft commit message following conventions
4. Stage files and create commit
5. Run git status to verify

Commit message format:
- Clear subject line (50 chars or less)
- Detailed body explaining what changed and why
- References to issues/PRs if applicable
...`
```

#### 9. Add Anti-Patterns Section

**New**: Include explicit "What NOT to do" examples:
```typescript
description: `...
ANTI-PATTERNS - DO NOT DO THIS:
❌ "Read the file." (without specifying which file)
❌ "Make a build and then test it." (two commands, use sequential calls)
❌ executeCommand with cat (use readFile instead)
...`
```

#### 10. Add Parallel Execution Guidance

**Current**: Only "stop after execute" constraint

**Recommended**:
```typescript
description: `...
PARALLEL EXECUTION:
When multiple independent commands can run simultaneously:
- Make multiple executeCommand calls in one message
- Example: git status, git diff, git log (all independent)

SEQUENTIAL EXECUTION:
When commands depend on each other:
- Chain with && or ;
- Example: npm run build && npm test (test needs build first)
...`
```

---

## 5. Proposed Tool Description Enhancements

### 5.1 readFile (Current: ~100 tokens → Recommended: ~300 tokens)

```typescript
description: `Request to read the contents of one or multiple files at the specified paths.

When to use:
- Examining file contents you don't know
- Analyzing code, reviewing text files, extracting configuration info
- Reading multiple files at once (use comma-separated paths)

When NOT to use:
- For file existence checks: Use listFiles instead
- For searching within files: Use search instead
- Prefer this tool over executeCommand with cat/head/tail

Features:
- Supports comma-separated paths for multiple files
- Automatically handles different file types
- Returns raw content as text (may not be suitable for binary files)

IMPORTANT:
- Always try to list relevant files first with listFiles
- Then read all relevant files together with comma-separated paths
- May not be suitable for binary files (returns raw string)`
```

### 5.2 writeToFile (Current: ~80 tokens → Recommended: ~250 tokens)

```typescript
description: `Request to write content to a file at the specified path.

IMPORTANT: You MUST use readFile at least once before using writeToFile
on an existing file. This ensures you understand the current file state
before making changes.

When to use:
- Creating new files
- Completely replacing file contents
- When you have the complete intended content

When NOT to use:
- For modifying existing files: Use replaceInFile instead
- For appending content: Use executeCommand with echo >>

Features:
- Automatically creates any directories needed
- Overwrites existing files completely
- Must provide complete file content (no truncation)

IMPORTANT:
- Ensure no incorrect escape sequences (&lt;, &gt;, &amp;)
- Ensure no unwanted CDATA tags in content
- Always provide COMPLETE intended content (no omissions)`
```

### 5.3 replaceInFile (Current: ~250 tokens → Recommended: ~400 tokens)

```typescript
description: `Request to replace sections of content in an existing file using SEARCH/REPLACE blocks.

IMPORTANT: You MUST use readFile at least once before using replaceInFile
on an existing file. This ensures you understand the current file state
before making changes.

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
1. SEARCH content must match EXACTLY (character-for-character)
2. Each block replaces only first occurrence
3. Include just enough lines for uniqueness
4. Keep blocks concise (don't include long unchanged sections)
5. List blocks in order they appear in file

Special operations:
- Move code: Two blocks (delete from original + insert at new location)
- Delete code: Empty REPLACE section`
```

### 5.4 executeCommand (Current: ~150 tokens → Recommended: ~500 tokens)

```typescript
description: `Run a single CLI command in a persistent shell session.

IMPORTANT CRITICAL RULES:
- Prefer specialized tools over executeCommand when available:
  * readFile instead of cat
  * replaceInFile instead of sed
  * listFiles instead of find
  * search instead of grep or rg
- NEVER use bash echo for communication (use text output instead)

When to use:
- Terminal operations (git, npm, build tools)
- Running tests, builds, linting
- System commands not available via other tools

When NOT to use:
- For file operations: Use readFile, writeToFile, replaceInFile instead
- For file searching: Use listFiles or search instead
- For reading files: Use readFile instead of cat

Command Execution:
- Independent commands: Call executeCommand multiple times (one message)
- Sequential commands: Use && or ; chaining
- Always quote file paths with spaces: "path with spaces/file.txt"
- Command always runs in project-root working directory

IMPORTANT: After an execute_command call, you MUST stop and NOT make
further tool calls in the same message.

Approval requirements:
- Set requiresApproval=true for: install/uninstall, file modifications,
  network operations, system settings
- Set requiresApproval=false for: read-only operations, builds, tests`
```

### 5.5 updateTodoItem (Current: ~0 tokens → Recommended: ~500 tokens)

```typescript
description: `Create and manage structured task lists for tracking progress.

CRITICAL REQUIREMENTS:
1. Use this tool for multi-step tasks (3+ steps)
2. Only ONE todo can be 'open' (in-progress) at a time
3. Mark as 'completed' immediately after finishing (don't batch)

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

TRANSITION RULES:
1. Mark as 'open' BEFORE starting work on a task
2. Mark as 'completed' IMMEDIATELY after finishing
3. Exactly ONE todo 'open' at a time (not less, not more)
4. Move to next todo only after completing current
5. If blocked, keep task as 'open' but note dependency

USAGE PATTERN:
- Create todos when planning work
- Mark first as 'open' before starting
- Complete and move to next sequentially
- Do not batch completions (complete one at a time)

IMPORTANT: Only use this tool for planning/implementation tasks.
Do not use for tracking user's separate, unrelated requests.`
```

---

## 6. Implementation Strategy

### 6.1 Phased Approach

**Phase 1: Critical Constraints** (Week 1)
- ✅ Add "read first" requirement to writeToFile/replaceInFile
- ✅ Implement enforcement check in handlers
- ✅ Update system prompt with tool preference guidelines

**Phase 2: Description Enhancements** (Week 2-3)
- ✅ Rewrite all tool descriptions with standard structure
- ✅ Add "When to use / When NOT to use" sections
- ✅ Add tool relationship references
- ✅ Include examples in descriptions

**Phase 3: Advanced Features** (Week 4)
- ✅ Add git workflow to executeCommand
- ✅ Add parallel/sequential execution guidance
- ✅ Add anti-patterns sections
- ✅ Strengthen todo tool guidance

**Phase 4: Testing & Iteration** (Week 5-6)
- ✅ A/B test new descriptions
- ✅ Measure tool usage patterns
- ✅ Iterate based on error rates
- ✅ Gather user feedback

### 6.2 Token Budget Analysis

**Current**: ~50-100 tokens per tool × 25 tools = ~1,250-2,500 tokens total

**Proposed**: ~200-500 tokens per tool × 25 tools = ~5,000-12,500 tokens total

**Impact**: +3,750-10,000 tokens (~20-30% increase in system prompt size)

**Trade-off Analysis**:
- ✅ **Pros**: Better tool usage, fewer errors, more predictable behavior
- ❌ **Cons**: Increased token cost per request
- ✅ **Mitigation**: Token costs are decreasing; accuracy is more valuable

**Recommendation**: **Acceptable trade-off**. The improved tool usage will reduce errors and re-attempts, ultimately saving tokens.

### 6.3 Measurement & Success Criteria

**Metrics to Track**:
1. **Tool Error Rate**: Percentage of tool calls that fail
   - Target: <5% (current unknown)
2. **Tool Selection Accuracy**: Correct tool chosen for task
   - Target: >90% (current unknown)
3. **Re-attempt Rate**: Percentage of tasks requiring retries
   - Target: <10% (current unknown)
4. **User Feedback**: Qualitative feedback on tool behavior
   - Target: Positive sentiment >80%

**Success Criteria**:
- ✅ Tool error rate decreases by >50%
- ✅ Tool selection accuracy increases by >30%
- ✅ User feedback improves
- ✅ No significant increase in average tokens per task

### 6.4 A/B Testing Framework

**Approach**: Randomized controlled trial
- **Group A**: Current tool descriptions (control)
- **Group B**: Enhanced tool descriptions (treatment)
- **Duration**: 2 weeks
- **Sample**: 100 users per group
- **Tasks**: Standardized set of 10 common tasks

**Measurements**:
- Task completion rate
- Time to completion
- Tool usage patterns
- Error frequency
- User satisfaction

---

## 7. Conclusion

### 7.1 Summary of Findings

**Claude Code Advantages**:
1. **Comprehensive descriptions**: 6-7x longer than Polka Codes
2. **Explicit constraints**: "MUST read first", "NEVER use bash echo"
3. **Tool relationships**: References to alternative tools
4. **Usage patterns**: When to use vs NOT use
5. **Anti-patterns**: Explicit guidance on what NOT to do
6. **Examples**: Concrete usage examples

**Polka Codes Advantages**:
1. **Type safety**: Compile-time Zod validation
2. **Parameter examples**: Via `.meta({ examples: [...] })`
3. **Unique features**: "Stop after execute", approval system
4. **Parent/child todos**: Hierarchical task structure

### 7.2 Key Recommendations

1. **✅ Adopt Claude Code's description philosophy**: Be explicit about usage patterns
2. **✅ Add "read first" constraint**: Enforce via handler check
3. **✅ Standardize description structure**: When to use / NOT use / IMPORTANT
4. **✅ Add tool preference guidance**: System prompt section
5. **✅ Strengthen executeCommand**: Add anti-patterns and guidance
6. **✅ Improve todo tool**: Add state transition rules
7. **⚠️ Accept token increase**: 3,750-10,000 more tokens (~20-30%)

### 7.3 Implementation Priority

**High Priority** (Do first):
1. Add "read first" requirement to writeToFile/replaceInFile
2. Add tool preference guidelines to system prompt
3. Strengthen executeCommand description
4. Standardize all tool descriptions

**Medium Priority** (Do next):
1. Add examples to descriptions
2. Improve todo tool guidance
3. Add git workflow to executeCommand
4. Add parallel/sequential guidance

**Low Priority** (Do later):
1. Add anti-patterns sections
2. A/B test new descriptions
3. Measure and iterate

### 7.4 Final Thoughts

**The investment in detailed tool descriptions pays off** through:
- ✅ Reduced error rates
- ✅ More predictable AI behavior
- ✅ Better user experience
- ✅ Fewer support requests

**Claude Code's 10,000 tokens of tool descriptions** is not wasteful - it's **intentional investment in reliability**.

**Recommendation**: **Adopt Claude Code's approach** while maintaining Polka Codes' unique strengths (type safety, approval system, hierarchical todos).

---

## Appendix A: Tool Description Template

```typescript
description: `[One-sentence core functionality description]

When to use:
- [Specific use case 1]
- [Specific use case 2]
- [Specific use case 3]

When NOT to use:
- [Alternative scenario]: Use [tool name] instead
- [Another scenario]: Use [other tool] instead
- [Third scenario]: Use [third tool] instead

IMPORTANT:
- [Critical constraint 1]
- [Critical constraint 2]
- [Critical constraint 3]

Features:
- [Feature 1]
- [Feature 2]

Usage notes:
- [Helpful tip 1]
- [Helpful tip 2]

[If applicable]
ANTI-PATTERNS - DO NOT DO THIS:
❌ [Bad example 1]
❌ [Bad example 2]

EXAMPLES:
✅ [Good example 1]
✅ [Good example 2]`
```

---

## Appendix B: System Prompt Addition

```typescript
export const TOOL_PREFERENCE_GUIDELINES = `## Tool Preference Guidelines

When multiple tools can accomplish a task, prefer specialized tools over executeCommand:

### File Operations
- **readFile**: Instead of executeCommand with cat/head/tail
- **writeToFile**: For new files (use replaceInFile for modifications)
- **replaceInFile**: Instead of executeCommand with sed
- **listFiles**: Instead of executeCommand with find
- **search**: Instead of executeCommand with grep/rg

### Command Execution
- **executeCommand**: ONLY for terminal operations (git, npm, build tools)
- **executeCommand**: ONLY for commands not available via other tools

### Critical Rules
1. **Read First**: MUST use readFile before writeToFile or replaceInFile on existing files
2. **Tool Hierarchy**: Always prefer specialized tools over generic executeCommand
3. **Parallel Execution**: Multiple independent commands can be called in one message
4. **Sequential Execution**: Use && or ; chaining for dependent commands

### Examples
❌ BAD: executeCommand('cat src/main.ts')
✅ GOOD: readFile('src/main.ts')

❌ BAD: executeCommand('sed -i "s/old/new/g" file.ts')
✅ GOOD: replaceInFile({ path: 'file.ts', diff: '...' })

❌ BAD: executeCommand('grep -r "pattern" src/')
✅ GOOD: search({ pattern: 'pattern', path: 'src/' })`
```

---

**Document Version**: 1.0
**Last Updated**: January 2026
**Next Review**: After Phase 1 implementation
