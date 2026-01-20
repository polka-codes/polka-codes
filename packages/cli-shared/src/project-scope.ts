import { existsSync } from 'node:fs'
import { dirname, normalize, resolve, sep } from 'node:path'

/**
 * Detect project scope from current working directory
 *
 * This function determines whether we're in a project directory or global scope.
 * It looks for common project markers (.git, package.json, etc.) to identify the project root.
 *
 * @param cwd - Current working directory
 * @returns A scope string ('global' or 'project:/absolute/path')
 */
export function detectProjectScope(cwd: string): string {
  const projectPath = findProjectRoot(cwd)

  if (!projectPath) {
    return 'global'
  }

  const normalizedPath = normalizePath(projectPath)
  return `project:${normalizedPath}`
}

/**
 * Find the project root directory by looking for common project markers
 */
function findProjectRoot(dir: string): string | null {
  // Check if we're still in a valid directory
  if (!existsSync(dir)) {
    return null
  }

  // Common project markers in priority order
  const primaryMarkers = ['.git', 'package.json']
  const secondaryMarkers = [
    'Cargo.toml', // Rust
    'go.mod', // Go
    'pyproject.toml', // Python
    'requirements.txt', // Python
    'setup.py', // Python
    'Gemfile', // Ruby
    'pom.xml', // Java Maven
    'build.gradle', // Java Gradle
  ]

  // Check primary markers first
  for (const marker of primaryMarkers) {
    if (existsSync(resolve(dir, marker))) {
      return dir
    }
  }

  // Check secondary markers
  for (const marker of secondaryMarkers) {
    if (existsSync(resolve(dir, marker))) {
      return dir
    }
  }

  // Check if we've reached the filesystem root
  const parent = dirname(dir)
  if (parent === dir) {
    return null
  }

  // Recurse up the directory tree
  return findProjectRoot(parent)
}

/**
 * Normalize path to use forward slashes for consistency across platforms
 */
function normalizePath(path: string): string {
  // Normalize path separators to forward slashes for consistency
  return normalize(path).split(sep).join('/')
}
