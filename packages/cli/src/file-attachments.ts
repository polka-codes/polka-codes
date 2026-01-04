import type { JsonFilePart, JsonImagePart, JsonUserContent } from '@polka-codes/core'

// Re-export for convenience
export type { JsonFilePart, JsonImagePart }

/**
 * Attach files to user message content for AI workflows
 *
 * @param content - The existing user content (string or array)
 * @param files - Optional array of files and images to attach
 * @returns The content array with files attached
 *
 * @example
 * ```ts
 * const content: JsonUserContent = 'Review these files'
 * const files = [
 *   { type: 'file', mediaType: 'text/plain', filename: 'test.ts', data: { type: 'base64', value: '...' } },
 *   { type: 'image', mediaType: 'image/png', image: { type: 'base64', value: '...' } }
 * ]
 * const withFiles = attachFilesToContent(content, files)
 * ```
 */
export function attachFilesToContent(content: JsonUserContent, files?: (JsonFilePart | JsonImagePart)[]): JsonUserContent {
  if (!files || files.length === 0) {
    return content
  }

  // Convert string content to array
  const baseContent: Array<JsonFilePart | JsonImagePart | { type: 'text'; text: string }> =
    typeof content === 'string' ? [{ type: 'text', text: content }] : content

  // Combine existing content with new files
  return [...baseContent, ...files]
}

/**
 * Create a user message with optional file attachments
 *
 * @param text - The text message content
 * @param files - Optional array of files and images to attach
 * @returns A complete user message with content array
 *
 * @example
 * ```ts
 * const message = createUserMessageWithFiles('Review this code', [
 *   { type: 'file', mediaType: 'text/plain', filename: 'code.ts', data: '...' }
 * ])
 * ```
 */
export function createUserMessageWithFiles(
  text: string,
  files?: (JsonFilePart | JsonImagePart)[],
): { role: 'user'; content: JsonUserContent } {
  const content: JsonUserContent = [{ type: 'text', text }]
  return {
    role: 'user',
    content: attachFilesToContent(content, files),
  }
}

/**
 * Filter files by media type
 */
export function filterFilesByMediaType(
  files: (JsonFilePart | JsonImagePart)[],
  mediaType: string | RegExp,
): (JsonFilePart | JsonImagePart)[] {
  const regex = typeof mediaType === 'string' ? new RegExp(`^${mediaType}`) : mediaType
  return files.filter((file) => file.mediaType !== undefined && regex.test(file.mediaType))
}

/**
 * Get only image files from mixed file array
 */
export function getImages(files: (JsonFilePart | JsonImagePart)[]): JsonImagePart[] {
  return files.filter((file): file is JsonImagePart => file.type === 'image')
}

/**
 * Get only document files from mixed file array
 */
export function getDocuments(files: (JsonFilePart | JsonImagePart)[]): JsonFilePart[] {
  return files.filter((file): file is JsonFilePart => file.type === 'file')
}

/**
 * Count total files by type
 */
export function countFilesByType(files: (JsonFilePart | JsonImagePart)[]): {
  images: number
  documents: number
  total: number
} {
  return {
    images: getImages(files).length,
    documents: getDocuments(files).length,
    total: files.length,
  }
}
