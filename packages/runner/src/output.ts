// Ten commands with two 8 KiB JSON strings each leave room in the app's 256 KiB frame limit.
export const RUNNER_OUTPUT_MAX_JSON_BYTES = 8 * 1024

function takeOutput(text: string, maxBytes: number, fromEnd: boolean): string {
  let offset = fromEnd ? text.length : 0
  let bytes = 0
  while (fromEnd ? offset > 0 : offset < text.length) {
    const pairStart = fromEnd ? offset - 2 : offset
    const high = text.charCodeAt(pairStart)
    const low = text.charCodeAt(pairStart + 1)
    const width = high >= 0xd800 && high <= 0xdbff && low >= 0xdc00 && low <= 0xdfff ? 2 : 1
    const next = offset + (fromEnd ? -width : width)
    const character = fromEnd ? text.slice(next, offset) : text.slice(offset, next)
    const characterBytes = Buffer.byteLength(JSON.stringify(character)) - 2
    if (bytes + characterBytes > maxBytes) break
    bytes += characterBytes
    offset = next
  }
  return fromEnd ? text.slice(offset) : text.slice(0, offset)
}

export function boundRunnerOutput(text: string): { text: string; truncated: boolean } {
  if (Buffer.byteLength(JSON.stringify(text)) <= RUNNER_OUTPUT_MAX_JSON_BYTES) {
    return { text, truncated: false }
  }

  const totalBytes = Buffer.byteLength(text)
  const separator = '\n\n[... omitted output ...]\n\n'
  // Reserve the longest possible notice; the actual omitted-byte count can only be shorter.
  const notice = (omittedBytes: number) =>
    `[runner output truncated: omitted ${omittedBytes} UTF-8 bytes; complete output is in the GitHub Actions logs]\n\n`
  const availableBytes = RUNNER_OUTPUT_MAX_JSON_BYTES - Buffer.byteLength(JSON.stringify(notice(totalBytes) + separator))
  const head = takeOutput(text, Math.floor(availableBytes / 2), false)
  const tail = takeOutput(text, Math.ceil(availableBytes / 2), true)
  const omittedBytes = totalBytes - Buffer.byteLength(head) - Buffer.byteLength(tail)
  return { text: notice(omittedBytes) + head + separator + tail, truncated: true }
}
