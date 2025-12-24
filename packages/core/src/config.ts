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
  z.object({
    command: z.string(),
    description: z.string(),
  }),
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
      timeout: z.number().optional(), // Execution timeout in milliseconds
      memory: z.number().optional(), // Memory limit in MB
    })
    .strict(),
])

export type ScriptConfig = z.infer<typeof scriptSchema>

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
    rules: z.array(ruleSchema).optional().or(z.string()).optional(),
    excludeFiles: z.array(z.string()).optional(),
  })
  .strict()
  .nullish()

export type Config = NonNullable<z.infer<typeof configSchema>>
