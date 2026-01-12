/**
 * Constants for agent planner
 * Extracted to improve code readability and maintainability
 */

export const PLANNER_CONSTANTS = {
  /** Maximum number of dependencies before a task is flagged as risky */
  MAX_DEPENDENCIES: 5,

  /** Time threshold (in minutes) for classifying a task as "long-running" */
  LONG_TASK_MINUTES: 120,

  /** File count threshold for classifying a task as "file-heavy" */
  FILE_HEAVY_THRESHOLD: 10,

  /** Priority value that indicates a critical task */
  CRITICAL_PRIORITY: 1000,
} as const
