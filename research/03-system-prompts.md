# Claude Code: System Prompts

## Overview

Claude Code doesn't have a single system prompt string. Instead, it uses **40+ separate prompt strings** that are conditionally assembled based on environment, configuration, and context. These prompts are constantly evolving across versions.

## Token Distribution

According to reverse engineering analysis (as of v2.1.3, January 2026):

| Component | Tokens | Purpose |
|-----------|--------|---------|
| Main system prompt | ~2,852 | Core behavior, tone, tool policies |
| Tool descriptions | ~9,400 | 20+ built-in tool definitions |
| Subagent prompts | ~1,572 | Explore, Plan, Task agents |
| Utility prompts | ~8,000+ | Summarization, creation assistants |
| CLAUDE.md | 1,000-2,000 | Per-project configuration |
| **Total per request** | ~15,000-20,000 | |

## Main System Prompt Structure

### Core System Prompt (2,852 tokens)
Defines:
- Claude Code's role as interactive CLI tool
- Tone and style guidelines
- Tool usage policies
- Professional objectivity principles
- Task management approach

### Conditional Additions

**Environment-specific:**
- Git status reminder (95 tokens)
- Chrome browser MCP tools (158 tokens)
- Browser automation instructions (758 tokens)

**Mode-specific:**
- Learning mode insights (142 tokens)
- Learning mode full (1,042 tokens)
- MCP CLI instructions (1,335 tokens)
- Scratchpad directory (172 tokens)

## Subagent Prompts

### Explore Agent (516 tokens)
Fast codebase exploration:
- Optimized for finding files by patterns
- Searches code for keywords
- Answers questions about codebase structure
- "Quick" thoroughness level by default

### Plan Mode Agent (633 tokens enhanced, 310 for subagents)
Implementation planning:
- Thorough codebase exploration
- Understanding existing patterns
- Designing implementation approaches
- Multi-agent parallel planning support
- Risk assessment and mitigation

### Task Tool Agent (294 tokens + 129 extra notes)
General task execution:
- Handles complex, multi-step tasks
- Can access conversation history
- Works autonomously with user oversight
- Extra notes: absolute paths, no emojis, no colons before tool calls

## Creation Assistants

### Agent Creation Architect (1,110 tokens)
Creates custom AI agents with:
- Detailed specifications
- Tool requirements
- System prompts
- Configuration instructions

### CLAUDE.md Creation (384 tokens)
Analyzes codebases to create:
- Project documentation
- Common commands
- Code style guidelines
- Developer environment setup

### Status Line Setup (1,350 tokens)
Configures status line display with:
- Git branch info
- File context
- Model information
- Custom status indicators

## Slash Commands

### /pr-comments (402 tokens)
Fetches and displays GitHub PR comments

### /review-pr (243 tokens)
Reviews pull requests with code analysis

### /security-review (2,610 tokens)
Comprehensive security analysis:
- Exploitable vulnerabilities
- OWASP Top 10 coverage
- Security best practices
- Detailed remediation guidance

## Utility Prompts

### Conversation Management

#### Conversation Summarization (1,121 tokens)
Creates detailed summaries of:
- Key decisions made
- Code changes
- Important context
- Next steps

#### Conversation Summarization with Instructions (1,133 tokens)
Extended summarization with:
- Custom additional instructions
- Focused summaries
- Targeted context preservation

### Session Management

#### Session Title and Branch Generation (333 tokens)
Generates:
- Succinct session titles
- Git branch names
- Based on conversation content

#### Session Notes Template (292 tokens)
Structure for tracking:
- Coding work
- Decisions made
- Context for future reference

#### Session Notes Update (756 tokens)
Instructions for updating:
- Session notes files
- During conversations
- Progress tracking

#### Session Search Assistant (444 tokens)
Finds relevant sessions based on:
- User queries
- Metadata
- Content similarity

### Development Utilities

#### Bash Command Description Writer (207 tokens)
Generates clear, concise descriptions:
- Active voice
- 5-10 words for simple commands
- Context for complex commands

#### Bash Command Explainer (166 tokens)
Explains bash commands with:
- Reasoning
- Risk assessment
- Risk level classification

#### Bash Command File Path Extraction (286 tokens)
Extracts file paths from:
- Bash command output
- Error messages
- Log files

#### Bash Command Prefix Detection (835 tokens)
Detects:
- Command prefixes
- Command injection attempts
- Security risks

#### Prompt Suggestion Generator v2 (296 tokens)
Generates prompt suggestions for:
- Common tasks
- Workflow optimization
- Best practices

### Specialized Agents

#### WebFetch Summarizer (185 tokens)
Summarizes verbose WebFetch output for the main model

#### User Sentiment Analysis (205 tokens)
Analyzes:
- User frustration levels
- PR creation requests
- Satisfaction indicators

#### Command Execution Specialist (109 tokens)
Focuses on:
- Bash command execution
- Terminal operations

#### Claude Guide Agent (763 tokens)
Helps users understand:
- Claude Code features
- Claude Agent SDK
- Claude API usage

#### Remember Skill (1,048 tokens)
Reviews session memories and updates:
- CLAUDE.local.md
- Recurring patterns
- Learnings

#### Update Magic Docs (718 tokens)
Updates documentation with:
- Latest changes
- Code examples
- Best practices

## Tool Descriptions

Tool descriptions are a major part of the system prompt. See [02-tools-system.md](02-tools-system.md) for detailed breakdown.

Key highlights:
- **TodoWrite**: 2,167 tokens (largest single tool)
- **Bash with git**: 2,651 tokens total
- **Task**: 1,227 tokens
- **EnterPlanMode**: 970 tokens
- Most other tools: 100-500 tokens each

## System Reminders

### Plan Mode Active (1,330 tokens full, 310 for subagents)
Enhanced planning with:
- Parallel exploration
- Multi-agent planning
- Structured implementation approaches

### Plan Mode Re-entry (236 tokens)
Triggered when re-entering plan mode after:
- Shift+tab exit
- Previous plan approval

## CLAUDE.md Configuration

### Purpose
Special file automatically pulled into context when starting conversations.

### What to Document
- Common bash commands
- Core files and utility functions
- Code style guidelines
- Testing instructions
- Repository etiquette (branch naming, merge vs rebase)
- Developer environment setup
- Unexpected behaviors or warnings

### File Locations (checked in order)
1. Root of repo (or where you run `claude` from) - **Most common**
2. Any parent directory (useful for monorepos)
3. Any child directory (pulled on-demand)
4. Home folder (`~/.claude/CLAUDE.md`)

### Naming
- `CLAUDE.md`: Check into git, share with team
- `CLAUDE.local.md`: Gitignore, personal use

### Best Practices
- Keep concise and human-readable
- Iterate and tune for effectiveness
- Use `#` key in Claude Code to automatically add content
- Add emphasis with "IMPORTANT" or "YOU MUST" for adherence
- Run through prompt improver periodically

### Example Format
```markdown
# Bash commands
- npm run build: Build the project
- npm run typecheck: Run the typechecker

# Code style
- Use ES modules (import/export) syntax, not CommonJS (require)
- Destructure imports when possible (eg. import { foo } from 'bar')

# Workflow
- Be sure to typecheck when you're done making changes
- Prefer running single tests for performance
```

## Prompt Evolution

### Version History
- Tracked across 62+ versions (v2.0.14 to v2.1.3)
- CHANGELOG.md documents all changes
- Prompts are extracted from minified JS bundle

### Key Trend
**"Every time there's a new model release, we delete a bunch of code"**
- Claude 4.0: Deleted ~50% of system prompt
- Constant minimization of prompting
- Fewer tools over time
- Model improvements enable prompt simplification

### Extraction Method
Prompts extracted directly from Claude Code's compiled source:
- Guaranteed accuracy
- Matches what Claude Code actually uses
- Tools like `tweakcc` can customize individual prompt pieces

## Sources
- [Piebald-AI/claude-code-system-prompts - GitHub](https://github.com/Piebald-AI/claude-code-system-prompts)
- [国外大神逆向了Claude Code - Zhihu](https://zhuanlan.zhihu.com/p/1943399204027373513)
- [Claude Code: Best practices for agentic coding - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
