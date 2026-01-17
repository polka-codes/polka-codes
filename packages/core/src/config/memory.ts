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
    path: z.string().optional().default('~/.config/polka-codes/memory.sqlite'),
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
  path: '~/.config/polka-codes/memory.sqlite',
}

/**
 * Resolve home directory in path
 */
export function resolveHomePath(path: string): string {
  if (path.startsWith('~')) {
    return `${process.env.HOME}${path.slice(1)}`
  }
  return path
}
