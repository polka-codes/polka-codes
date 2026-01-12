# Agent Command Analysis - Apply Workflow Learnings

## Current State Assessment

### Agent Command (packages/cli/src/commands/agent.ts)

**Strengths:**
- ✅ Good type safety (all `any` types replaced)
- ✅ Proper error handling with type guards
- ✅ Clear CLI option definitions
- ✅ Well-documented limitations (lines 60-78)
- ✅ Security considerations documented (lines 84-92)
- ✅ Path traversal protection (lines 142-152)

**Weaknesses (based on workflow learnings):**
- ❌ Uses imperative code instead of declarative config
- ❌ Hardcoded console.log statements instead of logger
- ❌ Direct process.exit() calls (not testable)
- ❌ Minimal tool support (only 2 tools vs workflow's full set)
- ❌ No integration with runWorkflow infrastructure
- ❌ Different error handling pattern than workflow

## Key Learnings from Workflow Command

### 1. Use Logger, Not Console

**Agent (current):**
```typescript
console.log('🤖 Polka Agent')
console.log('='.repeat(60))
console.error('❌ Error: Goal is required')
```

**Workflow (better):**
```typescript
const logger = createLogger({ verbose })
logger.info('Loading workflow...')
logger.error('Error: ...')
```

**Benefits:**
- Consistent formatting
- Configurable verbosity levels
- Testable (can spy on logger)
- Supports structured logging

### 2. Avoid Direct process.exit()

**Agent (current):**
```typescript
process.exit(0)  // Not testable
process.exit(1)  // Not testable
```

**Workflow (better):**
```typescript
// Returns normally, lets caller handle exit
// More testable and reusable
```

### 3. Use runWorkflow Infrastructure

**Agent (current):**
```typescript
// Creates own context, tools, provider
// Duplicates logic from runWorkflow
// Limited tool support
```

**Workflow (better):**
```typescript
await runWorkflow(workflowFn, workflowInput, {
  commandName: 'workflow',
  context: globalOpts,
  logger
})
```

### 4. Proper Error Handling Pattern

**Agent (current):**
```typescript
catch (error) {
  console.error('❌ Agent failed:', error)
  await agent.cleanup()
  process.exit(1)
}
```

**Workflow (better):**
```typescript
catch (error) {
  const errorMessage = error instanceof Error
    ? error.message
    : String(error)
  logger.error(`Failed: ${errorMessage}`)
  // Return, don't exit
}
```

## Proposed Improvements

### High Priority (Fix Critical Issues)

#### 1. Replace Console with Logger

**Before:**
```typescript
console.log('🤖 Polka Agent')
console.log('='.repeat(60))
console.log('')
```

**After:**
```typescript
const logger = createLogger({ verbose: options.verbose || 0 })
logger.info('🤖 Polka Agent')
logger.info('='.repeat(60))
```

#### 2. Remove process.exit() Calls

**Before:**
```typescript
process.exit(0)
process.exit(1)
```

**After:**
```typescript
// Return normally
// Let CLI layer handle exit codes
return { success: true/false, error?: string }
```

#### 3. Use runWorkflow for Tool Support

**Before:**
```typescript
// Minimal tools with 2 functions
const tools = {
  executeCommand: async (...) => { ... },
  readFile: async (...) => { ... }
}
```

**After:**
```typescript
// Use full workflow infrastructure
await runWorkflow(agentWorkflow, agentInput, {
  commandName: 'agent',
  context: globalOpts,
  logger,
})
```

### Medium Priority (Improve Maintainability)

#### 4. Extract Agent to Workflow

**Concept:** Convert agent logic to a workflow file

**benefits/agent.yml:**
```yaml
workflows:
  main:
    task: "Autonomous agent execution"

    inputs:
      - id: "goal"
      - id: "continuous"
      - id: "approvalLevel"

    steps:
      - id: "check-mode"
        if:
          condition: "continuous"
          thenBranch:
            - id: "run-continuous"
              task: "Run continuous improvement loop"
              tools: ["executeCommand", "readFile"]

          elseBranch:
            - id: "run-goal"
              task: "Execute goal: {{ goal }}"
              tools: ["executeCommand", "readFile"]
```

**Usage:**
```bash
polka workflow -f benefits/agent.yml "goal: Fix tests"
```

#### 5. Standardize Error Handling

**Before:**
```typescript
} catch (error) {
  console.error('❌ Agent failed:', error)
}
```

**After:**
```typescript
} catch (error) {
  const errorMessage = error instanceof Error
    ? error.message
    : String(error)
  logger.error(`Agent failed: ${errorMessage}`)
  return { success: false, error: errorMessage }
}
```

### Low Priority (Enhance Features)

#### 6. Add Workflow-Based Agent Mode

Create a new command that uses workflows:

```typescript
export const agentWorkflowCommand = new Command('agent-workflow')
  .description('Run autonomous agent using workflow engine')
  .argument('[goal]', 'Goal to achieve')
  .option('-f, --file <path>', 'Agent workflow file')
  .option('-w, --workflow <name>', 'Workflow name')
  .action(runAgentWorkflow)
```

This would:
- Use workflow engine for agent logic
- Support YAML-based agent configuration
- Leverage full tool ecosystem
- Be more maintainable

## Migration Strategy

### Phase 1: Quick Wins (1-2 days)

1. Replace console.log with logger
2. Remove process.exit() calls
3. Standardize error handling
4. Update type annotations

### Phase 2: Integration (3-5 days)

1. Create agent workflow YAML files
2. Add workflow-based agent command
3. Test both implementations in parallel
4. Document differences

### Phase 3: Migration (1 week)

1. Deprecate old agent command
2. Migrate documentation to workflow-based agent
3. Keep old command for backward compatibility
4. Add migration guide

## Recommendation

**Short-term:** Apply high-priority improvements to existing agent command
- Use logger instead of console
- Remove process.exit() for testability
- Standardize error handling

**Long-term:** Consider deprecating agent command in favor of workflow-based agents
- More declarative (YAML vs code)
- Better tool support
- Consistent with other commands
- Easier to maintain and extend

## Conclusion

The workflow command has several good patterns that the agent command should adopt:
1. Logger usage over console
2. Return values over process.exit()
3. runWorkflow infrastructure for tool support
4. Consistent error handling

Applying these learnings will make the agent command more:
- **Testable** (no direct exit calls)
- **Maintainable** (consistent patterns)
- **Integrated** (uses shared infrastructure)
- **Reliable** (better error handling)
