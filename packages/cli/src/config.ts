// Generated by polka.codes

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { type Config, configSchema } from '@polka-codes/core'
import { merge } from 'lodash'
import { parse } from 'yaml'
import { ZodError } from 'zod'

export { configSchema, type Config }

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

export function mergeConfigs(configs: Config[]): Config {
  if (configs.length === 0) {
    return {}
  }

  const mergedConfig = configs.reduce((acc, config) => {
    const merged = merge({}, acc, config)

    // Special handling for rules array
    let accRules = acc.rules ?? []
    if (typeof accRules === 'string') {
      accRules = [accRules]
    }
    let configRules = config.rules ?? []
    if (typeof configRules === 'string') {
      configRules = [configRules]
    }
    merged.rules = mergeArray(accRules, configRules)

    // Special handling for excludeFiles array
    merged.excludeFiles = mergeArray(acc.excludeFiles, config.excludeFiles)

    return merged
  })

  return mergedConfig
}

export function loadConfig(paths?: string | string[], cwd: string = process.cwd(), home = homedir()): Config | undefined {
  const configs: Config[] = []

  // Load global config if exists
  const globalConfigPath = getGlobalConfigPath(home)
  if (existsSync(globalConfigPath)) {
    try {
      const globalConfig = readConfig(globalConfigPath)
      configs.push(globalConfig)
    } catch (error) {
      console.warn(`Error loading global config file: ${globalConfigPath}\n${error}`)
    }
  }

  // Load project configs
  if (paths && paths.length > 0) {
    const configPaths = Array.isArray(paths) ? paths : [paths]
    for (const path of configPaths) {
      try {
        const config = readConfig(path)
        configs.push(config)
      } catch (error) {
        console.error(`Error loading config file: ${path}\n${error}`)
        throw error
      }
    }
  } else {
    const configPath = join(cwd, localConfigFileName)
    try {
      const projectConfig = readConfig(configPath)
      configs.push(projectConfig)
    } catch (error) {
      if (error instanceof ZodError) {
        console.error(`Error in config file: ${configPath}\n${error}`)
        throw error
      }
    }
  }

  return configs.length > 0 ? mergeConfigs(configs) : undefined
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
