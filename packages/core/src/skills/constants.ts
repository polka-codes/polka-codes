/**
 * Constants for Agent Skills system
 */

export const SKILL_LIMITS = {
  MAX_FILE_SIZE: 1024 * 1024, // 1MB per file
  MAX_SKILL_SIZE: 10 * 1024 * 1024, // 10MB total
  MAX_DEPTH: 10, // Maximum directory recursion depth
  MAX_FILES: 500, // Maximum files to load per skill
  MIN_DESCRIPTION_LENGTH: 20, // Minimum description length
  MAX_DESCRIPTION_LENGTH: 1024, // Maximum description length
  MAX_NAME_LENGTH: 64, // Maximum skill name length
} as const

export const IGNORED_DIRECTORIES = [
  '.git',
  'node_modules',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  '.cache',
  '.vscode',
  '.idea',
  'tmp',
  'temp',
  '.DS_Store',
] as const

/**
 * Security validation patterns to detect suspicious content
 *
 * Note: Patterns use case-insensitive flag (/i) but NOT global (/g) to avoid
 * stateful lastIndex issues when RegExp.test() is called multiple times.
 */
export const SUSPICIOUS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/i, // Script tags (with dotAll for multiline)
  /javascript:/i, // JavaScript URLs
  /on\w+\s*=/i, // Event handlers (onclick, onload, etc.)
] as const

export const SKILL_ERROR_MESSAGES = {
  MISSING_FRONTMATTER: 'SKILL.md must begin with YAML frontmatter enclosed in ---',
  FRONTMATTER_INVALID: 'Invalid frontmatter: {message}',
  SKILL_NOT_FOUND: 'Skill not found',
  CONTEXT_NOT_INITIALIZED: 'Skill context not initialized',
} as const

export const SOURCE_ICONS = {
  project: '📁',
  personal: '🏠',
  plugin: '🔌',
} as const

export type SkillSource = keyof typeof SOURCE_ICONS
