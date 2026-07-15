import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export * from './api'
export * from './config-validation'
export * from './errors'
export * from './mcp/errors'

function isMainModule(): boolean {
  const entrypoint = process.argv[1]
  return Boolean(entrypoint) && fileURLToPath(import.meta.url) === resolve(entrypoint)
}

// Only parse command line arguments when running as main module
// This prevents side effects when importing from custom scripts
if (isMainModule()) {
  const { main } = await import('./program.js')
  main()
}
