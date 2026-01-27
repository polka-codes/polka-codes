import { z } from 'zod'
import type { MemoryStoreConfig } from '../memory'

/**
 * Memory configuration schema
 * Controls the persistent memory store feature
 */
export const memoryConfigSchema = z
  .object({
    enabled: z.boolean().optional().default(true),
    type: z.enum(['sqlite', 'memory']).optional().default('sqlite'),
    path: z.string().optional().default('~/.config/polkacodes/memory/memory.sqlite'),
  })
  .strict()
  .optional()

export type MemoryConfig = z.infer<typeof memoryConfigSchema> & MemoryStoreConfig

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  type: 'sqlite',
  path: '~/.config/polkacodes/memory/memory.sqlite',
}

/**
 * Resolve home directory in path
 * Supports both Unix (HOME) and Windows (USERPROFILE) environments
 */
export function resolveHomePath(path: string): string {
  if (path.startsWith('~')) {
    const home = process.env.HOME || process.env.USERPROFILE || '.'
    if (home === '.') {
      throw new Error('Cannot resolve home directory: HOME and USERPROFILE environment variables are not set')
    }
    return `${home}${path.slice(1)}`
  }
  return path
}
