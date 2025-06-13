/**
 * Returns the directory portion of a path string.
 * Strips trailing slashes, then takes everything up to the last slash.
 */
export function dirname(path: string): string {
  if (path.length === 0) return '.'
  const isRooted = path[0] === '/'
  // Trim trailing slashes (but leave root "/")
  let end = path.length - 1
  while (end > 0 && path[end] === '/') end--
  const idx = path.lastIndexOf('/', end)
  if (idx < 0) {
    return isRooted ? '/' : '.'
  }
  if (isRooted && idx === 0) {
    return '/'
  }
  return path.slice(0, idx)
}

/**
 * Normalizes a path by resolving "." and ".." segments.
 */
function normalize(path: string): string {
  const isAbsolute = path.startsWith('/')
  const segments = path.split('/').filter(Boolean)
  const stack: string[] = []
  for (const seg of segments) {
    if (seg === '.') continue
    if (seg === '..') {
      if (stack.length && stack[stack.length - 1] !== '..') {
        stack.pop()
      } else if (!isAbsolute) {
        stack.push('..')
      }
    } else {
      stack.push(seg)
    }
  }
  let result = stack.join('/')
  if (!result && !isAbsolute) return '.'
  if (result && path.endsWith('/')) result += '/'
  return (isAbsolute ? '/' : '') + result
}

/**
 * Joins all given path segments, then normalizes the result.
 */
export function join(...parts: string[]): string {
  if (parts.length === 0) return '.'
  let combined = ''
  for (const p of parts) {
    if (typeof p !== 'string') {
      throw new TypeError('Arguments to join must be strings')
    }
    if (p) {
      combined = combined ? `${combined}/${p}` : p
    }
  }
  return normalize(combined)
}
