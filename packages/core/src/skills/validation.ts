import { join, normalize } from 'node:path'
import { SKILL_LIMITS, SUSPICIOUS_PATTERNS } from './constants'
import type { Skill } from './types'
import { SkillValidationError } from './types'

/**
 * Validate a skill's security constraints
 *
 * @throws {SkillValidationError} if validation fails
 */
export function validateSkillSecurity(skill: Skill): void {
  const { MAX_FILE_SIZE, MAX_SKILL_SIZE } = SKILL_LIMITS

  // Check file sizes
  let totalSize = 0

  // Check main content size
  const contentSize = Buffer.byteLength(skill.content, 'utf8')
  if (contentSize > MAX_FILE_SIZE) {
    throw new SkillValidationError(`SKILL.md content exceeds size limit (${contentSize} > ${MAX_FILE_SIZE})`, join(skill.path, 'SKILL.md'))
  }
  totalSize += contentSize

  // Check supporting file sizes
  for (const [filename, content] of skill.files) {
    const fileSize = Buffer.byteLength(content, 'utf8')

    if (fileSize > MAX_FILE_SIZE) {
      throw new SkillValidationError(`File ${filename} exceeds size limit (${fileSize} > ${MAX_FILE_SIZE})`, join(skill.path, filename))
    }

    totalSize += fileSize
  }

  // Check total skill size
  if (totalSize > MAX_SKILL_SIZE) {
    throw new SkillValidationError(`Skill total size exceeds limit (${totalSize} > ${MAX_SKILL_SIZE})`, skill.path)
  }

  // Check for suspicious patterns in all files
  validateContentSecurity(skill.content, skill.path)

  for (const [filename, content] of skill.files) {
    validateContentSecurity(content, join(skill.path, filename))
  }
}

/**
 * Validate content for suspicious patterns
 */
function validateContentSecurity(content: string, path: string): void {
  for (const pattern of SUSPICIOUS_PATTERNS) {
    if (pattern.test(content)) {
      throw new SkillValidationError('Suspicious content detected', path)
    }
  }
}

/**
 * Validate file references in skill content
 *
 * Warns about external references and absolute paths
 */
export function validateSkillReferences(skill: Skill): string[] {
  const warnings: string[] = []

  // Check for external network references
  const externalRefs = skill.content.match(/https?:\/\/[^\s\])]+/g) || []

  if (externalRefs.length > 0 && !skill.metadata.description.toLowerCase().includes('external')) {
    warnings.push(
      `Skill '${skill.metadata.name}' contains external references. Consider adding 'external' to description for transparency.`,
    )
  }

  // Check for absolute paths in file references (markdown links and code)
  // Only look in code blocks and markdown links to avoid false positives
  const codeBlocks = skill.content.match(/```[\s\S]*?```/g) || []

  for (const block of codeBlocks) {
    // Look for absolute paths starting with / but not common exceptions
    const pathsInCode = block.match(/\/[a-zA-Z][\w./-]*/g) || []
    for (const path of pathsInCode) {
      // Skip system paths and common non-filesystem patterns
      if (!path.startsWith('/dev') && !path.startsWith('/proc') && !path.startsWith('/sys') && !path.startsWith('//')) {
        warnings.push(`Skill '${skill.metadata.name}' contains possible absolute path '${path}'. Use relative paths instead.`)
      }
    }
  }

  // Validate that referenced files exist
  const fileRefs = skill.content.match(/\[([^\]]+)\]\(([^)]+)\)/g) || []

  for (const ref of fileRefs) {
    const match = ref.match(/\[([^\]]+)\]\(([^)]+)\)/)
    if (match) {
      const [, , filepath] = match

      // Skip external URLs and anchor links
      if (filepath.startsWith('http://') || filepath.startsWith('https://') || filepath.startsWith('#')) {
        continue
      }

      // Normalize the filepath to handle ./prefix and redundant slashes
      const normalizedPath = normalize(filepath).replace(/^\.?\//, '')

      // Check if referenced file exists
      if (!skill.files.has(normalizedPath)) {
        warnings.push(`Referenced file not found: ${filepath}`)
      }
    }
  }

  return warnings
}

/**
 * Validate a skill's metadata
 */
export function validateSkillMetadata(skill: Skill): string[] {
  const errors: string[] = []

  // Name validation (already validated by Zod, but double-check)
  if (!skill.metadata.name.match(/^[a-z0-9-]+$/)) {
    errors.push(`Invalid name format: ${skill.metadata.name}`)
  }

  if (skill.metadata.name.length > 64) {
    errors.push(`Name too long: ${skill.metadata.name.length} > 64`)
  }

  // Description validation
  if (skill.metadata.description.length > 1024) {
    errors.push(`Description too long: ${skill.metadata.description.length} > 1024`)
  }

  // Check that description is meaningful
  if (skill.metadata.description.length < 20) {
    errors.push(`Description too short: ${skill.metadata.description.length} < 20`)
  }

  return errors
}

/**
 * Get file statistics for a skill
 */
export function getSkillStats(skill: Skill): {
  totalSize: number
  fileCount: number
  largestFile: { name: string; size: number }
} {
  let totalSize = Buffer.byteLength(skill.content, 'utf8')
  let largestFile = { name: 'SKILL.md', size: totalSize }
  let fileCount = 1 // SKILL.md

  for (const [name, content] of skill.files) {
    const size = Buffer.byteLength(content, 'utf8')
    totalSize += size
    fileCount++

    if (size > largestFile.size) {
      largestFile = { name, size }
    }
  }

  return {
    totalSize,
    fileCount,
    largestFile,
  }
}
