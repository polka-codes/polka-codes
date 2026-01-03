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
 * - Uses double-quote wrapping
 * - Only escapes double quotes by doubling them ("")
 * - All other special characters are safe inside double quotes
 * - Note: This is the standard Windows argument quoting pattern
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
 * quoteForShell('file with "quotes"')    // 'file with "quotes"' (Unix) or "file with ""quotes""" (Windows)
 * ```
 */
export function quoteForShell(str: string): string {
  if (isWindows()) {
    // Windows cmd.exe quoting: wrap in double quotes and double internal quotes
    // This is the standard Windows argument quoting pattern
    // All special characters (&, |, <, >, ^, %) are safe inside double quotes
    const escaped = str.replace(/"/g, '""')
    return `"${escaped}"`
  } else {
    // Unix/Linux/macOS use single quotes (most robust)
    return `'${str.replace(/'/g, "'\\''")}'`
  }
}
