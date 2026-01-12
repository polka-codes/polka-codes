/**
 * Constants for command-line commands
 * Extracted to improve code readability and maintainability
 */

export const COMMAND_CONSTANTS = {
  /** Default timeout (in milliseconds) for reading from stdin */
  DEFAULT_STDIN_TIMEOUT_MS: 1000,

  /** Default number of context lines to show around search matches */
  DEFAULT_CONTEXT_LINES: 5,

  /** Threshold for summarizing output (in characters) */
  SUMMARY_THRESHOLD: 5000,
} as const
