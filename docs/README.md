# Autonomous Coding Agents - Documentation

## 📚 Documentation Guide

### New to Autonomous Agents?
Start here: **[Quick Start Guide](./autonomous-agent-quick-start.md)** ⭐
- Setup in 5 minutes
- Simple configuration (2 YAML files)
- Real-world examples
- Common patterns

### Want Complete Details?
Read: **[Autonomous Coding Agent System](./autonomous-coding-agent.md)**
- Architecture overview
- Agent roles and responsibilities
- Workflow diagrams
- Advanced features
- Safety and monitoring

### Implementing the System?
See: **[Implementation Tasks](./autonomous-agent-implementation-tasks.md)**
- Missing features breakdown
- Code examples
- 12 prioritized features
- Implementation roadmap
- MVP guide (3 weeks)

---

## 🚀 Quick Reference

### Minimal Setup (2 files)

**`.planner.yml`**:
```yaml
name: Planner
model: claude-sonnet-4-20250514
writeAccess:
  - plans/**
```

**`.worker.yml`**:
```yaml
name: Worker
model: claude-sonnet-4-20250514
writeAccess:
  - "**/*"
  - "plans/**/*"
```

### Basic Commands

```bash
# Create a plan
polka plan "Add user authentication"

# Run autonomous agents
polka agent run

# Check status
polka agent status
```

### Directory Structure

```
plans/
├── active/        # Plans being worked on
├── review/        # Plans awaiting review
├── completed/     # Successfully implemented
└── archived/      # Old plans
```

---

## 📖 Document Summary

| Document | Audience | Length | Focus |
|----------|----------|--------|-------|
| **Quick Start** | Everyone | Medium | Get running fast |
| **System Guide** | Detailed | Long | Complete reference |
| **Implementation** | Developers | Long | Build the system |

---

## 🎯 Choose Your Path

### "I want to try it now!"
→ [Quick Start Guide](./autonomous-agent-quick-start.md)

### "I want to understand how it works"
→ [Autonomous Coding Agent System](./autonomous-coding-agent.md)

### "I want to build/improve it"
→ [Implementation Tasks](./autonomous-agent-implementation-tasks.md)

---

## 🔑 Key Concepts

### Two Agents
1. **Planner**: Creates plans, reviews work, manages `plans/` directory
2. **Worker**: Implements code, writes tests, updates plan status

### Worker Permissions
- ✅ Can write code (source, tests, docs)
- ✅ Can update plan status
- ✅ Can add discovered issues to plans
- ❌ Cannot delete or restructure plans

### Planner Permissions
- ✅ Can read entire codebase
- ✅ Can write to `plans/` directory
- ❌ Cannot modify source code

### Workflow
```
Planner → Creates Plan → Worker → Implements → Updates Plan
                                                ↓
Planner ← Reviews ← Worker ← Adds Issues ← Discoveries
```

---

## 💡 Common Use Cases

### 1. Feature Development
```bash
polka plan "Add dark mode support"
```
Planner breaks it down, worker implements.

### 2. Bug Fixes
```bash
polka plan "Fix memory leak in WebSocket"
```
Planner investigates, worker fixes.

### 3. Refactoring
```bash
polka plan "Refactor API to use async/await"
```
Planner plans migration, worker executes.

### 4. Test Coverage
```bash
polka plan "Add tests to authentication module"
```
Planner identifies gaps, worker fills them.

### 5. Continuous Operation
```bash
polka agent start
```
Agents run continuously, planning and implementing.

---

## 📊 Status

**Current State**: Conceptual Design ✅
- Documentation complete
- Architecture defined
- Missing features identified
- Implementation roadmap created

**Next Steps**: Implement Missing Features
1. File access control system
2. Plan state management
3. Task extraction and tracking
4. Agent coordination protocol

**Estimated Time to MVP**: 3 weeks
**Estimated Time to Full System**: 6-8 weeks

See [Implementation Tasks](./autonomous-agent-implementation-tasks.md) for details.

---

## 🤝 Contributing

Want to help build autonomous agents?

1. Pick a task from [Implementation Tasks](./autonomous-agent-implementation-tasks.md)
2. Check the [System Guide](./autonomous-coding-agent.md) for context
3. Implement following the roadmap
4. Test with examples from [Quick Start](./autonomous-agent-quick-start.md)

---

## 📞 Questions?

- **Setup issue?** → Quick Start Guide
- **Architecture question?** → System Guide
- **Implementation help?** → Implementation Tasks
- **Example needed?** → Quick Start (has real-world examples)

---

## 🎓 Learning Path

**Beginner**:
1. Read Quick Start (10 min)
2. Try the example (5 min)
3. Create your first plan (2 min)

**Intermediate**:
1. Read System Guide - Architecture section (20 min)
2. Understand workflow diagrams (15 min)
3. Review plan template (10 min)

**Advanced**:
1. Read System Guide completely (1 hour)
2. Study Implementation Tasks (30 min)
3. Review missing features (1 hour)
4. Start implementing (ongoing)

---

Ready to automate your development? Start with the **[Quick Start Guide](./autonomous-agent-quick-start.md)**! 🚀
