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

  // Check for .git directory (most common project marker)
  if (existsSync(resolve(dir, '.git'))) {
    return dir
  }

  // Check for package.json
  if (existsSync(resolve(dir, 'package.json'))) {
    return dir
  }

  // Check for other project markers
  const projectMarkers = [
    'Cargo.toml', // Rust
    'go.mod', // Go
    'pyproject.toml', // Python
    'requirements.txt', // Python
    'setup.py', // Python
    'Gemfile', // Ruby
    'pom.xml', // Java Maven
    'build.gradle', // Java Gradle
    'pom.xml', // Java
    '*.csproj', // C#
  ]

  for (const marker of projectMarkers) {
    const markerPath = resolve(dir, marker)
    // For glob patterns like *.csproj, we need to check if any matching file exists
    if (marker.includes('*')) {
      // For simplicity, skip glob patterns in this implementation
      // In a more robust version, you could use glob to check
      continue
    }
    if (existsSync(markerPath)) {
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
