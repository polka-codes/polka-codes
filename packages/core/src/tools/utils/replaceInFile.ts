/* Example diff block format:
  <<<<<<< SEARCH
  // original text
  =======
  // replacement text
  >>>>>>> REPLACE
*/

export type ReplaceResult = {
  content: string
  status: 'no_diff_applied' | 'all_diff_applied'
  appliedCount: number
  totalCount: number
}

export const replaceInFile = (fileContent: string, diff: string): ReplaceResult => {
  const blockPattern = /^<<<<<<< SEARCH\r?\n([\s\S]*?)(?:\r?\n)?^=======\r?\n([\s\S]*?)(?:\r?\n)?^>>>>>>> REPLACE$/gm
  const blocks: { search: string; replace: string }[] = []

  for (let match = blockPattern.exec(diff); match !== null; match = blockPattern.exec(diff)) {
    blocks.push({ search: match[1], replace: match[2] })
  }

  if (blocks.length === 0) {
    throw new Error('No valid diff blocks found.')
  }
  if (diff.replace(blockPattern, '').trim().length > 0) {
    throw new Error('Invalid content outside SEARCH/REPLACE blocks.')
  }

  let updatedFile = fileContent

  for (const { search, replace } of blocks) {
    if (search.length === 0) {
      throw new Error('SEARCH content cannot be empty.')
    }

    const index = updatedFile.indexOf(search)
    const hasMultipleMatches = index !== -1 && updatedFile.indexOf(search, index + 1) !== -1
    if (index === -1 || hasMultipleMatches) {
      return {
        content: fileContent,
        status: 'no_diff_applied',
        appliedCount: 0,
        totalCount: blocks.length,
      }
    }

    updatedFile = updatedFile.slice(0, index) + replace + updatedFile.slice(index + search.length)
  }

  return {
    content: updatedFile,
    status: 'all_diff_applied',
    appliedCount: blocks.length,
    totalCount: blocks.length,
  }
}
