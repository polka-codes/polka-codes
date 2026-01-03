/**
 * Shell utility functions for safe command execution
 */

/**
 * Quote a string for safe shell execution
 *
 * Uses single-quote wrapping with proper escaping to handle:
 * - Spaces and special characters
 * - Single quotes within the string (escaped as '\'')
 * - Shell injection attacks
 *
 * Pattern: 'original' becomes 'original'
 * Pattern: it's becomes 'it'\''s'
 *
 * @param str - The string to quote
 * @returns The safely quoted string
 *
 * @example
 * ```ts
 * quoteForShell('filename.txt')           // 'filename.txt'
 * quoteForShell('my file.txt')            // 'my file.txt'
 * quoteForShell("it's great")             // 'it'\''s great'
 * quoteForShell('$(rm -rf)')              // '$(rm -rf)'
 * ```
 */
export function quoteForShell(str: string): string {
  return `'${str.replace(/'/g, "'\\''")}'`
}
