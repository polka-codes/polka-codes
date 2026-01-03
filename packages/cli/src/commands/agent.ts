import { exec } from 'node:child_process'
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { promisify } from 'node:util'
import { Command } from 'commander'
import { loadConfig } from '../agent/config'
import { AutonomousAgent } from '../agent/orchestrator'
import { createLogger } from '../logger'

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
  const sessionId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  // Create minimal tools implementation for agent context
  // The agent needs executeCommand for safety checks and readFile for goal decomposition
  const asyncExec = promisify(exec)

  // Helper function to quote arguments for safe shell execution
  const quoteForShell = (str: string): string => `'${str.replace(/'/g, "'\\''")}'`

  const tools = {
    executeCommand: async (input: { command: string; args?: string[]; shell?: boolean }) => {
      // Build command from input with proper shell quoting
      let fullCommand: string
      if (input.args && input.args.length > 0) {
        // Quote each argument to handle spaces and special characters safely
        const quotedArgs = input.args.map(quoteForShell)
        fullCommand = `${input.command} ${quotedArgs.join(' ')}`
      } else {
        // Use full command string or shell mode
        fullCommand = input.command
      }

      try {
        const { stdout, stderr } = await asyncExec(fullCommand, { cwd: workingDir })
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
  } as any

  const context = {
    logger,
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
