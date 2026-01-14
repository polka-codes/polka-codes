# Claude Code Research

Research findings about Claude Code's architecture, tools, system prompts, and context management. Compiled from various sources including Anthropic's official documentation, engineering blogs, and community analysis.

## Contents

1. **[High-Level Architecture](01-high-level-architecture.md)**
   - Tech stack (TypeScript, React with Ink, Yoga, Bun)
   - Design philosophy: "Simplicity First"
   - No virtualization (runs locally)
   - Permissions system
   - Development practices at Anthropic
   - Impact metrics (67% PR throughput increase)

2. **[Tools System](02-tools-system.md)**
   - Core built-in tools (Read, Write, Edit, Bash, Grep, Glob, etc.)
   - Tool descriptions and token counts (~10,000+ tokens)
   - MCP (Model Context Protocol) integration
   - Tool usage patterns
   - Permission system
   - Popular MCP servers

3. **[System Prompts](03-system-prompts.md)**
   - 40+ separate prompt strings
   - Token distribution (~15,000-20,000 per request)
   - Main system prompt structure
   - Subagent prompts (Explore, Plan, Task)
   - Creation assistants
   - CLAUDE.md configuration
   - Prompt evolution history

4. **[Context Management](04-context-management.md)**
   - Token system fundamentals
   - What enters the context window
   - Built-in commands (/context, /clear)
   - Optimization techniques
   - Real-world scenarios
   - Best practices

## Key Takeaways

### Architecture
- **Lightweight shell** around Claude model - minimal business logic
- **90% self-written** - Claude Code builds itself
- **No virtualization** - runs locally with permission-based security
- **On-distribution stack** - TypeScript/React that Claude knows well

### Tools
- **~10,000 tokens** just for tool descriptions
- **TodoWrite is largest** (2,167 tokens) - critical for task tracking
- **MCP for extensibility** - both client and server
- **Parallel tool calls** for efficiency
- **Specialized over bash** - use dedicated tools when available

### System Prompts
- **Not a single prompt** - 40+ separate strings
- **Constantly evolving** - tracked across 62+ versions
- **Deleting code with each model release** - 4.0 removed 50% of system prompt
- **CLAUDE.md for project context** - auto-loaded per session

### Context Management
- **200K token window** but practical usage ~15K
- **/clear between tasks** - prevents bloat
- **Structured submission** - Objective, Context, Constraints, Outcome
- **Modular approach** - break complex tasks into phases
- **Summarize frequently** - preserve essence without repetition

## Development Insights

### Iteration Speed
- 60-100 internal releases/day
- 5 PRs/engineer/day
- 1 external release/day
- 20+ prototypes for features (e.g., todo lists)

### Impact
- $500M+ annual run-rate revenue
- 10x growth since GA (May 2025)
- 67% increase in PR throughput
- 80%+ of Anthropic engineers use it daily

### Philosophy
> "Every time there's a new model release, we delete a bunch of code."
> "We want people to feel the model as raw as possible."
> "With an off-distribution stack, you have to teach the model. We wanted a stack where Claude Code could build itself."

## Sources

### Official Anthropic Resources
- [Claude Code: Best practices for agentic coding](https://www.anthropic.com/engineering/claude-code-best-practices)
- [Effective context engineering for AI agents](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Introducing advanced tool use](https://www.anthropic.com/engineering/advanced-tool-use)
- [Code execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Connector Documentation](https://platform.claude.com/docs/en/agents-and-tools/mcp-connector)

### External Analysis
- [How Claude Code is built - The Pragmatic Engineer](https://newsletter.pragmaticengineer.com/p/how-claude-code-is-built)
- [Claude Code Internals - Marco Kotrotsos](https://kotrotsos.medium.com/claude-code-internals-part-1-high-level-architecture-9881c68c799f)
- [Piebald-AI/claude-code-system-prompts - GitHub](https://github.com/Piebald-AI/claude-code-system-prompts)
- [国外大神逆向了Claude Code - Zhihu](https://zhuanlan.zhihu.com/p/1943399204027373513)

### Community Guides
- [Mastering Context Management - Medium](https://medium.com/@lalatenduswain/mastering-context-management-in-claude-code-cli-your-guide-to-efficient-ai-assisted-coding-83753129b28e)
- [Claude Code 技术原理：上下文与记忆管理 - JR Academy](https://jiangren.com.au/learn/ai-engineer/claude-code-context-management)
- [Managing Claude Code's Context - Comet API](https://www.cometapi.com/managing-claude-codes-context/)
- [10 Must-Have MCP Servers - Medium](https://roobia.medium.com/the-10-must-have-mcp-servers-for-claude-code-2025-developer-edition-43dc3c15c887)

## Version Information

Research compiled: January 2025

Based on Claude Code versions: v2.0.76 - v2.1.3 (January 2026)

## Related Projects

This research was conducted to inform the development of [Polka Codes](https://github.com/polka-codes/polka-codes), an open-source AI-powered coding assistant framework inspired by Claude Code.
