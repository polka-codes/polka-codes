import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { merge } from 'lodash'
import { parse } from 'yaml'
import { ZodError, z } from 'zod'

export const configSchema = z
  .object({
    provider: z.string().optional(),
    apiKey: z.string().optional(),
    modelId: z.string().optional(),
    maxIterations: z.number().int().positive().optional(),
    commands: z.record(z.string(), z.string().or(z.object({ command: z.string(), description: z.string() }))).optional(),
    rules: z.array(z.string()).optional().or(z.string()).optional(),
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
    // mantually merge rules array
    let projectRules = projectConfig.rules ?? []
    if (typeof projectRules === 'string') {
      projectRules = [projectRules]
    }
    let globalRules = globalConfig.rules ?? []
    if (typeof globalRules === 'string') {
      globalRules = [globalRules]
    }
    if (globalRules.length > 0 && projectRules.length > 0) {
      mergedConfig.rules = [...globalRules, ...projectRules]
    }

    return mergedConfig
  }
  return projectConfig || globalConfig
}

const readConfig = (path: string): Config => {
  const file = readFileSync(path, 'utf8')
  const config = parse(file)
  return configSchema.parse(config)
}
