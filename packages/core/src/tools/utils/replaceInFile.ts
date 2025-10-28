/* Example diff block format:
  <<<<<<< SEARCH
  // original text
  =======
  // replacement text
  >>>>>>> REPLACE
*/

export type ReplaceResult = {
  content: string
  status: 'no_diff_applied' | 'some_diff_applied' | 'all_diff_applied'
  appliedCount: number
  totalCount: number
}

export const replaceInFile = (fileContent: string, diff: string): ReplaceResult => {
  // Regex to match blocks of the form:
  // <<<<<<< SEARCH
  // (some lines)
  // =======
  // (some lines)
  // >>>>>>> REPLACE
  const blockPattern = /^\s*<<<<<+\s*SEARCH>?\s*\r?\n([\s\S]*?)\r?\n=======[ \t]*\r?\n([\s\S]*?)\r?\n?>>>>>+\s*REPLACE\s*$/gm

  // Parse diff blocks
  const blocks: { search: string; replace: string }[] = []
  for (let match = blockPattern.exec(diff); match !== null; match = blockPattern.exec(diff)) {
    blocks.push({ search: match[1], replace: match[2] })
  }
  if (blocks.length === 0) {
    throw new Error('No valid diff blocks found.')
  }

  // Helper: try to find the search text in fileContent with progressive relaxation
  const findAndReplace = (content: string, search: string, replace: string): string | null => {
    // 1) Direct exact match
    let index = content.indexOf(search)
    if (index !== -1) {
      return content.slice(0, index) + replace + content.slice(index + search.length)
    }

    // 2) Trim leading/ending whitespace in search and content
    const trimmedSearch = search.trim()
    const trimmedContent = content.trim()
    const offset = content.indexOf(trimmedContent) // to restore original indexing if found
    index = trimmedContent.indexOf(trimmedSearch)
    if (index !== -1) {
      // compute correct absolute index in the original content
      const absoluteIndex = offset + index
      return content.slice(0, absoluteIndex) + replace + content.slice(absoluteIndex + trimmedSearch.length)
    }

    // 3) Whitespace-agnostic match:
    //    Replace all consecutive whitespace in search and content with a single marker
    //    to see if there's a match ignoring whitespace diffs
    const normalizedSearch = trimmedSearch.replace(/\s+/g, ' ')
    const normalizedContent = trimmedContent.replace(/\s+/g, ' ')
    index = normalizedContent.indexOf(normalizedSearch)
    if (index !== -1) {
      // Find actual location in the original content. We do a rough approach here:
      // We know the substring's "normalized" start is at 'index' in normalizedContent.
      // A simple way is to walk through the original trimmedContent to find where that occurs.
      // For brevity, we'll do a naive re-scan and hope it's correct in typical cases.
      let runningIndex = 0
      let actualPos = offset
      for (const segment of trimmedSearch.replace(/\s+/g, ' ').split(' ')) {
        const segIndex = content.indexOf(segment, actualPos)
        if (segIndex === -1) {
          break // mismatch, won't happen if we truly found it
        }
        if (runningIndex === 0) {
          // First segment helps define the start
          actualPos = segIndex
        } else {
          // Move just after the segment to keep scanning
          actualPos = segIndex + segment.length
        }
        runningIndex++
      }

      // By the time we’re done, actualPos should be the end of the matched substring.
      // We do a length calc for the final replacement index:
      // but we need the total length of trimmedSearch minus whitespace. We'll reconstruct:
      const strippedSearch = trimmedSearch.replace(/\s+/g, '')
      const endPos = actualPos // The end of the final segment
      const startPos = endPos - strippedSearch.length

      return content.slice(0, startPos) + replace + content.slice(endPos)
    }

    return null
  }

  let updatedFile = fileContent
  let appliedCount = 0
  const totalCount = blocks.length

  for (const { search, replace } of blocks) {
    const result = findAndReplace(updatedFile, search, replace)
    if (result !== null) {
      updatedFile = result
      appliedCount++
    }
  }

  let status: ReplaceResult['status']
  if (appliedCount === 0) {
    status = 'no_diff_applied'
  } else if (appliedCount < totalCount) {
    status = 'some_diff_applied'
  } else {
    status = 'all_diff_applied'
  }

  return {
    content: updatedFile,
    status,
    appliedCount,
    totalCount,
  }
}
