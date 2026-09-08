import { promises as fs } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
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

type IgnoreLayer = { base: string; matcher: Ignore }

async function extendLayers(layers: IgnoreLayer[], directory: string): Promise<IgnoreLayer[]> {
  try {
    const content = await fs.readFile(join(directory, '.gitignore'), 'utf8')
    return [...layers, { base: directory, matcher: ignore().add(content) }]
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return layers
    throw error
  }
}

function isIgnored(path: string, directory: boolean, layers: IgnoreLayer[]): boolean {
  let ignored = false
  for (const layer of layers) {
    const result = layer.matcher.test(relative(layer.base, path).split(sep).join('/') + (directory ? '/' : ''))
    if (result.ignored) ignored = true
    else if (result.unignored) ignored = false
  }
  return ignored
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
  includeIgnored?: boolean,
): Promise<[string[], boolean]> {
  const root = resolve(cwd)
  const start = resolve(dirPath)
  let layers: IgnoreLayer[] = [{ base: root, matcher: ignore().add([...(excludeFiles ?? []), ...(includeIgnored ? [] : DEFAULT_IGNORES)]) }]
  let ancestor = root
  for (const part of relative(root, start).split(sep).filter(Boolean)) {
    if (!includeIgnored) layers = await extendLayers(layers, ancestor)
    ancestor = join(ancestor, part)
    if (isIgnored(ancestor, true, layers)) return [[], false]
  }

  // Final results (relative to `cwd`) and indicator if we reached the limit
  const results: string[] = []

  // Track directories we've seen to avoid duplicate "(files omitted)" markers
  const processedDirs = new Set<string>()

  // BFS queue
  // Each entry holds the directory path, patterns, and relative path
  const queue: Array<{ path: string; layers: IgnoreLayer[]; relPath: string }> = [
    {
      path: start,
      layers,
      relPath: relative(cwd, resolve(dirPath)).split(sep).join('/') || '.',
    },
  ]

  // Perform BFS until queue is empty or maxCount is reached
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: checked above
    const { path: currentPath, layers: parentLayers, relPath: currentRelPath } = queue.shift()!

    // Mark this directory as processed
    processedDirs.add(currentRelPath)

    // Merge parent's patterns with local .gitignore
    const currentLayers = includeIgnored ? parentLayers : await extendLayers(parentLayers, currentPath)

    const entries = await fs.readdir(currentPath, { withFileTypes: true })
    entries.sort((a, b) => a.name.localeCompare(b.name)) // Sort entries for consistent order

    for (const entry of entries) {
      const fullPath = join(currentPath, entry.name)
      // Convert full path to something relative to `cwd`
      const relPath = relative(cwd, fullPath).split(sep).join('/')

      if (isIgnored(fullPath, entry.isDirectory(), currentLayers)) {
        continue // Skip ignored entries
      }

      if (entry.isDirectory()) {
        if (recursive) {
          queue.push({
            path: fullPath,
            layers: currentLayers,
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
            (e) => !e.isDirectory() && !isIgnored(join(currentPath, e.name), false, currentLayers),
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
