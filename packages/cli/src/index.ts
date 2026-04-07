export * from './api'
export { main } from './program.js'

import { main } from './program.js'

// Only parse command line arguments when running as main module
// This prevents side effects when importing from custom scripts
if (import.meta.main) {
  main()
}
