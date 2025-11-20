import { z } from 'zod'

const providerModelSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
  parameters: z.record(z.string(), z.any()).optional(),
  budget: z.number().positive().optional(),
})

export const ruleSchema = z.union([
  z.string(),
  z.object({ path: z.string() }).strict(),
  z.object({ url: z.string() }).strict(),
  z.object({ repo: z.string(), path: z.string(), tag: z.string().optional() }).strict(),
])

export type ConfigRule = z.infer<typeof ruleSchema>

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
    maxMessageCount: z.number().int().positive().optional(),
    budget: z.number().positive().optional(),
    retryCount: z.number().int().min(0).optional(),
    requestTimeoutSeconds: z.number().int().positive().optional(),
    summaryThreshold: z.number().int().positive().optional(),
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
    commands: z.record(z.string(), providerModelSchema).optional(),
    rules: z.array(ruleSchema).optional().or(z.string()).optional(),
    excludeFiles: z.array(z.string()).optional(),
  })
  .strict()

export type Config = z.infer<typeof configSchema>
