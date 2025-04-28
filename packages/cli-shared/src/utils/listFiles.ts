import { promises as fs } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import ignore, { type Ignore } from 'ignore'

/** Default patterns commonly ignored in projects of various languages. */
const DEFAULT_IGNORES = [
  '__pycache__',
  '.DS_Store',
  '.env',
  '.git',
  '.idea',
  '.svn',
  '.temp',
  '.vscode',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'Thumbs.db',
]

/**
 * Reads a `.gitignore` file in `dirPath` (if it exists) and appends its lines
 * to the `basePatterns`. Returns a new array without mutating the original.
 */
async function extendPatterns(basePatterns: string[], dirPath: string): Promise<string[]> {
  try {
    const gitignorePath = join(dirPath, '.gitignore')
    const content = await fs.readFile(gitignorePath, 'utf8')
    const lines = content.split(/\r?\n/).filter(Boolean)
    return [...basePatterns, ...lines]
  } catch {
    // No .gitignore or unreadable
    return basePatterns
  }
}

/** Creates an `ignore` instance from the given patterns. */
function createIgnore(patterns: string[]): Ignore {
  return ignore().add(patterns)
}

/**
 * Lists files under `dirPath` in BFS order, respecting:
 *   - A default set of ignores
 *   - A root .gitignore under `cwd`
 *   - Any .gitignore files in child directories (merged as we go)
 *
 * Returns `[files, limitReached]`:
 *   - `files` is the array of file paths (relative to `cwd`)
 *   - `limitReached` is `true` if `maxCount` was hit, otherwise `false`
 *   - When truncated, adds markers like `path/to/dir/(files omitted)` for truncated directories
 */
export async function listFiles(
  dirPath: string,
  recursive: boolean,
  maxCount: number,
  cwd: string,
  excludeFiles?: string[],
): Promise<[string[], boolean]> {
  // Merge default ignores with root .gitignore and excludeFiles (if found)
  let rootPatterns = [...DEFAULT_IGNORES, ...(excludeFiles || [])]
  try {
    const rootGitignore = await fs.readFile(join(cwd, '.gitignore'), 'utf8')
    const lines = rootGitignore.split(/\r?\n/).filter(Boolean)
    rootPatterns = [...rootPatterns, ...lines]
  } catch {
    // No .gitignore at root or unreadable; ignore silently
  }

  // Final results (relative to `cwd`) and indicator if we reached the limit
  const results: string[] = []

  // Track directories we've seen to avoid duplicate "(files omitted)" markers
  const processedDirs = new Set<string>()

  // BFS queue
  // Each entry holds the directory path, patterns, and relative path
  const queue: Array<{ path: string; patterns: string[]; relPath: string }> = [
    {
      path: resolve(dirPath),
      patterns: rootPatterns,
      relPath: relative(cwd, resolve(dirPath)).replace(/\\/g, '/') || '.',
    },
  ]

  // Perform BFS until queue is empty or maxCount is reached
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: checked above
    const { path: currentPath, patterns: parentPatterns, relPath: currentRelPath } = queue.shift()!

    // Mark this directory as processed
    processedDirs.add(currentRelPath)

    // Merge parent's patterns with local .gitignore
    const mergedPatterns = await extendPatterns(parentPatterns, currentPath)
    const folderIg = createIgnore(mergedPatterns)

    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name)) // Sort entries for consistent order

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      // Convert full path to something relative to `cwd`
      const relPath = relative(cwd, fullPath).replace(/\\/g, '/')

      if (folderIg.ignores(relPath)) {
        continue // Skip ignored entries
      }

      if (entry.isDirectory()) {
        if (recursive) {
          queue.push({
            path: fullPath,
            patterns: mergedPatterns,
            relPath,
          })
        }
      } else {
        results.push(relPath)
        if (results.length >= maxCount) {
          // We've hit the limit, add "(files omitted)" markers for directories
          // still in the queue and the current directory if we haven't processed all its files

          // First, check if there are remaining files in the current directory
          const remainingEntries = entries.slice(entries.indexOf(entry) + 1)
          const hasRemainingFiles = remainingEntries.some(
            (e) => !e.isDirectory() && !folderIg.ignores(relative(cwd, join(currentPath, e.name)).replace(/\\/g, '/')),
          )

          if (hasRemainingFiles) {
            const marker = `${currentRelPath}/(files omitted)`
            results.push(marker)
          }

          // Then add markers for all directories still in the queue
          for (const queueItem of queue) {
            // Only add markers for directories we haven't processed yet
            if (!processedDirs.has(queueItem.relPath)) {
              const marker = `${queueItem.relPath}/(files omitted)`
              results.push(marker)
              processedDirs.add(queueItem.relPath) // Mark as processed to avoid duplicates
            }
          }

          results.sort()
          return [results, true]
        }
      }
    }
  }

  results.sort()
  // If we exhaust the BFS queue, we did not reach maxCount
  return [results, false]
}
