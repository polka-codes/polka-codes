/**
 * File search utility using ripgrep for performant code search
 * Generated by polka.codes
 */
import { spawn } from 'node:child_process'
import { rgPath } from '@vscode/ripgrep'

/**
 * Performs a regex search across files using ripgrep.
 * Respects .gitignore and provides context-rich results.
 *
 * @param path - Directory to search in
 * @param regex - Regular expression pattern to search for
 * @param filePattern - Optional glob pattern to filter files
 * @param cwd - Working directory for relative paths
 * @param excludeFiles - Additional patterns to exclude
 * @returns Array of search results with context
 */
export async function searchFiles(
  path: string,
  regex: string,
  filePattern: string,
  cwd: string,
  excludeFiles?: string[],
): Promise<string[]> {
  // Build ripgrep arguments
  const args = [
    '--line-number', // Show line numbers
    '--context=5', // Show 2 lines before and after matches
    '--color=never', // No color codes in output
    '--with-filename', // Show filenames
    '--smart-case', // Smart case sensitivity
  ]

  // Add file pattern filter if specified
  if (filePattern && filePattern !== '*') {
    args.push('--glob', filePattern)
  }

  // Add custom ignore patterns
  if (excludeFiles) {
    for (const pattern of excludeFiles) {
      args.push('--ignore-file', pattern)
    }
  }

  // Add the search pattern and path
  args.push(regex, path)

  return new Promise((resolve, reject) => {
    const results: string[] = []

    const rg = spawn(rgPath, args, {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    rg.stdout.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean)
      results.push(...lines)
    })

    rg.stderr.on('data', (data) => {
      // Only log actual errors, not warnings
      const err = data.toString()
      if (!err.startsWith('WARNING:')) {
        console.warn(err)
      }
    })

    rg.on('error', (error) => {
      reject(new Error(`Failed to execute ripgrep: ${error.message}`))
    })

    rg.on('close', (code) => {
      if (code !== 0 && code !== 1) {
        // code 1 means no matches found, which is not an error
        reject(new Error(`Ripgrep process exited with code ${code}`))
        return
      }
      resolve(results)
    })
  })
}
