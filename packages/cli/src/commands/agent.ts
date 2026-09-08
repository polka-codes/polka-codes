import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import type { WorkflowFn } from '@polka-codes/core'
import { Command } from 'commander'
import { loadConfig } from '../agent/config'
import { AutonomousAgent } from '../agent/orchestrator'
import type { AgentConfig, CliWorkflowContext } from '../agent/types'
import { runWorkflow } from '../runWorkflow'
import { getBaseWorkflowOptions } from '../utils/command'
import type { CliToolRegistry } from '../workflow-tools'
import type { BaseWorkflowInput } from '../workflows/workflow.utils'

export const autonomousAgentWorkflow: WorkflowFn<
  { goal?: string; agentConfig: AgentConfig } & BaseWorkflowInput,
  void,
  CliToolRegistry
> = async (input, context) => {
  const workingDir = process.cwd()
  const agentContext: CliWorkflowContext = {
    ...context,
    workingDir,
    stateDir: path.join(workingDir, '.polka', 'agent-state'),
    sessionId: `agent-${Date.now()}-${randomUUID()}`,
    workflowInput: input,
  }
  const agent = new AutonomousAgent(input.agentConfig, agentContext)
  try {
    await agent.initialize()
    if (input.agentConfig.strategy === 'continuous-improvement') await agent.runContinuous()
    else {
      if (!input.goal) throw new Error('A goal is required for goal-directed mode')
      await agent.setGoal(input.goal)
      await agent.run()
    }
  } finally {
    await agent.cleanup()
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
  const workflowOptions = getBaseWorkflowOptions(_command)
  // Map CLI options to config format
  // --continuous flag maps to strategy: 'continuous-improvement'
  // --approval-level maps to requireApprovalFor in config
  const strategy: 'goal-directed' | 'continuous-improvement' = options.continuous
    ? 'continuous-improvement'
    : ((options.strategy as 'goal-directed' | 'continuous-improvement') ?? 'goal-directed')
  const requireApprovalFor: 'none' | 'destructive' | 'commits' | 'all' =
    (options.approvalLevel as 'none' | 'destructive' | 'commits' | 'all') ?? 'destructive'

  const configOptions = {
    strategy,
    approval: { level: requireApprovalFor, autoApproveSafeTasks: true, maxAutoApprovalCost: 5 },
  }

  // Load configuration
  const config = await loadConfig(configOptions, options.config as string | undefined)

  await runWorkflow(
    autonomousAgentWorkflow,
    { goal, agentConfig: config },
    {
      commandName: 'agent',
      context: workflowOptions,
      logger: workflowOptions.logger,
      interactive: workflowOptions.interactive,
    },
  )
}

export const agentCommand = new Command('agent')
  .description('Run autonomous agent (experimental)')
  .argument('[goal]', 'Goal to achieve', '')
  .option('--continuous', 'Run in continuous improvement mode')
  .option('--preset <name>', 'Configuration preset', 'balanced')
  .option('--config <path>', 'Configuration file path')
  .option('--approval-level <level>', 'Approval level (none|destructive|commits|all)', 'destructive')
  .action(runAgent)
