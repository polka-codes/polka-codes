export type GitStatusEntry = {
  path: string
  originalPath?: string
  indexStatus: string
  workingTreeStatus: string
}

/** Parse git status --porcelain=v1 -z without quoting or normalizing paths. */
export function parseGitPorcelain(output: string): GitStatusEntry[] {
  const entries: GitStatusEntry[] = []
  const records = output.split('\0')
  for (let index = 0; index < records.length; index++) {
    const record = records[index]
    if (!record) continue
    const entry: GitStatusEntry = { path: record.slice(3), indexStatus: record[0], workingTreeStatus: record[1] }
    const status = record.slice(0, 2)
    if (status.includes('R') || status.includes('C')) {
      entry.originalPath = records[++index]
      if (!entry.originalPath) throw new Error('Missing source path in Git status')
    }
    entries.push(entry)
  }
  return entries
}
