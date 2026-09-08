import { deepMerge } from '@polka-codes/core'
import { z } from 'zod'
import { CONFIG_PRESETS, DEFAULT_AGENT_CONFIG, WORKFLOW_MAPPING } from './constants'
import { ConfigValidationError } from './errors'
import type { AgentConfig, TaskType } from './types'

/**
 * Zod schema for ContinuousImprovementConfig
 */
const ContinuousImprovementConfigSchema = z.object({
  sleepTimeOnNoTasks: z.number().int().positive().default(60000),
  sleepTimeBetweenTasks: z.number().int().nonnegative().default(5000),
  maxCycles: z.number().int().nonnegative().default(0),
})

/**
 * Zod schema for DiscoveryConfig
 */
const DiscoveryConfigSchema = z.object({
  enabledStrategies: z.array(z.string()).min(1),
  checkChanges: z.boolean().default(true),
})

/**
 * Zod schema for AgentConfig
 */
export const AgentConfigSchema = z.object({
  strategy: z.enum(['goal-directed', 'continuous-improvement']).default('goal-directed'),
  continueOnCompletion: z.boolean().default(false),
  maxIterations: z.number().int().nonnegative().default(0),
  timeout: z.number().int().nonnegative().default(0),
  pauseOnError: z.boolean().default(true),
  workingBranch: z.string().default('main'),
  maxConcurrency: z.number().int().min(1).default(1),
  autoSaveInterval: z.number().int().min(1000).default(30000),
  enableProgress: z.boolean().default(true),
  destructiveOperations: z
    .array(z.custom<TaskType>((value) => typeof value === 'string' && Object.hasOwn(WORKFLOW_MAPPING, value)))
    .default([]),
  workingDir: z.string().optional(),
  continuousImprovement: ContinuousImprovementConfigSchema.default(DEFAULT_AGENT_CONFIG.continuousImprovement),
  discovery: DiscoveryConfigSchema.default(DEFAULT_AGENT_CONFIG.discovery),
  preset: z.string().optional(),
  stateDir: z.string().optional(),
  approval: z.object({
    level: z.enum(['none', 'destructive', 'commits', 'all']).default('destructive'),
    autoApproveSafeTasks: z.boolean().default(true),
    maxAutoApprovalCost: z.number().int().nonnegative().default(5),
  }),
  safety: z.object({
    enabledChecks: z.array(z.string()).default([]),
    blockDestructive: z.boolean().default(true),
    maxFileSize: z.number().int().positive().default(10485760),
  }),
  healthCheck: z
    .object({
      enabled: z.boolean().default(false),
      interval: z.number().int().positive().default(60000),
    })
    .optional(),
})

/**
 * Type guard for AgentConfig
 */
export function isValidAgentConfig(config: unknown): config is AgentConfig {
  try {
    AgentConfigSchema.parse(config)
    return true
  } catch {
    return false
  }
}

/**
 * Validate configuration with Zod
 */
export function validateConfig(config: unknown): AgentConfig {
  try {
    return AgentConfigSchema.parse(normalizeOverrides(config))
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e) => `${e.path.join('.')}: ${e.message}`)
      throw new ConfigValidationError('Configuration validation failed', errors)
    }
    throw error
  }
}

/**
 * Load configuration from CLI options and config file
 */
const approvalOverridesSchema = z.object({
  level: z.enum(['none', 'destructive', 'commits', 'all']).optional(),
  autoApproveSafeTasks: z.boolean().optional(),
  maxAutoApprovalCost: z.number().int().nonnegative().optional(),
})

function normalizeOverrides(input: unknown): Record<string, unknown> {
  const { requireApprovalFor, autoApproveSafeTasks, maxAutoApprovalCost, approval, ...config } = z
    .record(z.string(), z.unknown())
    .parse(input)
  const legacy = approvalOverridesSchema.parse({
    ...(requireApprovalFor !== undefined ? { level: requireApprovalFor } : {}),
    ...(autoApproveSafeTasks !== undefined ? { autoApproveSafeTasks } : {}),
    ...(maxAutoApprovalCost !== undefined ? { maxAutoApprovalCost } : {}),
  })
  if (approval !== undefined || Object.keys(legacy).length > 0) {
    config.approval = { ...legacy, ...(approval === undefined ? {} : approvalOverridesSchema.parse(approval)) }
  }
  return config
}

export async function loadConfig(cliOptions: unknown, configPath?: string): Promise<AgentConfig> {
  const cli = normalizeOverrides(cliOptions)
  const file = normalizeOverrides(configPath ? await loadConfigFromFile(configPath) : {})
  const presetName = z
    .string()
    .optional()
    .parse(cli.preset ?? file.preset)
  let config = DEFAULT_AGENT_CONFIG
  if (presetName) {
    const preset = CONFIG_PRESETS[presetName]
    if (!Object.hasOwn(CONFIG_PRESETS, presetName)) throw new ConfigValidationError(`Unknown agent preset: ${presetName}`, [])
    config = mergeConfig(config, preset)
  }
  return mergeConfig(mergeConfig(config, file), cli)
}

/** Objects merge only at the supported configuration sections; arrays replace. */
export function mergeConfig(base: AgentConfig, override: unknown): AgentConfig {
  return validateConfig(
    deepMerge<Record<string, unknown>>({ ...base }, normalizeOverrides(override), [
      'continuousImprovement',
      'discovery',
      'approval',
      'safety',
      'healthCheck',
    ]),
  )
}

/**
 * Load configuration from file
 */
async function loadConfigFromFile(configPath: string): Promise<unknown> {
  try {
    const fs = await import('node:fs/promises')
    const content = await fs.readFile(configPath, 'utf-8')
    return JSON.parse(content)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {}
    }
    throw error
  }
}
