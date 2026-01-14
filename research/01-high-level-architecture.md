# Claude Code: High-Level Architecture

## Overview

Claude Code is Anthropic's command-line agentic coding assistant that provides direct access to Claude's capabilities in a terminal interface. It's designed as a lightweight shell around the Claude model, prioritizing simplicity and letting the model do most of the work.

## Key Design Philosophy

**"Simplicity First" Approach:**
- Claude Code tries to write as little business logic as possible
- The goal is to let users "feel the model as raw as possible"
- Every new model release allows the team to delete code (e.g., with Claude 4.0, they deleted ~50% of the system prompt)
- They constantly minimize prompting and the number of tools

## Tech Stack

### Core Technologies
- **TypeScript**: Primary language
- **React with Ink**: UI framework for terminal interfaces
- **Yoga**: Layout system (open sourced by Meta) for terminal size constraints
- **Bun**: Build system chosen for speed

### Why This Stack?
The tech stack is "on distribution" - technologies that Claude already knows well:
- TypeScript and React are capabilities the model is strong with
- This allows Claude Code to build itself (~90% of Claude Code is written by Claude Code)
- Avoids "off distribution" stacks that would require teaching the model

## Architecture Principles

### 1. Minimal Business Logic
Claude Code is intentionally a lightweight shell:
- Defines the UI and exposes hooks for model modification
- Exposes tools for model use
- Gets out of the way

### 2. No Virtualization
Runs locally (not in Docker/VM):
- Simplicity is the primary design decision
- Bash commands run locally
- Filesystem reads/writes happen locally
- Trade-off: Requires robust permissions system instead of sandbox isolation

### 3. Zero External Dependencies
The `cli.js` file is a self-contained 10.5MB bundle including:
- Node.js application code
- Vendored ripgrep binaries (platform-specific)
- Tree-sitter WASM modules (code structure parsing)
- resvg WASM (SVG rendering)

## Major Architectural Components

### 1. Permissions System (Most Complex Part)
Multi-tiered system for safety:
- Per-project settings (`.claude/settings.json`)
- Per-user settings (`~/.claude.json`)
- Per-company settings (sharable across teams)
- Static analysis of commands to check against allowlist
- User can: allow once, allow for all sessions, or reject

### 2. Tools System
Builtin tools include:
- **File Operations**: Read, Write, Edit, Glob, Grep
- **Execution**: Bash (with git integration)
- **Planning**: EnterPlanMode, ExitPlanMode
- **Agent spawning**: Task tool for subagents
- **Collaboration**: AskUserQuestion, TodoWrite
- **Web**: WebFetch, WebSearch
- **Git**: Bash tool with git-specific instructions

### 3. MCP (Model Context Protocol) Integration
- Claude Code functions as both MCP server and client
- Extensible through external MCP servers
- Protocol standardized for tool sharing
- Configuration at project, global, or repository level (via `.mcp.json`)

### 4. Subagent System
Specialized agents for different tasks:
- **Explore agent**: Fast codebase exploration (516 tokens)
- **Plan agent**: Implementation planning (633 tokens enhanced)
- **Task agent**: General task execution (294 tokens)
- Various creation agents (CLAUDE.md generation, statusline setup, etc.)

## Development Practices at Anthropic

### Iteration Speed
- ~60-100 internal releases per day
- ~5 pull requests per engineer per day
- ~1 external release per day
- Team of ~10 engineers (as of July 2025)

### Prototyping Culture
Example: Todo lists feature
- Built 20+ prototypes in 2 days
- Most prototypes (2 days' worth) were thrown away
- Final version selected after extensive iteration
- Shows AI agents dramatically speed up prototyping

### Dogfooding
- Internal version released Nov 2024
- Day 1: 20% of Engineering used it
- Day 5: 50% of Engineering used it
- Today: >80% of engineers who write code use it daily
- Also used by data scientists for queries and visualizations

## Impact Metrics

### Engineering Productivity
- 67% increase in PR throughput while team size doubled
- Normally, doubling team size decreases PRs/engineer
- Claude Code reversed this trend
- 90% of code is written by Claude Code itself

### Product Success
- >$500M in annual run-rate revenue (Sept 2025)
- 10x usage growth since May 2025 GA release
- Not just for coders: data scientists, PMs use it too

## Key Architectural Insights

### 1. Product Overhang Discovery
The prototype revealed "product overhang" - the model could already explore filesystems autonomously, but no product enabled this capability.

### 2. Permission-Centric Security
Instead of virtualization, Claude Code uses:
- Pre-execution static analysis
- Multi-tier settings system
- Granular tool allowlisting
- User approval workflows

### 3. "Every Time There's a New Model Release, We Delete a Bunch of Code"
The architecture deliberately avoids:
- Complex UI elements that limit the model
- Excessive prompting/scaffolding
- Unnecessary tools
- Features that constrain model capabilities

## Sources
- [How Claude Code is built - The Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Claude Code Internals: High-Level Architecture - Marco Kotrotsos](https://kotrotsos.medium.com/claude-code-internals-part-1-high-level-architecture-9881c68c799f)
- [Claude Code: Best practices for agentic coding - Anthropic](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Claude Code Internals Series - Marco Kotrotsos](https://kotrotsos.medium.com/claude-code-internals-part-1-high-level-architecture-9881c68c799f)
