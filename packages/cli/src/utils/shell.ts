/**
 * Shell utility functions for safe command execution
 */

/**
 * Detect if running on Windows
 */
function isWindows(): boolean {
  return process.platform === 'win32'
}

/**
 * Quote a string for safe shell execution (cross-platform)
 *
 * On Unix/Linux/macOS:
 * - Uses single-quote wrapping with proper escaping
 * - Handles spaces, special characters, and single quotes
 * - Pattern: 'original' becomes 'original'
 * - Pattern: it's becomes 'it'\''s'
 *
 * On Windows (cmd.exe):
 * - Uses double-quote wrapping with proper escaping
 * - Escapes special characters: ", %, &, |, <, >, ^
 * - Note: cmd.exe quoting is less robust than POSIX shells
 *
 * This function is primarily used for git commands, which work well with
 * this quoting strategy on both platforms.
 *
 * @param str - The string to quote
 * @returns The safely quoted string for the current platform
 *
 * @example
 * ```ts
 * quoteForShell('filename.txt')           // 'filename.txt' (Unix) or "filename.txt" (Windows)
 * quoteForShell('my file.txt')            // 'my file.txt' (Unix) or "my file.txt" (Windows)
 * quoteForShell("it's great")             // 'it'\''s great' (Unix) or "it's great" (Windows)
 * quoteForShell('$(rm -rf)')              // '$(rm -rf)' (Unix) or "$(rm -rf)" (Windows)
 * ```
 */
export function quoteForShell(str: string): string {
  if (isWindows()) {
    // Windows cmd.exe uses double quotes
    // Escape special characters: ", %, &, |, <, >, ^
    // Note: This is not exhaustive - cmd.exe has complex escaping rules
    const escaped = str
      .replace(/"/g, '""')
      .replace(/%/g, '"%"')
      .replace(/&/g, '"&"')
      .replace(/\|/g, '"|"')
      .replace(/</g, '"<"')
      .replace(/>/g, '">"')
      .replace(/\^/g, '"^"')
    return `"${escaped}"`
  } else {
    // Unix/Linux/macOS use single quotes (most robust)
    return `'${str.replace(/'/g, "'\\''")}'`
  }
}
