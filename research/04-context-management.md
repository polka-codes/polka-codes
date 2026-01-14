# Claude Code: Context Management

## Overview

Context management in Claude Code involves overseeing what information the AI "remembers" during sessions. It's critical for sustaining coherent conversations, optimizing resources, and preventing performance degradation.

## Token System Fundamentals

### Token Economy
- **Not word-based**: Subwords and special characters vary in token cost
- **Code costs more**: Dense technical content and code consume more tokens
- **Context window**: Up to 200,000 tokens (Sonnet), but practical usage is much lower
- **Typical session**: ~15,000 tokens used (~7%), 185,000 free (~93%)

### Why Context Management Matters
1. **Coherence**: Multi-turn conversations require maintaining thread
2. **Performance**: Token limits cause summarization that loses nuance
3. **Cost**: More tokens = higher latency and API costs
4. **Quality**: Overloaded context dilutes response quality

## What Enters the Context Window

### Primary Sources
1. **System prompts**: ~2,800-15,000+ tokens (depending on configuration)
2. **Previous messages**: All queries and AI responses
3. **Tool interactions**: Outputs from tools and subagents
4. **Code snippets**: Files or excerpts referenced
5. **CLAUDE.md**: Project configuration and documentation
6. **Custom commands**: Slash command definitions

### Automatic Context Gathering
Claude Code automatically pulls context based on:
- Files mentioned in prompts
- CLAUDE.md files in current/parent directories
- Git status and recent history
- Project structure

## Core Best Practices

### 1. Prioritize Conciseness
- Craft direct prompts trimmed of fluff
- State goals upfront to minimize initial token spend
- Set focused tone for conversation

**Poor Example:**
```
Help with a Python project?
Something about data.
Pandas maybe?
Libraries?
```

**Optimized Example:**
```
Building a stock prediction tool.
Requirements:
- Pandas for manipulation
- NumPy for computations
- Scikit-learn for models
Goal: Forecast prices from historical CSV data.
```

### 2. Reuse Context Strategically
Reference prior exchanges explicitly:
- "Building on our last discussion about data preprocessing..."
- Leverages existing history without repetition
- Avoids re-explaining settled points

### 3. Break Tasks into Smaller Interactions
- Divide complex problems into digestible chunks
- Tackle one module at a time
- Keeps each exchange lean
- Clear between phases using `/clear`

### 4. Clear Clutter Proactively
- Use `/clear` when history feels heavy
- Reset context for new tasks
- Maintain freshness without losing key insights

## Built-in Context Management Commands

### /context Commands
- **`/context status`**: View current token usage
- **`/context summary`**: Condense long threads into essentials
- **`/context clear`**: Reset context window

### Usage Pattern
```bash
# Before major prompts
/context status  # Check headroom

# After 5-10 exchanges
/context summary  # Preserve essence

# Between major tasks
/context clear  # Fresh start
```

### /clear Command
- Resets context window
- Useful between unrelated tasks
- Prevents context bloat from long sessions

## Optimization Techniques

### 1. Structured Submission
For complex projects, submit info in this order:
1. **Objective**: Clear goal statement
2. **Context**: Relevant background
3. **Constraints**: Limits or must-haves
4. **Desired Outcome**: Success metrics

**Example Template:**
```
Objective: Build an expense tracker script
Context: For a small team handling monthly logs
Constraints:
- CSV imports only
- Multi-currency support
- Monthly report generation
Desired Outcome: Automated analysis dashboard
```

### 2. Periodic Summarization
After 5-10 exchanges:
- Prompt for recap: "Summarize our progress on authentication flow"
- Inject summary into future prompts
- Reduces need to repeat context

### 3. Prune Unnecessary Messages
- Edit or delete off-topic replies mid-session
- Focus prompts on must-have details
- Include schemas, error logs, specifics
- Skip backstory unless directly relevant

### 4. Emphasize Essentials
Always include only what's vital:
- Objectives
- Constraints
- Specifics (schemas, error messages, line numbers)

## Advanced Strategies

### Modular Task Execution
1. **Modularize tasks**: Split into phases (auth, then CRUD)
2. **Validate each**: Test outputs before proceeding
3. **Clear between phases**: Use `/clear` to isolate

### Sequential Phase Approach
**Example: Task Management App**

**Phase 1: Authentication**
```
> Generate React structure for user sign-in
```
(Claude delivers component outline)

**Phase 2: Backend**
```
> /clear
> Add JWT auth to Express routes
```

**Phase 3: Database**
```
> /clear
> Design MongoDB schemas for users and tasks
```

### Checklists and Scratchpads
For large tasks (migrations, lint fixes):
1. Tell Claude to run command and write errors to Markdown checklist
2. Instruct Claude to address each issue one by one
3. Fix and verify before checking off and moving to next

**Example:**
```bash
# 1. Generate checklist
> Run linter and write all errors to lint-checklist.md

# 2. Systematic fixes
> Address each issue in lint-checklist.md one by one
  Fix, verify, check off, move to next
```

## Real-World Scenarios

### Scenario 1: Starting a Project

**Inefficient (Avoid):**
```bash
> Help with a Python project?
> Something about data.
> Pandas maybe?
> Libraries?
```

**Optimized (Do):**
```bash
> Building a stock prediction tool.
> Requirements:
> - Pandas for manipulation
> - NumPy for computations
> - Scikit-learn for models
> Goal: Forecast prices from historical CSV data.
```

### Scenario 2: Tackling Complex Algorithms

**Flawed:**
```bash
> Fix this algorithm.
> [Pastes massive, unstructured problem]
> Thoughts?
```

**Step-by-Step:**
```bash
# First: Outline breakdown
> Implementing ML algorithm. Break into:
> 1. Preprocessing steps
> 2. Model criteria
> 3. Evaluation metrics
> Start with preprocessing?

# Second: Dive into one step
> [Reference outputs from preprocessing]

# Third: Advance with summary
> Recap from last: Built preprocessing pipeline.
> Next: Model selection criteria
```

### Scenario 3: Conserving Tokens

**Wasteful:**
- Rehashing full histories in every prompt

**Efficient:**
```bash
> Recap from last: Built user profile component with hooks.
> Next: Integrate validation logic.
```

### Scenario 4: Resetting for Clarity

Use commands sequentially:
1. `/clear` to reset
2. Summarize what you want to carry forward
3. `/context status` to confirm space

## Context Management in Long Tasks

### For Extended Sessions
- **Use checkpoints**: Create GitHub issues with plans
- **Modular approach**: Break into independent sub-tasks
- **Frequent clears**: Reset between major phases
- **Reference external docs**: Use URLs instead of pasting content

### For Complex Multi-File Changes
- **Plan first**: Use plan mode or separate planning session
- **Use checklists**: Markdown files for tracking progress
- **Iterate with verification**: Test after each change
- **Summarize frequently**: Preserve key decisions

## Context Limitations

### Important Constraints
- **Not permanent storage**: Sessions can reset or compact
- **Token caps enforce boundaries**: Exceeding triggers summarization
- **Resets occur**: After interruptions or explicit clears
- **Summarization loses nuance**: Automatic compression may drop details

### When to Clear
- Starting a completely different task
- Context feels overloaded/slow
- Getting vague or irrelevant responses
- Between major phases of large project

## Integration with Other Features

### CLAUDE.md for Persistent Context
- Document project-specific information
- Automatically loaded each session
- Reduces need to repeat context
- Team-shareable knowledge base

### Subagents for Context Isolation
- Use Task tool for independent work
- Subagents have separate context
- Reduces main context window load
- Parallel processing possible

### Plan Mode for Structured Context
- Explore and plan before coding
- Creates implementation roadmap
- Reduces iteration in main context
- Preserves context for implementation

## Pro Tips for Everyday Use

1. **Stay specific**: Name tools, files, goals explicitly
2. **Structure communication**: Use bullets or numbered lists
3. **Summarize routinely**: Every few turns, condense essence
4. **Leverage commands**: `/clear`, `/context status`, `/context summary`
5. **Ditch redundancy**: No need to re-explain settled points
6. **Check status before major prompts**: Ensure sufficient headroom
7. **Use abbreviations**: "ML" over "machine learning"
8. **Prioritize code over prose**: More efficient token usage
9. **Modularize design**: Reusable components and patterns
10. **Validate assumptions**: Document what you're assuming

## Token Conservation Tactics

### Before Prompting
- Check `/context status` for headroom
- Use abbreviations where appropriate
- Cut filler words
- Prioritize code over prose

### During Conversation
- Be specific with technical terms
- Include code details not explanations
- Spell out requirements clearly
- Minimize fluff

### After Extended Sessions
- Use `/context summary` to compress
- Clear context between major tasks
- Reference external URLs instead of pasting
- Use separate sessions for independent work

## Sources
- [Mastering Context Management in Claude Code CLI - Medium](https://medium.com/@lalatenduswain/mastering-context-management-in-claude-code-cli-your-guide-to-efficient-ai-assisted-coding-83753129b28e)
- [Claude Code 技术原理：上下文与记忆管理 - JR Academy](https://jiangren.com.au/learn/ai-engineer/claude-code-context-management)
- [Managing Claude Code's Context: a practical handbook - Comet API](https://www.cometapi.com/managing-claude-codes-context/)
- [Claude Code: Best practices for agentic coding - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Effective context engineering for AI agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
