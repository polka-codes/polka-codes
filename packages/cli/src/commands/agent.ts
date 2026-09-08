import { randomUUID } from 'node:crypto'
import * as path from 'node:path'
import type { WorkflowFn } from '@polka-codes/core'
import { Command } from 'commander'
import { z } from 'zod'
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
  const parsed = z
    .object({
      continuous: z.boolean().optional(),
      strategy: z.enum(['goal-directed', 'continuous-improvement']).optional(),
      approvalLevel: z.enum(['none', 'destructive', 'commits', 'all']).optional(),
      preset: z.string().optional(),
      config: z.string().optional(),
    })
    .parse(options)
  const config = await loadConfig(
    {
      ...(parsed.continuous ? { strategy: 'continuous-improvement' } : parsed.strategy ? { strategy: parsed.strategy } : {}),
      ...(parsed.approvalLevel ? { approval: { level: parsed.approvalLevel } } : {}),
      ...(parsed.preset ? { preset: parsed.preset } : {}),
    },
    parsed.config,
  )

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
  .option('--preset <name>', 'Configuration preset')
  .option('--config <path>', 'Configuration file path')
  .option('--approval-level <level>', 'Approval level (none|destructive|commits|all)')
  .action(runAgent)
