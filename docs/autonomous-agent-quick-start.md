# Autonomous Agents - Quick Start Guide

## 🚀 Setup in 5 Minutes

### Step 1: Create Plans Directory

```bash
mkdir -p plans/active plans/review plans/completed
```

### Step 2: Create Planner Configuration

Create `.planner.yml`:

```yaml
# Simple planner agent configuration
name: Planner
model: claude-sonnet-4-20250514

# Planner can ONLY write to plans directory
writeAccess:
  - plans/**

# Planner reads everything to make informed decisions
readAccess: all

rules:
  - Break tasks into chunks under 2 hours
  - List relevant files for each task
  - Include best practices in plans
```

### Step 3: Create Worker Configuration

Create `.worker.yml`:

```yaml
# Simple worker agent configuration
name: Worker
model: claude-sonnet-4-20250514

# Worker can write code AND update plan status
writeAccess:
  - "**/*"  # All code files
  - "plans/**/*"  # Plan updates (status, issues)

rules:
  - Update task status as you work
  - Add new tasks when you discover issues
  - Report blockers immediately
  - Write tests for all code
```

That's it! You're ready to run autonomous agents.

---

## 📝 Example Usage

### Scenario 1: Create a New Feature

**User command:**
```bash
polka plan "Add user authentication with JWT tokens"
```

**Planner creates** `plans/active/jwt-auth.md`:
```markdown
# Plan: JWT Authentication

**Status**: Active
**Priority**: High
**Estimated**: 4 hours

## Tasks

### Task 1: Install dependencies
- [ ] Install jsonwebtoken package
- [ ] Install @types/jsonwebtoken
**Files**: package.json
**Estimated**: 15 min

### Task 2: Create auth utilities
- [ ] Create JWT token generation function
- [ ] Create JWT verification function
- [ ] Add error handling
**Files**: src/utils/auth.ts
**Estimated**: 1 hour

### Task 3: Add login endpoint
- [ ] POST /auth/login endpoint
- [ ] Validate credentials
- [ ] Return JWT token
**Files**: src/api/auth.ts
**Estimated**: 1.5 hours

### Task 4: Add auth middleware
- [ ] Create middleware function
- [ ] Verify token on protected routes
- [ ] Handle expired tokens
**Files**: src/middleware/auth.ts
**Estimated**: 1 hour

### Task 5: Write tests
- [ ] Test token generation
- [ ] Test token verification
- [ ] Test login endpoint
- [ ] Test middleware
**Files**: src/**/*.test.ts
**Estimated**: 1 hour

## Definition of Done
- [ ] All tasks completed
- [ ] Tests passing
- [ ] Documentation updated
```

**Worker starts Task 1**, updates plan:
```markdown
### Task 1: Install dependencies
- [x] Install jsonwebtoken package
- [x] Install @types/jsonwebtoken
**Status**: Completed ✅
**Completed**: 2025-01-08 14:15
**Notes**: Successfully installed, versions added to package.json
```

**Worker moves to Task 2**, discovers issue:
```markdown
### Task 2: Create auth utilities
**Status**: In Progress 🔄
**Started**: 2025-01-08 14:20

## Discovered Issues

### Issue: Missing environment variables
- [ ] Discovered during: Task 2
- [ ] Priority: High
- [ ] Type: Configuration
- [ ] Description: JWT secret key needs to be in environment variables
- [ ] Action required: Add JWT_SECRET to .env.example
- [ ] Suggested priority: Before Task 3
```

**Planner reviews issue**, updates plan:
```markdown
### Task 2: Create auth utilities
...existing content...

### NEW TASK (inserted before Task 3):

### Task 2.5: Configure environment variables
- [ ] Add JWT_SECRET to .env.example
- [ ] Load JWT_SECRET from process.env
- [ ] Add validation for missing secret
**Files**: .env.example, src/config/env.ts
**Estimated**: 15 min
**Reason**: Discovered during Task 2, blocks API endpoint
```

---

### Scenario 2: Fix a Bug

**User command:**
```bash
polka plan "Fix memory leak in WebSocket connections"
```

**Planner creates** `plans/active/websocket-leak.md`:
```markdown
# Plan: Fix WebSocket Memory Leak

**Status**: Active
**Priority**: High
**Type**: Bug Fix

## Overview
WebSocket connections are not being properly closed, causing memory leaks

## Tasks

### Task 1: Investigate the issue
- [ ] Add logging to WebSocket connection lifecycle
- [ ] Reproduce the leak
- [ ] Identify root cause
**Files**: src/websocket/server.ts
**Estimated**: 1 hour

### Task 2: Implement fix
- [ ] Add connection cleanup on disconnect
- [ ] Implement ping/pong heartbeat
- [ ] Add connection timeout
**Files**: src/websocket/server.ts
**Estimated**: 2 hours

### Task 3: Add tests
- [ ] Test connection cleanup
- [ ] Test heartbeat mechanism
- [ ] Test timeout handling
**Files**: src/websocket/server.test.ts
**Estimated**: 1 hour
```

**Worker investigation** (Task 1), updates status:
```markdown
### Task 1: Investigate the issue
- [x] Add logging to WebSocket connection lifecycle
- [x] Reproduce the leak
- [x] Identify root cause
**Status**: Completed ✅
**Completed**: 2025-01-08 15:30
**Notes**:
ROOT CAUSE: Connections stored in Map but never removed on disconnect.
Verified with heap snapshot: 1000 connections = 50MB leak.
```

**Worker implements fix** (Task 2), gets blocked:
```markdown
### Task 2: Implement fix
**Status**: Blocked 🚫
**Blocker**: Need to decide heartbeat interval
**Blocker Type**: Decision Required
**Needs**: Product team input on acceptable disconnect time
**Options**:
- 30 seconds: Quick disconnect, more server load
- 60 seconds: Balanced
- 120 seconds: Slower disconnect, less server load
```

**Planner reviews**, makes decision:
```markdown
### Task 2: Implement fix
**Status**: Unblocked ✅
**Decision**: Use 60 second heartbeat (balanced approach)
**Reason**: Acceptable for real-time features without excessive load
**Planner Note**: Proceed with implementation
```

**Worker completes fix**:
```markdown
### Task 2: Implement fix
- [x] Add connection cleanup on disconnect
- [x] Implement ping/pong heartbeat (60s interval)
- [x] Add connection timeout (180s)
**Status**: Completed ✅
**Completed**: 2025-01-08 17:45
**Notes**: Fix verified with heap snapshot, no leak detected
```

---

### Scenario 3: Continuous Operation

**Start autonomous agents:**
```bash
# Run once
polka agent run

# Run continuously (every 30 minutes)
polka agent start

# Check status
polka agent status

# Stop agents
polka agent stop
```

**What happens automatically:**

1. **Planner scans**:
   - Checks `plans/active/` for work to do
   - Reviews `plans/review/` for completed work
   - Identifies gaps and creates new plans
   - Updates priorities based on dependencies

2. **Worker executes**:
   - Picks up next task from `plans/active/`
   - Updates task status to "In Progress"
   - Implements the task
   - Writes tests
   - Updates task status to "Completed"
   - Adds discovered issues to plan

3. **Planner reviews**:
   - Checks completed work
   - Verifies tests pass
   - Approves (moves to `plans/completed/`) or
   - Requests rework (moves back to `plans/active/`)

4. **Cycle repeats**

---

## 🎯 Real-World Example Workflow

### Initial Request
```bash
polka plan "Add dark mode support to the application"
```

### Planner Creates Plan
`plans/active/dark-mode.md`:
```markdown
# Plan: Dark Mode Support

**Status**: Active
**Estimated**: 6 hours

## Tasks
- [ ] Add CSS variables for colors (1h)
- [ ] Create theme context (1h)
- [ ] Update all components to use themes (3h)
- [ ] Add theme toggle button (30m)
- [ ] Write tests (30m)
- [ ] Update documentation (30m)
```

### Worker Works Through Tasks

**After 1 hour**, plan updated:
```markdown
### Task 1: Add CSS variables for colors
- [x] Define light theme colors
- [x] Define dark theme colors
- [x] Add CSS custom properties
**Status**: Completed ✅
**Notes**: Colors defined in src/styles/themes.css
```

**Worker discovers issue during Task 3**:
```markdown
## Discovered Issues

### Issue: Third-party component library
- [ ] Discovered during: Task 3 (update components)
- [ ] Priority: High
- [ ] Description: UI library doesn't support theming
- [ ] Action required: Override library styles or replace component
- [ ] Estimated**: +2 hours
```

### Planner Adjusts Plan
```markdown
### Task 3: Update all components to use themes
**Estimated**: 5 hours (updated from 3h)
**Notes**: +2 hours for third-party library theming

### NEW TASK inserted:
### Task 3.5: Override third-party component styles
- [ ] Create theme overrides for UI library
- [ ] Test overrides in both themes
**Estimated**: 2 hours
**Reason**: Discovered during Task 3
```

### Final Completion
```markdown
# Plan: Dark Mode Support

**Status**: Completed ✅
**Completed**: 2025-01-08 18:00
**Total Time**: 8.5 hours (planned: 6h)

## Summary
All tasks completed. Dark mode fully functional.
Discovered issues resolved and integrated.

## Lessons Learned
- Third-party library theming took longer than expected
- Consider theming support when choosing libraries in future
```

Plan moved to `plans/completed/dark-mode.md`

---

## 🔧 Configuration Templates

### Minimal Configuration (Recommended)

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

### Advanced Configuration

**`.planner.yml`**:
```yaml
name: Planner
model: claude-sonnet-4-20250514
temperature: 0.7  # More creative planning

writeAccess:
  - plans/**

readAccess: all

rules:
  - Always estimate task duration
  - Break down tasks over 2 hours
  - List dependencies between tasks
  - Include relevant files for each task
  - Consider testing requirements
  - Think about edge cases

tools:
  enabled:
    - readFile
    - writeToFile
    - executeCommand  # For git operations
    - search  # If available
```

**`.worker.yml`**:
```yaml
name: Worker
model: claude-sonnet-4-20250514
temperature: 0.3  # More focused execution

writeAccess:
  - "src/**/*"
  - "tests/**/*"
  - "docs/**/*"
  - "plans/**/*"  # For status updates

rules:
  - Read task details carefully
  - Update plan status before starting
  - Write tests alongside code
  - Run tests before completing task
  - Report issues immediately
  - Add discovered tasks to plan
  - Never skip tests

tools:
  enabled:
    - readFile
    - writeToFile
    - executeCommand
    - runTests
```

---

## 📊 Monitoring Your Agents

### Check Status
```bash
# See what agents are working on
polka agent status

# Output example:
Active Plans: 3
Completed Plans: 12
Pending Tasks: 8
In Progress: 2 tasks
Blocked: 1 task

Current Work:
- [Worker] Task 2: Add login endpoint (In Progress)
- [Worker] Task 1: Create auth utilities (Completed)

Blocked Tasks:
- [Planner Decision] Task 2: Decide heartbeat interval
```

### View Plan Details
```bash
# See specific plan
cat plans/active/jwt-auth.md

# See recent activity
polka agent activity --last 1h

# Output example:
14:15 - Worker: Task 1 completed (Install dependencies)
14:20 - Worker: Task 2 started (Create auth utilities)
14:35 - Worker: Added issue "Missing environment variables"
14:40 - Planner: Reviewed issue, added Task 2.5
```

---

## 🎓 Common Patterns

### Pattern 1: Task Discovery During Implementation

**Original plan:**
```markdown
## Tasks
- [ ] Implement user registration
- [ ] Implement user login
```

**Worker discovers** registration needs email verification:
```markdown
### Task 1: Implement user registration
**Status**: In Progress

## Discovered Issues
### Issue: Email verification
- [ ] Discovered during: Registration implementation
- [ ] Action required: Add email service integration
- [ ] Priority: High
```

**Planner updates plan:**
```markdown
## Tasks
- [ ] Implement user registration
- [ ] **NEW** Integrate email service (discovered during Task 1)
- [ ] **NEW** Add email verification flow
- [ ] Implement user login
```

### Pattern 2: Blocking Issue

**Worker blocked:**
```markdown
### Task 3: Add database indexing
**Status**: Blocked 🚫
**Blocker**: Need DBA approval for index strategy
**Blocker Type**: Approval Required
**Waiting on**: DBA team
```

**Planner can**:
- Unblock with decision if autonomous
- Escalate to human if requires approval
- Create parallel task for worker to do meanwhile

### Pattern 3: Task Completion

**Worker finishes task:**
```markdown
### Task 2: Create auth utilities
- [x] Create JWT token generation
- [x] Create JWT verification
- [x] Add error handling
- [x] Write tests
**Status**: Completed ✅
**Completed**: 2025-01-08 15:45
**Tests**: ✅ All passing (12/12)
**Notes**:
- Used HS256 algorithm
- Token expiry: 24 hours
- All edge cases covered
```

**Planner reviews**, marks plan complete:
```markdown
# Plan: JWT Authentication
**Status**: Completed ✅
**Completed**: 2025-01-08 16:00
**Verified By**: Planner
**Tests**: ✅ Passing
**Review**: Implementation follows best practices, ready for merge
```

---

## ⚡ Quick Commands Reference

```bash
# Planning
polka plan "Task description"              # Create new plan
polka plan --review plans/active/*.md      # Review active plans
polka plan --improve plan.md               # Improve existing plan

# Execution
polka agent run                            # Run once
polka agent start                          # Start continuous mode
polka agent stop                           # Stop continuous mode
polka agent status                         # Check status
polka agent logs                           # View agent logs

# Plans
ls plans/active/                           # List active plans
cat plans/active/feature-x.md              # View plan
polka plan --archive feature-x             # Archive completed plan
```

---

## 🎯 Best Practices

### For Users
1. **Start with clear goals**: "Add X feature" not "improve code"
2. **Provide context**: Include business requirements
3. **Check progress regularly**: Review plans every few hours
4. **Test before merging**: Always verify agent work
5. **Keep humans in loop**: Critical changes need approval

### For Planner Configuration
1. **Keep it simple**: Start with minimal config
2. **Focus on planning**: Planner should plan, not code
3. **Limit write access**: Only `plans/**` directory
4. **Set clear rules**: Task size, file lists, dependencies
5. **Review thoroughly**: Check worker work before approving

### For Worker Configuration
1. **Full code write access**: Needs to modify files
2. **Plan write access too**: For status updates and issues
3. **Test-first mindset**: Write tests with code
4. **Communicate blocks**: Report issues immediately
5. **Follow the plan**: Don't deviate without reason

---

## 🐛 Troubleshooting

### Problem: Worker stuck on a task
```bash
# Check plan status
cat plans/active/plan.md

# Look for "Status: Blocked"
# Add decision if planner hasn't responded
```

### Problem: Planner creating poor plans
```yaml
# Add more specific rules to .planner.yml
rules:
  - Break tasks into 1-2 hour chunks
  - Always list 3-5 relevant files per task
  - Include testing as separate task
  - Consider error handling in each task
```

### Problem: Too many discovered issues
```bash
# Have planner do initial investigation
polka plan "Investigate X thoroughly before implementation"

# This creates research tasks first
```

### Problem: Plans not being completed
```bash
# Check agent status
polka agent status

# Look for blocked tasks
grep -r "Status: Blocked" plans/active/

# Unblock or escalate
```

---

## 📈 Scaling Up

### Multiple Workers

Create specialized workers:

**`.worker-frontend.yml`**:
```yaml
name: Frontend Worker
writeAccess:
  - "src/frontend/**/*"
  - "plans/**/*"
rules:
  - Focus on UI components
  - Test with Storybook
  - Follow design system
```

**`.worker-backend.yml`**:
```yaml
name: Backend Worker
writeAccess:
  - "src/backend/**/*"
  - "plans/**/*"
rules:
  - Focus on API endpoints
  - Write integration tests
  - Document API changes
```

Run in parallel:
```bash
polka agent start --workers frontend,backend
```

### Advanced Monitoring

Create monitoring dashboard:
```bash
# Install dependencies
npm install --save-dev polka-agent-monitor

# Start dashboard
polka agent monitor --port 3000

# View at http://localhost:3000
```

Shows:
- Active plans and tasks
- Worker activity
- Blocked tasks
- Completion rate
- Time estimates vs actual

---

That's it! You now have everything you need to run autonomous coding agents.

**Remember**: Start simple, add complexity as needed. The minimal configuration works great for most use cases.
