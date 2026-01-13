# Script/Workflow Generation Command - Implementation Plan

## Overview

Create a new `script` command that generates standalone scripts or workflow files with a plan phase for user confirmation before generation. This follows the pattern of the existing `code` command but is specialized for script generation.

## Feature Requirements

### Core Functionality
1. **Generate standalone scripts** (bash, Python, JavaScript/TypeScript, etc.)
2. **Generate workflow files** (.workflow.ts files compatible with the existing workflow system)
3. **Plan-first approach** - Generate and display a plan, wait for user approval
4. **Multiple input modes** - CLI argument, stdin, or interactive prompt
5. **Output control** - Specify output file path or use intelligent defaults
6. **Template support** - Use appropriate templates for different script types

### User Experience Flow
```
User: bun run script "Create a deployment script for production"
  ↓
Phase 1: Planning
  - Analyze requirements
  - Explore codebase for deployment patterns
  - Generate detailed implementation plan
  - Display plan to user
  - Wait for approval (y/n/edit)
  ↓
Phase 2: Generation (after approval)
  - Generate script content based on plan
  - Apply appropriate template/shebang
  - Add error handling and logging
  - Write to output file
  ↓
Phase 3: Validation (optional)
  - Check script syntax
  - Validate dependencies
  - Test basic functionality
  ↓
Complete: Display summary and file location
```

## Architecture Design

### 1. Command Structure (`packages/cli/src/commands/script.ts`)

```typescript
export const scriptCommand = new Command('script')
  .description('Generate standalone scripts or workflow files')
  .argument('[task]', 'Description of the script to generate')
  .option('-o, --output <path>', 'Output file path')
  .option('-t, --type <type>', 'Script type (bash, python, js, ts, workflow)')
  .option('--no-plan', 'Skip planning phase (not recommended)')
  .option('--interactive', 'Interactive planning mode with feedback loop')
  .option('--validate', 'Run validation after generation')
  .action(runScript)
```

### 2. Workflow Structure (`packages/cli/src/workflows/script.workflow.ts`)

```typescript
interface ScriptWorkflowInput {
  task: string
  output?: string
  type?: ScriptType
  validate?: boolean
}

type ScriptType = 'bash' | 'python' | 'js' | 'ts' | 'workflow'

const scriptWorkflow: Workflow<ScriptWorkflowInput> = {
  phases: [
    {
      name: 'Plan',
      execute: planPhase,
    },
    {
      name: 'Generate',
      execute: generatePhase,
    },
    {
      name: 'Validate',
      execute: validatePhase,
      optional: true,
    },
  ],
}
```

### 3. Key Components

#### A. Script Generator (`packages/cli/src/workflows/script/generator.ts`)
- **Script templates** for each type (bash, python, js, ts, workflow)
- **Content generation** with proper formatting and structure
- **Dependency detection** and inclusion
- **Shebang and header generation**

#### B. Script Validator (`packages/cli/src/workflows/script/validator.ts`)
- **Syntax checking** (shellcheck for bash, ast for python/js/ts)
- **Dependency verification**
- **Security checks** (e.g., no hardcoded secrets)
- **Best practices validation**

#### C. Planning Prompts (`packages/cli/src/workflows/script/prompts/`)
- `plan.ts` - Planning-specific prompts for script generation
- Focus on:
  - Script purpose and usage
  - Required dependencies
  - Input/output specifications
  - Error handling strategy
  - Testing approach

## Implementation Steps

### Step 1: Create Base Command Structure
**File**: `packages/cli/src/commands/script.ts`

1. Create the script command with CLI options
2. Implement input handling (arg/stdin/prompt)
3. Integrate with `runWorkflow()` similar to code command
4. Add API function in `packages/cli/src/api.ts`

### Step 2: Create Script Workflow
**File**: `packages/cli/src/workflows/script.workflow.ts`

1. Define `ScriptWorkflowInput` interface
2. Create 3-phase workflow (Plan, Generate, Validate)
3. Implement state management between phases
4. Pass plan results to generation phase

### Step 3: Implement Planning Phase
**Files**:
- `packages/cli/src/workflows/script/prompts/plan.ts`
- `packages/cli/src/workflows/script/plan.ts`

1. Create planning prompts specialized for script generation
2. Reuse existing `planWorkflow` with custom context
3. Generate plan including:
   - Script type and format
   - File structure and organization
   - Dependencies and imports
   - Key functions/sections
   - Error handling approach
   - Usage examples

### Step 4: Implement Generation Phase
**Files**:
- `packages/cli/src/workflows/script/generator.ts`
- `packages/cli/src/workflows/script/templates/` (templates for each type)

1. Create script templates:
   - `bash.template.ts` - Bash script template
   - `python.template.ts` - Python script template
   - `js.template.ts` - JavaScript template
   - `ts.template.ts` - TypeScript template
   - `workflow.template.ts` - Workflow file template

2. Implement generator logic:
   - Parse plan to extract requirements
   - Select appropriate template
   - Generate script content using AI
   - Apply template formatting
   - Add comments and documentation

3. Output handling:
   - Use specified output path
   - Or generate intelligent default (e.g., `scripts/deploy-production.sh`)
   - Create directory if needed
   - Write file with proper permissions

### Step 5: Implement Validation Phase (Optional)
**File**: `packages/cli/src/workflows/script/validator.ts`

1. Syntax validation:
   - Bash: Use `shellcheck` if available
   - Python: Use `python -m py_compile`
   - JS/TS: Use TypeScript compiler

2. Dependency checks:
   - Verify required tools/commands exist
   - Check imported modules are available
   - Validate external references

3. Security validation:
   - Check for hardcoded secrets
   - Warn on dangerous operations
   - Validate file permissions

### Step 6: Create CLI Integration
**File**: `packages/cli/src/cli.ts`

1. Register the script command
2. Add help text and examples
3. Integrate with existing command structure

### Step 7: Add Tests
**Files**:
- `packages/cli/src/commands/script.test.ts`
- `packages/cli/src/workflows/script.workflow.test.ts`
- `packages/cli/src/workflows/script/generator.test.ts`
- `packages/cli/src/workflows/script/validator.test.ts`

1. Unit tests for each component
2. Integration tests for full workflow
3. Test with different script types
4. Test error handling

## File Structure

```
packages/cli/src/
├── commands/
│   ├── script.ts                    # NEW - Main script command
│   └── script.test.ts               # NEW - Command tests
├── workflows/
│   ├── script.workflow.ts           # NEW - Script workflow definition
│   ├── script.workflow.test.ts      # NEW - Workflow tests
│   └── script/
│       ├── plan.ts                  # NEW - Planning phase logic
│       ├── generator.ts             # NEW - Script generation logic
│       ├── validator.ts             # NEW - Validation logic
│       ├── prompts/
│       │   └── plan.ts              # NEW - Planning prompts
│       └── templates/
│           ├── bash.template.ts     # NEW - Bash template
│           ├── python.template.ts   # NEW - Python template
│           ├── js.template.ts       # NEW - JavaScript template
│           ├── ts.template.ts       # NEW - TypeScript template
│           └── workflow.template.ts # NEW - Workflow file template
└── api.ts                           # MODIFIED - Add script() function
```

## Template Examples

### Bash Template
```bash
#!/bin/bash
set -euo pipefail

# Description: {{DESCRIPTION}}
# Usage: {{USAGE}}
# Author: Generated by Polka Codes

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
{{CONFIG_SECTION}}

# Logging
log_info() { echo "[INFO] $*"; }
log_error() { echo "[ERROR] $*" >&2; }

# Main function
main() {
  {{MAIN_LOGIC}}
}

# Run main
main "$@"
```

### Python Template
```python
#!/usr/bin/env python3
"""
{{DESCRIPTION}}

Usage:
    {{USAGE}}
"""

import argparse
import logging
import sys

# Configuration
{{CONFIG_SECTION}}

# Setup logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def main():
    """Main entry point."""
    {{MAIN_LOGIC}}

if __name__ == "__main__":
    main()
```

### Workflow Template
```typescript
import { StepFn } from '@polka-codes/core'

/**
 * {{DESCRIPTION}}
 */
export async function {{WORKFLOW_NAME}}(
  input: {{INPUT_TYPE}},
  context: {
    logger: Logger
    step: StepFn
    tools: WorkflowTools
    workingDir: string
    stateDir: string
    sessionId: string
  }
): Promise<{{RETURN_TYPE}}> {
  {{WORKFLOW_LOGIC}}
}
```

## Usage Examples

### Example 1: Generate a deployment script
```bash
bun run script "Create a script to deploy the app to production with backups"
# Output: scripts/deploy-production.sh
```

### Example 2: Generate a Python utility
```bash
bun run script "Create a script to process CSV files and output JSON" -t python -o scripts/csv-to-json.py
```

### Example 3: Generate a workflow file
```bash
bun run script "Create a workflow for running tests and generating coverage" -t workflow
# Output: workflows/test-coverage.workflow.ts
```

### Example 4: Interactive planning
```bash
bun run script "Create a database migration script" --interactive
# Shows plan, waits for feedback, regenerates if needed
```

## Testing Strategy

### Unit Tests
- Test each generator independently
- Test template rendering
- Test validation logic
- Test error handling

### Integration Tests
- Test full workflow end-to-end
- Test with different script types
- Test with various input sources
- Test file output and permissions

### Manual Testing
- Generate scripts for real use cases
- Validate generated scripts work correctly
- Test user interaction in planning mode
- Verify error messages are helpful

## Future Enhancements

1. **Script registry** - Track generated scripts for future reference
2. **Script update** - Update existing scripts based on new requirements
3. **Script testing** - Automatically generate tests for scripts
4. **Script documentation** - Generate README or man pages
5. **Interactive script builder** - Step-by-step script creation
6. **Script library** - Pre-built script templates for common tasks

## Dependencies

### Existing Dependencies (Already Available)
- `commander` - CLI framework
- `@polka-codes/core` - Core workflow types
- Existing workflow infrastructure
- Planning and agent workflows

### New Dependencies (May Need)
- `shellcheck` (optional) - Bash script validation
- Template engine (if needed beyond string interpolation)

## Success Criteria

1. ✅ Command generates valid, working scripts
2. ✅ Planning phase produces useful, actionable plans
3. ✅ User approval workflow works correctly
4. ✅ Generated scripts follow best practices
5. ✅ Validation catches common errors
6. ✅ Integration with existing CLI is seamless
7. ✅ Tests cover main use cases
8. ✅ Documentation is clear and helpful
