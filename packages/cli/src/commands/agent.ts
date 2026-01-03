import { exec } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'
import type { StepFn, ToolRegistry, WorkflowTools } from '@polka-codes/core'
import { Command } from 'commander'
import { loadConfig } from '../agent/config'
import { AutonomousAgent } from '../agent/orchestrator'
import { createLogger } from '../logger'
import { quoteForShell } from '../utils/shell'

/**
 * Tool registry for agent command execution
 */
type AgentToolsRegistry = ToolRegistry & {
  executeCommand: {
    input: { command: string; args?: string[]; shell?: boolean }
    output: { exitCode: number; stdout: string; stderr: string }
  }
  readFile: {
    input: { path: string }
    output: { content: string }
  }
}

/**
 * Autonomous agent command
 *
 * Usage:
 *   bun run agent "Add user authentication"           # Goal-directed mode
 *   bun run agent --continuous                       # Continuous improvement mode
 *   bun run agent --preset conservative "Fix tests"  # Use preset configuration
 */
export async function runAgent(goal: string | undefined, options: any, _command: Command) {
  console.log('🤖 Polka Agent')
  console.log('='.repeat(60))
  console.log('')

  // Load configuration
  const config = await loadConfig(options, options.config)

  // Create workflow context
  const logger = createLogger({ verbose: options.verbose || 0 })
  const workingDir = process.cwd()
  const stateDir = path.join(workingDir, '.polka', 'agent-state')
  const sessionId = `agent-${Date.now()}-${randomUUID()}`

  // Create minimal tools implementation for agent context
  //
  // CRITICAL LIMITATION: The agent currently only provides executeCommand and readFile.
  // When the agent invokes workflows (code, fix, plan, etc.) via WorkflowAdapter, those
  // workflows expect a full tool context (writeToFile, listFiles, searchFiles, etc.).
  //
  // This will cause runtime errors if workflows try to use tools beyond executeCommand
  // and readFile. The agent context should be initialized with full tools like runWorkflow
  // does, using the toolCall infrastructure and provider.
  //
  // For now, the agent is primarily used for task discovery and planning, which only
  // requires executeCommand and readFile. Full workflow execution support requires:
  // 1. Initializing provider (getProvider, getModel)
  // 2. Creating UsageMeter
  // 3. Initializing MCP manager
  // 4. Creating Proxy-based tools delegation to toolCall
  // 5. Passing full context to AutonomousAgent
  //
  // TODO: Refactor agent.ts to use runWorkflow infrastructure for full tool support
  const asyncExec = promisify(exec)

  const tools = {
    executeCommand: async (input: { command: string; args?: string[]; shell?: boolean }) => {
      // Build command from input with proper shell quoting
      let fullCommand: string
      if (input.args && input.args.length > 0) {
        // Quote each argument to handle spaces and special characters safely
        const quotedArgs = input.args.map(quoteForShell)
        fullCommand = `${input.command} ${quotedArgs.join(' ')}`
      } else {
        // Use full command string
        fullCommand = input.command
      }

      // Note: exec always spawns a shell, so the 'shell' parameter is ignored.
      // This is intentional for safety - we want shell expansion for git commands.
      // All arguments are properly quoted to prevent injection.

      try {
        // Increase maxBuffer to handle large git operations (10MB instead of default 1MB)
        const { stdout, stderr } = await asyncExec(fullCommand, {
          cwd: workingDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        })
        return { exitCode: 0, stdout, stderr }
      } catch (error: any) {
        return {
          exitCode: error.code || 1,
          stdout: error.stdout || '',
          stderr: error.stderr || error.message,
        }
      }
    },

    readFile: async ({ path: filePath }: { path: string }) => {
      const fullPath = path.resolve(workingDir, filePath)
      const content = await fs.readFile(fullPath, 'utf-8')
      return { content }
    },
  } as WorkflowTools<AgentToolsRegistry>

  // Simple step function for workflow execution tracking
  // NOTE: This is a minimal implementation that bypasses some workflow step features:
  // - No retry logic on failures
  // - No step timeout handling
  // - No detailed step event logging
  // This is acceptable for the agent command context where the autonomous agent
  // handles its own retries and error recovery. The step function exists primarily
  // for compatibility with the workflow system.
  const step: StepFn = async <T>(_name: string, optionsOrFn: any, fn?: () => Promise<T>) => {
    const actualFn = fn || optionsOrFn
    if (typeof actualFn === 'function') {
      return await actualFn()
    }
    throw new Error('Invalid step function call')
  }

  const context = {
    logger,
    step,
    workingDir,
    stateDir,
    sessionId,
    tools,
    env: process.env,
  }

  // Create agent
  const agent = new AutonomousAgent(config, context)

  try {
    // Initialize
    await agent.initialize()

    // Check mode
    if (options.continuous) {
      console.log('🔄 Mode: Continuous Improvement')
      console.log('')

      await agent.runContinuous()
    } else {
      if (!goal) {
        console.error('❌ Error: Goal is required for goal-directed mode')
        console.error('Usage: bun run agent "your goal here"')
        console.error('')
        console.error('Or use --continuous for autonomous improvement mode')
        await agent.cleanup()
        process.exit(1)
        return
      }

      console.log(`📝 Goal: ${goal}`)
      console.log('')

      await agent.setGoal(goal)
      await agent.run()
    }

    // Cleanup
    await agent.cleanup()

    console.log('')
    console.log('✅ Agent session complete')
    console.log('')

    process.exit(0)
  } catch (error) {
    console.error('')
    console.error('❌ Agent failed:', error)
    console.error('')

    try {
      await agent.cleanup()
    } catch {}

    process.exit(1)
  }
}

export const agentCommand = new Command('agent')
  .description('Run autonomous agent (experimental)')
  .argument('[goal]', 'Goal to achieve', '')
  .option('--continuous', 'Run in continuous improvement mode')
  .option('--preset <name>', 'Configuration preset', 'balanced')
  .option('--config <path>', 'Configuration file path')
  .option('-y, --yes', 'Auto-approve all tasks')
  .option('--max-iterations <n>', 'Maximum iterations in continuous mode', '0')
  .option('--require-approval <level>', 'Approval level (none|destructive|commits|all)', 'destructive')
  .option('--timeout <minutes>', 'Session timeout in minutes', '0')
  .option('--dry-run', 'Show plan without executing')
  .option('--stop', 'Stop running agent')
  .action(runAgent)
