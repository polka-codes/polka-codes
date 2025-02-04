import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { merge } from 'lodash'
import { parse } from 'yaml'
import { ZodError, z } from 'zod'

import { type AgentNameType, allAgents } from '@polka-codes/core'

const agentNameValues = allAgents.map((agent) => agent.name)

// TODO: figure out if there is a better way to do this
const agentNames = z.enum<AgentNameType, [AgentNameType, ...AgentNameType[]]>([agentNameValues[0], ...agentNameValues.slice(1)])
const agentNameOrDefault = z.union([agentNames, z.literal('default')])

const providerModelSchema = z.object({
  provider: z.string().optional(),
  model: z.string().optional(),
})

const agentSchema = providerModelSchema.extend({
  initialContext: z
    .object({
      maxFileCount: z.number().int().positive().optional(),
      excludes: z.array(z.string()).optional(),
    })
    .optional(),
})

export const configSchema = z
  .object({
    providers: z
      .record(
        z.string(),
        z.object({
          apiKey: z.string().optional(),
          defaultModel: z.string().optional(),
        }),
      )
      .optional(),
    defaultProvider: z.string().optional(),
    defaultModel: z.string().optional(),
    maxMessageCount: z.number().int().positive().optional(),
    budget: z.number().positive().optional(),
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
    agents: z.record(agentNameOrDefault, agentSchema).optional(),
    commands: z
      .object({
        default: providerModelSchema.optional(),
      })
      .catchall(providerModelSchema)
      .optional(),
    rules: z.array(z.string()).optional().or(z.string()).optional(),
    excludeFiles: z.array(z.string()).optional(),
  })
  .strict()

export type Config = z.infer<typeof configSchema>

export function getGlobalConfigPath(home = homedir()): string {
  return join(home, '.config', 'polkacodes', 'config.yml')
}

export function loadConfigAtPath(path: string): Config | undefined {
  try {
    return readConfig(path)
  } catch (error) {
    return undefined
  }
}

export const localConfigFileName = '.polkacodes.yml'

const mergeArray = (a: string[] | undefined, b: string[] | undefined): string[] | undefined => {
  if (!a && !b) {
    return undefined
  }
  if (!a) {
    return b
  }
  if (!b) {
    return a
  }
  return [...a, ...b]
}

export function loadConfig(path?: string, cwd: string = process.cwd(), home = homedir()): Config | undefined {
  // Load global config if exists
  const globalConfigPath = getGlobalConfigPath(home)
  let globalConfig: Config | undefined
  if (existsSync(globalConfigPath)) {
    try {
      globalConfig = readConfig(globalConfigPath)
    } catch (error) {
      console.warn(`Error loading global config file: ${globalConfigPath}\n${error}`)
    }
  }

  // Load project config
  let projectConfig: Config | undefined
  if (path) {
    try {
      projectConfig = readConfig(path)
    } catch (error) {
      console.error(`Error loading config file: ${path}\n${error}`)
      throw error
    }
  } else {
    const configPath = join(cwd, localConfigFileName)
    try {
      projectConfig = readConfig(configPath)
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Error in config file: ${path}\n${error}`)
        throw error
      }
    }
  }

  // Merge configs with project config taking precedence
  if (globalConfig && projectConfig) {
    const mergedConfig = merge({}, globalConfig, projectConfig)

    // Merge rules array
    let projectRules = projectConfig.rules ?? []
    if (typeof projectRules === 'string') {
      projectRules = [projectRules]
    }
    let globalRules = globalConfig.rules ?? []
    if (typeof globalRules === 'string') {
      globalRules = [globalRules]
    }
    mergedConfig.rules = mergeArray(globalRules, projectRules)

    // Merge exclude files
    mergedConfig.excludeFiles = mergeArray(globalConfig.excludeFiles, projectConfig.excludeFiles)

    return mergedConfig
  }
  return projectConfig || globalConfig
}

export const readConfig = (path: string): Config => {
  const file = readFileSync(path, 'utf8')
  const config = parse(file)
  return configSchema.parse(config)
}

export const readLocalConfig = (path?: string): Config | undefined => {
  try {
    return readConfig(path ?? localConfigFileName)
  } catch (error) {
    return undefined
  }
}
