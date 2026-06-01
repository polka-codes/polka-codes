export * from './api'
export * from './config-validation'
export * from './errors'
export * from './mcp/errors'

// Only parse command line arguments when running as main module
// This prevents side effects when importing from custom scripts
if (import.meta.main) {
  const { main } = await import('./program.js')
  main()
}
