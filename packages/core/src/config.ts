import { z } from 'zod'

const toolFormatSchema = z.enum(['native', 'polka-codes']).optional()

const providerModelSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  toolFormat: toolFormatSchema,
})

const agentSchema = providerModelSchema.extend({
  initialContext: z
    .object({
      maxFileCount: z.number().int().positive().optional(),
      excludes: z.array(z.string()).optional(),
    })
    .optional(),
  retryCount: z.number().int().min(0).optional(),
  requestTimeoutSeconds: z.number().int().positive().optional(),
})

export const configSchema = z
  .object({
    agent: z.string().optional(),
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
    providers: z
      .record(
        z.string(),
        z.object({
          apiKey: z.string().optional(),
          defaultModel: z.string().optional(),
          defaultParameters: z.record(z.string(), z.any()).optional(),
          location: z.string().optional(),
          project: z.string().optional(),
          keyFile: z.string().optional(),
        }),
      )
      .optional(),
    defaultProvider: z.string().optional(),
    defaultModel: z.string().optional(),
    defaultParameters: z.record(z.string(), z.any()).optional(),
    toolFormat: toolFormatSchema,
    maxMessageCount: z.number().int().positive().optional(),
    budget: z.number().positive().optional(),
    retryCount: z.number().int().min(0).optional(),
    requestTimeoutSeconds: z.number().int().positive().optional(),
    scripts: z
      .record(
        z.string(),
        z.string().or(
          z.object({
            command: z.string(),
            description: z.string(),
          }),
        ),
      )
      .optional(),
    agents: z.record(z.string(), agentSchema).optional(),
    commands: z
      .object({
        default: providerModelSchema.optional(),
      })
      .catchall(providerModelSchema)
      .optional(),
    rules: z.array(z.string()).optional().or(z.string()).optional(),
    excludeFiles: z.array(z.string()).optional(),
    policies: z.array(z.string()).optional(),
  })
  .strict()

export type Config = z.infer<typeof configSchema>

export enum Policies {
  TruncateContext = 'truncatecontext',
  EnableCache = 'enablecache',
}

export type ToolFormat = 'native' | 'polka-codes'
