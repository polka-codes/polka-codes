import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { getGlobalConfigPath, localConfigFileName, mergeConfigs, type Config as PolkaConfig, readConfig } from '@polka-codes/cli-shared'
import { ZodError } from 'zod'

export type { PolkaConfig }

export interface ConfigValidationIssue {
  source?: string
  path?: string
  message: string
  code: 'file_not_found' | 'invalid_schema' | 'invalid_yaml'
}

export type ConfigValidationResult =
  | {
      valid: true
      config: PolkaConfig
    }
  | {
      valid: false
      errors: ConfigValidationIssue[]
    }

export interface ValidateConfigOptions {
  cwd?: string
  home?: string
  includeGlobal?: boolean
}

type ConfigSource = {
  path: string
  required: boolean
}

function addConfigSource(sources: ConfigSource[], path: string, required: boolean): void {
  const existingSource = sources.find((source) => source.path === path)
  if (existingSource) {
    existingSource.required = existingSource.required || required
    return
  }

  sources.push({ path, required })
}

function formatIssuePath(path: PropertyKey[]): string | undefined {
  if (path.length === 0) {
    return undefined
  }
  return path.map(String).join('.')
}

function normalizeValidationError(source: string, error: unknown): ConfigValidationIssue[] {
  if (error instanceof ZodError) {
    return error.issues.map((issue) => ({
      source,
      path: formatIssuePath(issue.path),
      message: issue.message,
      code: 'invalid_schema' as const,
    }))
  }

  if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
    return [
      {
        source,
        message: `Config file not found: ${source}`,
        code: 'file_not_found',
      },
    ]
  }

  return [
    {
      source,
      message: error instanceof Error ? error.message : String(error),
      code: 'invalid_yaml',
    },
  ]
}

function getConfigSources(paths: string | string[] | undefined, cwd: string, home: string, includeGlobal: boolean): ConfigSource[] {
  const sources: ConfigSource[] = []

  if (includeGlobal) {
    const globalConfigPath = getGlobalConfigPath(home)
    if (existsSync(globalConfigPath)) {
      addConfigSource(sources, globalConfigPath, false)
    }
  }

  if (paths) {
    const explicitPaths = Array.isArray(paths) ? paths : [paths]
    for (const path of explicitPaths) {
      addConfigSource(sources, resolve(cwd, path), true)
    }
    return sources
  }

  const defaultLocalConfigPath = join(cwd, localConfigFileName)
  if (existsSync(defaultLocalConfigPath)) {
    addConfigSource(sources, defaultLocalConfigPath, false)
  }

  return sources
}

export async function validateConfig(paths?: string | string[], options: ValidateConfigOptions = {}): Promise<ConfigValidationResult> {
  const cwd = options.cwd ?? process.cwd()
  const home = options.home ?? homedir()
  const includeGlobal = options.includeGlobal ?? true
  const configSources = getConfigSources(paths, cwd, home, includeGlobal)

  if (configSources.length === 0) {
    return { valid: true, config: {} }
  }

  const configs: PolkaConfig[] = []
  const errors: ConfigValidationIssue[] = []

  for (const source of configSources) {
    if (!source.required && !existsSync(source.path)) {
      continue
    }

    try {
      configs.push(readConfig(source.path))
    } catch (error) {
      errors.push(...normalizeValidationError(source.path, error))
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return {
    valid: true,
    config: mergeConfigs(configs),
  }
}
