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
export async function runAgent(goal: string | undefined, options: Record<string, unknown>, _command: Command) {
  const logger = createLogger({ verbose: options.verbose || 0 })
  logger.info('🤖 Polka Agent')
  logger.info('='.repeat(60))

  // Map CLI options to config format
  // --continuous flag maps to strategy: 'continuous-improvement'
  // --approval-level maps to approval.level in config
  const configOptions = {
    ...options,
    strategy: options.continuous ? 'continuous-improvement' : options.strategy,
    approval: {
      level: options.approvalLevel,
    },
  }

  // Load configuration
  const config = await loadConfig(configOptions, options.config)

  // Create workflow context
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

  // Create minimal tools implementation for agent context
  const tools = {
    executeCommand: async (input: { command: string; args?: string[]; shell?: boolean }) => {
      // SECURITY: We use child_process.exec (not spawn) to enable shell features needed by git commands.
      // This is safe because:
      // 1. All arguments are quoted using quoteForShell() to prevent injection
      // 2. The agent is intended for local development where the user has full shell access anyway
      // 3. Working directory is restricted to the project root
      //
      // Trade-off: Using exec with a string is riskier than spawn with an argument array, but
      // necessary for shell operations like git which require shell expansion. The quoteForShell
      // function is designed to handle all shell special characters safely.

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
      } catch (error) {
        // Handle ENOBUFS errors (buffer overflow) explicitly
        const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined
        const errorErrno = error && typeof error === 'object' && 'errno' in error ? String(error.errno) : undefined
        const errorMessage = error instanceof Error ? error.message : String(error)

        if (errorErrno === 'ENOBUFS' || errorCode === 'ENOBUFS') {
          const errorStdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : ''
          return {
            exitCode: 1,
            stdout: errorStdout,
            stderr: `Command output exceeded buffer limit (10MB). The command produced too much output. Try using different arguments or redirecting output to a file. Original error: ${errorMessage}`,
          }
        }

        const errorStdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout) : ''
        const errorStderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : errorMessage
        return {
          exitCode: parseInt(errorCode || '1', 10),
          stdout: errorStdout,
          stderr: errorStderr,
        }
      }
    },

    readFile: async ({ path: filePath }: { path: string }) => {
      const fullPath = path.resolve(workingDir, filePath)
      // Validate path is within working directory to prevent reading arbitrary files
      // NOTE: This validation prevents basic path traversal but doesn't protect against:
      // - Symlinks that point outside the working directory
      // - Case-insensitive filesystems (Windows/macOS) where paths could differ in case
      // For a local CLI tool, this level of protection is reasonable to prevent accidental reads
      const normalizedPath = path.normalize(fullPath)
      const normalizedWorkingDir = path.normalize(workingDir)
      if (!normalizedPath.startsWith(normalizedWorkingDir + path.sep) && normalizedPath !== normalizedWorkingDir) {
        throw new Error(`Path "${filePath}" is outside working directory "${workingDir}"`)
      }
      const content = await fs.readFile(fullPath, 'utf-8')
      return { content }
    },
  } as WorkflowTools<AgentToolsRegistry>

  // Available tools in agent context
  const AVAILABLE_TOOLS = Object.keys(tools).join(', ')

  // Add runtime guard to catch attempts to use unavailable tools
  const toolsWithGuard = new Proxy(tools, {
    get(_target, prop: string) {
      if (prop in tools) {
        return tools[prop as keyof typeof tools]
      }
      throw new Error(
        `Tool "${prop}" is not available in agent context. ` +
          `Available tools: ${AVAILABLE_TOOLS}. ` +
          `See packages/cli/src/commands/agent.ts for details on how to enable full tool support.`,
      )
    },
  })

  // Simple step function for workflow execution tracking
  // NOTE: This is a minimal implementation that bypasses some workflow step features:
  // - No retry logic on failures
  // - No step timeout handling
  // - No detailed step event logging
  // This is acceptable for the agent command context where the autonomous agent
  // handles its own retries and error recovery. The step function exists primarily
  // for compatibility with the workflow system.
  const step: StepFn = async <T>(_name: string, optionsOrFn: unknown, fn?: () => Promise<T>) => {
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
    tools: toolsWithGuard,
    env: process.env,
  }

  // Create agent
  const agent = new AutonomousAgent(config, context)

  try {
    // Initialize
    await agent.initialize()

    // Check mode
    if (options.continuous) {
      logger.info('🔄 Mode: Continuous Improvement')

      await agent.runContinuous()
    } else {
      if (!goal) {
        logger.error('❌ Error: Goal is required for goal-directed mode')
        logger.error('Usage: bun run agent "your goal here"')
        logger.error('')
        logger.error('Or use --continuous for autonomous improvement mode')
        await agent.cleanup()
        return { success: false, error: 'Goal is required for goal-directed mode' }
      }

      logger.info(`📝 Goal: ${goal}`)

      await agent.setGoal(goal)
      await agent.run()
    }

    // Cleanup
    await agent.cleanup()

    logger.info('')
    logger.info('✅ Agent session complete')
    logger.info('')

    return { success: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error('')
    logger.error(`❌ Agent failed: ${errorMessage}`)
    logger.error('')

    try {
      await agent.cleanup()
    } catch {
      // Ignore cleanup errors
    }

    return { success: false, error: errorMessage }
  }
}

export const agentCommand = new Command('agent')
  .description('Run autonomous agent (experimental)')
  .argument('[goal]', 'Goal to achieve', '')
  .option('--continuous', 'Run in continuous improvement mode')
  .option('--preset <name>', 'Configuration preset', 'balanced')
  .option('--config <path>', 'Configuration file path')
  .option('--approval-level <level>', 'Approval level (none|destructive|commits|all)', 'destructive')
  .action(runAgent)
