import * as path from 'node:path'
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
  const logger = createLogger()
  const workingDir = process.cwd()
  const stateDir = path.join(workingDir, '.polka', 'agent-state')
  const sessionId = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  const context = {
    logger,
    workingDir,
    stateDir,
    sessionId,
    tools: [], // Will be populated by workflows
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
