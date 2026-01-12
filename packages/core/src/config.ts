import { z } from 'zod'

export const ruleSchema = z.union([
  z.string(),
  z.object({ path: z.string() }).strict(),
  z.object({ url: z.string() }).strict(),
  z
    .object({
      repo: z.string(),
      path: z.string(),
      tag: z.string().optional(),
      commit: z.string().optional(),
      branch: z.string().optional(),
    })
    .strict(),
])

export const providerConfigSchema = z.object({
  apiKey: z.string().optional(),
  defaultModel: z.string().optional(),
  defaultParameters: z.record(z.string(), z.any()).optional(),
  location: z.string().optional(),
  project: z.string().optional(),
  keyFile: z.string().optional(),
  baseUrl: z.string().optional(),
  name: z.string().optional(), // For OpenAI-compatible providers
})

export const providerModelSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  budget: z.number().positive().optional(),
  rules: z.array(ruleSchema).optional().or(z.string()).optional(),
})

export type ConfigRule = z.infer<typeof ruleSchema>
export type ProviderConfig = z.infer<typeof providerConfigSchema>

// Script configuration schema
// Supports multiple formats for backward compatibility and new features
export const scriptSchema = z.union([
  // Type 1: Simple shell command (backward compatible)
  z.string(),
  // Type 2: Object with command and description (backward compatible)
  z
    .object({
      command: z.string(),
      description: z.string(),
    })
    .strict(),
  // Type 3: Reference to dynamic workflow YAML
  z
    .object({
      workflow: z.string(), // Path to .yml workflow file
      description: z.string().optional(),
      input: z.record(z.string(), z.any()).optional(), // Default workflow input
    })
    .strict(),
  // Type 4: TypeScript script file (NEW)
  z
    .object({
      script: z.string(), // Path to .ts file
      description: z.string().optional(),
      permissions: z
        .object({
          fs: z.enum(['read', 'write', 'none']).optional(),
          network: z.boolean().optional(),
          subprocess: z.boolean().optional(),
        })
        .optional(),
      timeout: z.number().int().positive().max(3600000).optional(), // Max 1 hour in milliseconds
      memory: z.number().int().positive().min(64).max(8192).optional(), // 64MB-8GB in MB
    })
    .strict(),
])

export type ScriptConfig = z.infer<typeof scriptSchema>

// MCP server configuration schema
export const mcpServerConfigSchema = z
  .object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string(), z.string()).optional(),
    tools: z
      .record(
        z.string(),
        z.boolean().or(
          z
            .object({
              provider: z.string().optional(),
              model: z.string().optional(),
              parameters: z.record(z.string(), z.unknown()).optional(),
            })
            .strict(),
        ),
      )
      .optional(),
  })
  .strict()

export type McpServerConfig = z.infer<typeof mcpServerConfigSchema>

// Agent configuration schema
const agentContinuousImprovementSchema = z
  .object({
    sleepTimeOnNoTasks: z.number().int().optional(),
    sleepTimeBetweenTasks: z.number().int().optional(),
    maxCycles: z.number().int().optional(),
  })
  .strict()
  .optional()

const agentDiscoverySchema = z
  .object({
    enabledStrategies: z.array(z.string()).optional(),
    cacheTime: z.number().int().optional(),
    checkChanges: z.boolean().optional(),
  })
  .strict()
  .optional()

const agentSafetySchema = z
  .object({
    enabledChecks: z.array(z.string()).optional(),
    blockDestructive: z.boolean().optional(),
    maxFileSize: z.number().int().optional(),
  })
  .strict()
  .optional()

const agentHealthCheckSchema = z
  .object({
    enabled: z.boolean().optional(),
    interval: z.number().int().optional(),
  })
  .strict()
  .optional()

const agentApprovalSchema = z
  .object({
    level: z.enum(['none', 'destructive', 'commits', 'all']).optional(),
    autoApproveSafeTasks: z.boolean().optional(),
    maxAutoApprovalCost: z.number().optional(),
  })
  .strict()
  .optional()

const agentSchema = z
  .object({
    preset: z.string().optional(),
    strategy: z.enum(['goal-directed', 'continuous-improvement']).optional(),
    continueOnCompletion: z.boolean().optional(),
    maxIterations: z.number().int().optional(),
    timeout: z.number().int().optional(),
    requireApprovalFor: z.enum(['none', 'destructive', 'commits', 'all']).optional(),
    autoApproveSafeTasks: z.boolean().optional(),
    maxAutoApprovalCost: z.number().optional(),
    pauseOnError: z.boolean().optional(),
    workingBranch: z.string().optional(),
    destructiveOperations: z.array(z.string()).optional(),
    maxConcurrency: z.number().int().optional(),
    autoSaveInterval: z.number().int().optional(),
    workingDir: z.string().optional(),
    continuousImprovement: agentContinuousImprovementSchema,
    discovery: agentDiscoverySchema,
    safety: agentSafetySchema,
    healthCheck: agentHealthCheckSchema,
    approval: agentApprovalSchema,
  })
  .strict()
  .optional()

export const configSchema = z
  .object({
    prices: z
      .record(
        z.string(), // provider
        z.record(
          z.string(), // model
          z.object({
            inputPrice: z.number().optional(),
            outputPrice: z.number().optional(),
            cacheWritesPrice: z.number().optional(),
            cacheReadsPrice: z.number().optional(),
          }),
        ),
      )
      .optional(),
    providers: z.record(z.string(), providerConfigSchema).optional(),
    defaultProvider: z.string().optional(),
    defaultModel: z.string().optional(),
    defaultParameters: z.record(z.string(), z.any()).optional(),
    maxMessageCount: z.number().int().positive().optional(),
    budget: z.number().positive().optional(),
    retryCount: z.number().int().min(0).optional(),
    requestTimeoutSeconds: z.number().int().positive().optional(),
    summaryThreshold: z.number().int().positive().optional(),
    scripts: z.record(z.string(), scriptSchema).optional(),
    commands: z.record(z.string(), providerModelSchema).optional(),
    tools: z
      .object({
        search: providerModelSchema.or(z.boolean()).optional(),
      })
      .optional(),
    mcpServers: z.record(z.string(), mcpServerConfigSchema).optional(),
    rules: z.array(ruleSchema).optional().or(z.string()).optional(),
    excludeFiles: z.array(z.string()).optional(),
    agent: agentSchema,
  })
  .strict()
  .nullish()

export type Config = NonNullable<z.infer<typeof configSchema>>
