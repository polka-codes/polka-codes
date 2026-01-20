import { deepMerge } from '@polka-codes/core'
import { z } from 'zod'
import { CONFIG_PRESETS, DEFAULT_AGENT_CONFIG } from './constants'
import { ConfigValidationError } from './errors'
import type { AgentConfig } from './types'

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
  cacheTime: z.number().int().positive().default(300000),
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
  requireApprovalFor: z.enum(['none', 'destructive', 'commits', 'all']).default('destructive'),
  pauseOnError: z.boolean().default(true),
  workingBranch: z.string().default('main'),
  maxConcurrency: z.number().int().min(1).default(1),
  autoSaveInterval: z.number().int().min(1000).default(30000),
  enableProgress: z.boolean().default(true),
  destructiveOperations: z.array(z.string()).default([]),
  maxAutoApprovalCost: z.number().int().nonnegative().default(5),
  autoApproveSafeTasks: z.boolean().default(true),
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
    return AgentConfigSchema.parse(config) as AgentConfig
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors = error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`)
      throw new ConfigValidationError('Configuration validation failed', errors)
    }
    throw error
  }
}

/**
 * Load configuration from CLI options and config file
 */
export async function loadConfig(cliOptions: Partial<AgentConfig>, configPath?: string): Promise<AgentConfig> {
  // Start with defaults
  let config: AgentConfig = { ...DEFAULT_AGENT_CONFIG }

  // Apply preset if specified
  if (cliOptions.preset && CONFIG_PRESETS[cliOptions.preset]) {
    config = mergeConfig(config, CONFIG_PRESETS[cliOptions.preset])
    config.preset = cliOptions.preset
  }

  // Load from file if exists
  if (configPath) {
    const fileConfig = await loadConfigFromFile(configPath)
    config = mergeConfig(config, fileConfig)
  }

  // Apply CLI options (highest priority)
  config = mergeConfig(config, cliOptions)

  // Validate configuration
  return validateConfig(config)
}

/**
 * Merge two configurations (second overrides first)
 *
 * Uses deepMerge utility with explicit path specification for nested objects.
 * This makes it clear which fields get deep merged vs shallow merge.
 */
export function mergeConfig(base: AgentConfig, override: Partial<AgentConfig>): AgentConfig {
  return deepMerge(base, override, [
    'continuousImprovement', // Explicit: these get deep merged
    'discovery',
    'approval',
    'safety',
  ])
  // Other fields use shallow merge (spread) - explicit and clear!
}

/**
 * Load configuration from file
 */
async function loadConfigFromFile(configPath: string): Promise<Partial<AgentConfig>> {
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
